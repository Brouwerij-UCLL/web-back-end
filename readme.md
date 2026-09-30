# Projectnaam

Korte beschrijving van de applicatie: wat ze doet en voor wie ze bedoeld is.

Gebouwd met [Node.js](https://nodejs.org/) en [Express](https://expressjs.com/).

## Vereisten

Zorg dat het volgende op je machine staat voor je begint:

| Tool | Versie | Controleren met |
|------|--------|-----------------|
| Node.js | 18 LTS of hoger (20 LTS aanbevolen) | `node -v` |
| npm | 9 of hoger (komt mee met Node.js) | `npm -v` |
| Git | recente versie | `git --version` |

### Node.js installeren

**Windows / macOS:** download de LTS-installer via [nodejs.org](https://nodejs.org/) en volg de wizard.

**Linux (Debian/Ubuntu):**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Met nvm (aanbevolen als je meerdere Node-versies gebruikt):**

```bash
nvm install 20
nvm use 20
```

## Installatie

1. Clone de repository:

   ```bash
   git clone https://github.com/<organisatie>/<repo>.git
   cd <repo>
   ```

2. Installeer de dependencies:

   ```bash
   npm install
   ```

   Gebruik `npm ci` op een server of in CI: die installeert exact de versies uit `package-lock.json`.

3. Maak een `.env`-bestand aan op basis van het voorbeeld:

   ```bash
   cp .env.example .env
   ```

   Op Windows (PowerShell):

   ```powershell
   Copy-Item .env.example .env
   ```

4. Vul de waarden in `.env` in (zie [Configuratie](#configuratie)).

## Configuratie

De applicatie leest haar instellingen uit omgevingsvariabelen in `.env`.

| Variabele | Beschrijving | Standaard |
|-----------|--------------|-----------|
| `PORT` | Poort waarop de server luistert | `3000` |
| `NODE_ENV` | `development` of `production` | `development` |
| `...` | Voeg hier je eigen variabelen toe | |

Voorbeeld `.env`:

```env
PORT=3000
NODE_ENV=development
```

> **Let op:** zet `.env` nooit in Git. Controleer dat het in `.gitignore` staat.

## Applicatie starten

### Development

Start met automatische herstart bij wijzigingen:

```bash
npm run dev
```

### Productie

```bash
npm start
```

De applicatie is daarna bereikbaar op [http://localhost:3000](http://localhost:3000) (of de poort die je in `.env` instelde).

### Scripts in `package.json`

Zorg dat deze scripts in je `package.json` staan:

```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js"
}
```

Voor `npm run dev` heb je `nodemon` nodig:

```bash
npm install --save-dev nodemon
```

Vanaf Node.js 18.11 kan het ook zonder extra package:

```json
"dev": "node --watch src/server.js"
```

## Projectstructuur

```
.
├── src/
│   ├── server.js        # Startpunt: maakt de Express-app aan en start de server
│   ├── routes/          # Route-definities
│   ├── controllers/     # Logica per route
│   ├── middleware/      # Eigen middleware
│   └── public/          # Statische bestanden (CSS, JS, afbeeldingen)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

Pas deze structuur aan zodat ze overeenkomt met je eigen project.

## Minimale server (referentie)

```js
// src/server.js
require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('src/public'));

app.get('/', (req, res) => {
  res.send('Server draait');
});

app.listen(PORT, () => {
  console.log(`Server luistert op http://localhost:${PORT}`);
});
```

Installeer de nodige packages als ze nog ontbreken:

```bash
npm install express dotenv
```

## Probleemoplossing

**`Error: listen EADDRINUSE: address already in use :::3000`**
Een ander proces gebruikt poort 3000. Kies een andere poort in `.env` of stop het proces:

```bash
# macOS / Linux
lsof -i :3000
kill -9 <PID>
```

```powershell
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**`Cannot find module 'express'`**
De dependencies zijn niet geïnstalleerd. Voer `npm install` uit in de hoofdmap van het project.

**Omgevingsvariabelen worden niet ingelezen**
Controleer of `.env` in de hoofdmap staat en of `require('dotenv').config()` bovenaan `server.js` staat.

## Licentie

Vermeld hier de licentie of "Intern gebruik" als het project niet publiek is.