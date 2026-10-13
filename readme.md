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

## Mappenstructuur

```
migrations/         SQL-migraties (001_..., 002_...)
src/
  server.ts         lokaal startpunt: MQTT en webserver starten
  app.ts            de Express-app: migraties, middleware en routers (startpunt op Vercel)
  config.ts         instellingen uit .env (PORT, DATABASE_FILE, MQTT_URL)
  api/              REST-endpoints
    index.ts        router voor /api; koppel hier een router per onderdeel
    health.ts       /health/db
    recepten/       één map per onderdeel
      routes.ts     de endpoints van /api/recepten
  database/         alles rond SQLite
    db.ts           de databaseverbinding
    migrate.ts      voert de migraties uit
    recepten/       één map per onderdeel, zoals in api/
      queries.ts    de queries op de recepten-tabellen
  mqtt/             verbinding met de MQTT-broker
    client.ts       verbinden en abonneren
    topics.ts       de topics en het ontleden ervan
    handlers.ts     verwerken van binnenkomende berichten
```

- Nieuw onderdeel: maak een map in `src/api/` met een `routes.ts` (zoals `recepten/`) en koppel de router in `src/api/index.ts`.
- Queries: zet ze in `src/database/` in een map met dezelfde naam als in `src/api/` (zoals `recepten/queries.ts`), zodat routes en MQTT-handlers dezelfde functies gebruiken.
- Nieuw MQTT-topic: voeg het toe in `src/mqtt/topics.ts` en verwerk het in `src/mqtt/handlers.ts`.

## Database (SQLite)

De back-end gebruikt SQLite via de in Node ingebouwde module `node:sqlite`. Je hoeft niets apart te installeren of te starten; `npm start` en `npm run dev` openen de database automatisch.

- De database is één bestand: `./data/app.db` (aan te passen met `DATABASE_FILE` in `.env`). Het wordt niet mee gecommit.
- Database leegmaken: stop de app en verwijder de map `data`.
- Queries uitvoeren vanuit de code: `import { db } from '../database/db.ts'` en dan `db.prepare('SELECT ...').all()`.

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

Het databaseschema staat in genummerde SQL-bestanden in de map `migrations/`, bijvoorbeeld `001_brouwerij_schema.sql`. Bij het opstarten voert de app alle bestanden uit die nog niet uitgevoerd zijn, in alfabetische volgorde, en houdt dat bij in de tabel `migrations`. De migraties draaien op dezelfde database als de rest van de app (`DATABASE_FILE`).

- Schema wijzigen: voeg een nieuw `.sql`-bestand toe met het volgende nummer.
- Pas een migratie die al gedeeld is nooit meer aan; maak een nieuwe.
- Mislukt een migratie, dan wordt ze teruggedraaid en start de app niet.
