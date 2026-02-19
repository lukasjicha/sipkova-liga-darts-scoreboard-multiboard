const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const os = require('os');

const PORT = process.env.PORT || 8080;

// Get local IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const localIP = getLocalIP();

// HTTP server for static files
const server = http.createServer((req, res) => {
    if (req.url === '/server-info') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ip: localIP, port: PORT }));
        return;
    }

    // Returns current session mode so clients can auto-decide role
    if (req.url === '/session-mode') {
        const hasMaster = Array.from(clients.values()).some(c => c.role === 'master');
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ boardCount, hasMaster, masterMode }));
        return;
    }

    // /spectator serves the same index.html - JS detects the path
    if (req.url === '/spectator' || req.url.startsWith('/spectator?')) {
        const filePath = path.join(__dirname, 'static', 'index.html');
        fs.readFile(filePath, (err, content) => {
            if (err) { res.writeHead(500); res.end('Server Error'); }
            else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(content); }
        });
        return;
    }

    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, 'static', filePath);

    const extname = path.extname(filePath);
    const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.ico': 'image/x-icon'
    };
    const contentType = contentTypes[extname] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// WebSocket server
const wss = new WebSocketServer({ server });

let clients = new Map(); // deviceId -> { ws, role }

// Session-wide state (single session per server instance)
let boardCount = 4; // fixed maximum - unused boards are ignored
let masterMode = null; // 'single' or 'multi' - set when master connects
let boardAssignments = {}; // boardId (string) -> deviceId

function normalizeBoardCount(n) {
    const v = parseInt(n, 10);
    if (Number.isNaN(v)) return 1;
    return Math.max(1, Math.min(4, v));
}

function broadcast(type, payload = {}) {
    const msg = JSON.stringify({ type, ...payload });
    clients.forEach((client) => {
        if (client.ws.readyState === 1) {
            client.ws.send(msg);
        }
    });
}

function syncStateTo(ws) {
    if (ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: 'board_count_sync', count: boardCount }));
    ws.send(JSON.stringify({ type: 'board_assignments_sync', assignments: boardAssignments }));
}

function cleanupAssignmentsBeyondCount() {
    for (const k of Object.keys(boardAssignments)) {
        const b = parseInt(k, 10);
        if (b > boardCount) delete boardAssignments[k];
    }
}

function releaseBoardsForDevice(deviceId) {
    let changed = false;
    for (const [b, d] of Object.entries(boardAssignments)) {
        if (d === deviceId) {
            delete boardAssignments[b];
            changed = true;
        }
    }
    if (changed) {
        broadcast('board_assignments_sync', { assignments: boardAssignments });
    }
}

function broadcastClientCount() {
    const count = Array.from(clients.values()).filter(c => c.role === 'slave').length;
    clients.forEach((client) => {
        if (client.ws.readyState === 1) {
            client.ws.send(JSON.stringify({
                type: 'clients_update',
                count: count
            }));
        }
    });
}

