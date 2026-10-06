# web-back-end

Korte beschrijving van de applicatie.

## Vereisten

- [Node.js](https://nodejs.org/) 24 of hoger (nodig voor de ingebouwde SQLite en TypeScript-ondersteuning)
- npm (komt mee met Node.js)

Controleer met:

```bash
node -v
npm -v
```

## Installatie

```bash
git clone https://github.com/Brouwerij-UCLL/web-back-end.git
cd web-back-end
npm install
```

Maak een `.env`-bestand aan op basis van het voorbeeld en vul de waarden in:

Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

Windows (cmd):

```cmd
copy .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

## Database (SQLite)

De back-end gebruikt SQLite via de in Node ingebouwde module `node:sqlite`. Je hoeft niets apart te installeren of te starten; `npm start` en `npm run dev` openen de database automatisch.

- De database is één bestand: `./data/app.db` (aan te passen met `DATABASE_FILE` in `.env`). Het wordt niet mee gecommit.
- Database leegmaken: stop de app en verwijder de map `data`.
- Queries uitvoeren vanuit de code: `import { db } from './db.ts'` en dan `db.prepare('SELECT ...').all()`.

Controleer de verbinding via [http://localhost:3000/health/db](http://localhost:3000/health/db).

## Starten

Development (herstart automatisch bij wijzigingen):

```bash
npm run dev
```

Productie:

```bash
npm start
```

De applicatie draait op [http://localhost:3000](http://localhost:3000), tenzij je een andere `PORT` instelt in `.env`.

## Database-migraties

De applicatie gebruikt SQLite. Bij het opstarten voert Knex automatisch alle
nog niet uitgevoerde migraties uit de map `migrations/` uit. Het
databasebestand (`database.sqlite`) wordt in de projectmap aangemaakt en niet
in Git bijgehouden.

Plaats migratiebestanden met de extensie `.js` in `migrations/`; nieuwe
migraties worden bij de volgende start van de applicatie toegepast. De map is
nu nog leeg, dus er worden nog geen tabellen aangemaakt.