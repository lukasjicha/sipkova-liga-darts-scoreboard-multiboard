🎯 Darts League – Šipková liga & Darts Scoreboard (CZ)

Webová aplikace pro vedení šipkařské ligy a zápasů. Běží lokálně na PC (Node.js server) a umí zobrazovat více terčů současně na dalších zařízeních v síti (telefony/tablety).

## Co to umí

### Herní režimy
- **501 / 301** (klasické odpočítávání)
- **Cricket**
- **Turnaje** (pavouk / bracket)

### Multi‑board (až 4 terče)
- **T1–T4** 
- **Master = vždy T1** (řídí hru, nastavuje počet terčů)
- **Display (Slave)** = T2–T4 (jen zobrazení daného terče)
- **Automatická synchronizace počtu terčů** (Master nastaví 2/3/4 → ostatní se přizpůsobí)
- **Claim terče**: server hlídá, aby si dva displeje nevzaly stejný terč
- **Zámky hráčů**: hráč nemůže být vybraný na dvou terčích zároveň (zamezí chybám)

### UI a pohodlí
- **Funguje na mobilu/tabletu** (responzivní rozložení, bez nutnosti posouvat kritické ovládání)
- **Fullscreen** (užitečné pro TV)
- **Zvuk / „hospodský mód“** (hlášky, emoce – CZ)
- **Import / export dat** do **JSON** (záloha, přenos na jiné zařízení)

## Rychlý start (Windows)

### 1) Požadavky
- Windows PC
- **Node.js LTS** (https://nodejs.org)

### 2) Spuštění
1. Otevři složku `darts-server-node`
2. Dvojklik na **`DartsServer.bat`**
   - při prvním spuštění se nainstalují závislosti (`npm install`)
3. V prohlížeči se otevře hra
4. V konzoli uvidíš IP adresu pro ostatní zařízení (např. `192.168.1.50:8080`)

### 3) Připojení telefonu/tabletu
1. Telefon/tablet musí být na stejné Wi‑Fi
2. Otevři prohlížeč a zadej adresu z PC (např. `http://192.168.1.50:8080`)
3. Zvol **Více terčů → Display**
4. Vyber terč **T2/T3/T4** (T1 je Master)

## Jak používat multi‑board (doporučený postup)

1. Na PC otevři aplikaci → **Více terčů → Master**
2. Nastav **počet terčů (2/3/4)** a připoj se
3. Na dalších zařízeních otevři stejnou IP → **Display** → vyber volný terč
4. Při výběru hráčů se automaticky hlídá:
   - hráč není na více terčích zároveň
   - terč není obsazený dvěma displeji

## Struktura projektu
- `server.js` – Node.js server + WebSocket synchronizace
- `static/index.html` – celá aplikace (HTML + CSS + JS v jednom souboru)
- `DartsServer.bat` – pohodlné spuštění pro Windows
- `package.json` – závislosti

## Export / Import dat
V aplikaci je sekce **Správa dat**:
- **Export** vytvoří JSON zálohu
- **Import** načte JSON zpět (přenos na jiné PC, archiv ligy)

## Troubleshooting
- **Telefon se nepřipojí / timeout**: zkontroluj firewall/antivir (např. ESET) a povol přístup pro Node.
- **Něco nejde po update**: hard reload (Ctrl+F5) nebo otevři v anonymním okně.
- **Dva displeje na stejném terči**: server to zamítne a nabídne volný terč (claim systém).

## Licence
Doplň si dle potřeby (MIT / GPL / vlastní).