function broadcastToOthers(senderDeviceId, message) {
    clients.forEach((client, deviceId) => {
        if (deviceId !== senderDeviceId && client.ws.readyState === 1) {
            client.ws.send(message);
        }
    });
}

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const role = url.searchParams.get('role') || 'slave';
    const deviceId = url.searchParams.get('deviceId') || 'unknown_' + Date.now();

    ws.deviceId = deviceId;
    ws.role = role;
    
    clients.set(deviceId, { ws, role });
    console.log(`${role} connected (${deviceId}). Total clients: ${clients.size}`);
    
    broadcastClientCount();

    // Enforce master on board 1
    if (role === 'master') {
        boardAssignments['1'] = deviceId;
        broadcast('board_assignments_sync', { assignments: boardAssignments });
    }

    // Send current state to the newly connected client
    syncStateTo(ws);

    ws.on('message', (data) => {
        try {
            const message = data.toString();
            const msg = JSON.parse(message);

            // Server-side stateful messages
            if (msg && typeof msg.type === 'string') {
                if (msg.type === 'board_count_set' && role === 'master') {
                    boardCount = normalizeBoardCount(msg.count);
                    masterMode = (boardCount === 1) ? 'single' : 'multi';
                    cleanupAssignmentsBeyondCount();
                    // Master always owns board 1
                    boardAssignments['1'] = deviceId;
                    broadcast('board_count_sync', { count: boardCount });
                    broadcast('board_assignments_sync', { assignments: boardAssignments });
                }

                if (msg.type === 'board_claim') {
                    const requested = parseInt(msg.boardId, 10);
                    const isValid = Number.isInteger(requested) && requested >= 1 && requested <= boardCount;

                    // Master always board 1
                    if (role === 'master') {
                        boardAssignments['1'] = deviceId;
                        broadcast('board_assignments_sync', { assignments: boardAssignments });
                    } else {
                        // Slaves cannot claim board 1
                        if (!isValid || requested === 1) {
                            // Suggest first free board >=2
                            const suggested = findFirstFreeBoard(deviceId);
                            ws.send(JSON.stringify({ type: 'board_claim_result', accepted: false, suggestedBoard: suggested }));
                        } else {
                            const key = String(requested);
                            const current = boardAssignments[key];
                            if (!current || current === deviceId) {
                                // Release any other board held by this device
                                releaseBoardsForDevice(deviceId);
                                boardAssignments[key] = deviceId;
                                ws.send(JSON.stringify({ type: 'board_claim_result', accepted: true, boardId: requested }));
                                broadcast('board_assignments_sync', { assignments: boardAssignments });
                            } else {
                                const suggested = findFirstFreeBoard(deviceId);
                                ws.send(JSON.stringify({ type: 'board_claim_result', accepted: false, suggestedBoard: suggested }));
                                // Still broadcast current assignments so UI can disable
                                ws.send(JSON.stringify({ type: 'board_assignments_sync', assignments: boardAssignments }));
                            }
                        }
                    }
                }

                if (msg.type === 'board_release') {
                    releaseBoardsForDevice(deviceId);
                    // Keep master on board 1 if master releases
                    if (role === 'master') {
                        boardAssignments['1'] = deviceId;
                        broadcast('board_assignments_sync', { assignments: boardAssignments });
                    }
                }
            }
            
            // Broadcast to all other clients
            broadcastToOthers(deviceId, message);
            
            console.log(`Message from ${role}: ${msg.type}`);
        } catch (e) {
            console.error('Invalid message:', e);
        }
    });

    ws.on('close', () => {
        releaseBoardsForDevice(deviceId);
        clients.delete(deviceId);
        console.log(`${role} disconnected (${deviceId}). Total clients: ${clients.size}`);
        broadcastClientCount();
    });
});

function findFirstFreeBoard(deviceId) {
    // Prefer current board if already assigned
    for (let b = 2; b <= boardCount; b++) {
        const key = String(b);
        const cur = boardAssignments[key];
        if (!cur || cur === deviceId) return b;
    }
    return 2;
}

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('========================================================');
    console.log('            DARTS LEAGUE SERVER');
    console.log('========================================================');
    console.log('');
    console.log(`  Server bezi na: http://${localIP}:${PORT}`);
    console.log('');
    console.log('  Pro pripojeni tabletu/telefonu:');
    console.log(`  Otevrete prohlizec a zadejte: ${localIP}:${PORT}`);
    console.log('');
    console.log('  Pro ukonceni serveru stisknete Ctrl+C');
    console.log('');
    console.log('========================================================');
    console.log('');

    // Try to open browser
    const open = process.platform === 'win32' ? 'start' :
                 process.platform === 'darwin' ? 'open' : 'xdg-open';
    require('child_process').exec(`${open} http://${localIP}:${PORT}`);
});
