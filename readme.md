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
    index.ts        lijst van alle groepen endpoints
    docs.ts         Swagger UI op /api/docs
    health.ts       /health/db
    openapi/        validatie en documentatie van endpoints (createRoutes)
    recepten/       één map per onderdeel
      routes.ts     de endpoints van /api/recipes
      schemas.ts    schema's van invoer en antwoorden, met voorbeelden
    ingredients/
      routes.ts     de endpoints van /api/ingredients
      schemas.ts    schema's van invoer en antwoorden
    hops/
      routes.ts     de endpoints van /api/hops
      schemas.ts    schema's van invoer en antwoorden
    extras/
      routes.ts     de endpoints van /api/extras
      schemas.ts    schema's van invoer en antwoorden
  database/         alles rond SQLite
    db.ts           de databaseverbinding
    migrate.ts      voert de migraties uit
    recepten/       één map per onderdeel, zoals in api/
      queries.ts    de queries op de recepten-tabellen
    ingredients/
      queries.ts    de queries op de catalogus ingredients
    hops/
      queries.ts    de queries op de catalogus hops
    extras/
      queries.ts    de queries op de catalogus extra_ingredients
  mqtt/             verbinding met de MQTT-broker
    client.ts       verbinden en abonneren
    topics.ts       de topics en het ontleden ervan
    handlers.ts     verwerken van binnenkomende berichten
```

- Nieuw onderdeel: maak een map in `src/api/` met een `routes.ts` en `schemas.ts` (zoals `recepten/`), maak de groep met `createRoutes` en voeg ze toe aan `src/api/index.ts`.
- Namen: paden, queryparameters en JSON-velden van nieuwe endpoints zijn Engels (bv. `/api/ingredients`, `name`); beschrijvingen en foutmeldingen blijven Nederlands.
- Queries: zet ze in `src/database/` in een map met dezelfde naam als in `src/api/` (zoals `recepten/queries.ts`), zodat routes en MQTT-handlers dezelfde functies gebruiken.
- Nieuw MQTT-topic: voeg het toe in `src/mqtt/topics.ts` en verwerk het in `src/mqtt/handlers.ts`.

## API-documentatie

De documentatie wordt automatisch gegenereerd uit de code:

- Swagger UI: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- OpenAPI 3-specificatie: [http://localhost:3000/api/docs/openapi.json](http://localhost:3000/api/docs/openapi.json)

Elk endpoint wordt gedefinieerd met `route(...)` van een groep uit `createRoutes`. Die ene definitie bepaalt zowel de documentatie als het gedrag:

```ts
recepten.route({
  method: 'get',
  path: '/:id',
  summary: 'Eén recept',
  params: ReceptIdParams,      // wordt gevalideerd; ongeldig geeft 400
  response: Recept,            // het antwoord wordt hiertegen gecontroleerd
  responseDescription: 'Het recept',
  errors: { 404: 'Er bestaat geen recept met dit id' },
  // auth: true,               // vereist een JWT-token (Authorization: Bearer ...)
  handler: ({ params }) => {
    const recept = getRecept(params.id);
    if (!recept) throw new HttpFout(404, `recept ${params.id} niet gevonden`);
    return recept;
  },
});
```

- **Schema's** staan per onderdeel in `schemas.ts` en worden gemaakt met [Zod](https://zod.dev). Geef elk schema van invoer en antwoord een voorbeeld met `.meta({ example: ... })`.
- **Fouten** gooi je met `throw new HttpFout(status, 'boodschap')`. Elk foutantwoord heeft het formaat `{"fout": "..."}`.
- **Klopt altijd:** wijkt het antwoord van een handler af van het schema, dan geeft de back-end een 500 in plaats van ongedocumenteerde data.
- **Controle:** `npm test` controleert dat elk endpoint een beschrijving, groep, voorbeelden en het gedeelde foutschema heeft, en roept elk GET-endpoint aan met de voorbeeldwaarden.

## Database (SQLite)

De back-end gebruikt SQLite via de in Node ingebouwde module `node:sqlite`. Je hoeft niets apart te installeren of te starten; `npm start` en `npm run dev` openen de database automatisch.

- De database is één bestand: `./data/app.db` (aan te passen met `DATABASE_FILE` in `.env`). Het wordt niet mee gecommit.
- Database leegmaken: stop de app en verwijder de map `data`.
- Queries uitvoeren vanuit de code: `import { db } from '../database/db.ts'` en dan `db.prepare('SELECT ...').all()`.

Controleer de verbinding via [http://localhost:3000/health/db](http://localhost:3000/health/db).

### Datamodel recepten

Sinds migratie 003 gebruikt de database Engelse tabel- en kolomnamen. De API gebruikt ook Engelse veldnamen, dicht bij die kolommen (bv. `beer_style`, `amount_g`, `mash_schedule.steps[].temperature_c`); beschrijvingen en foutmeldingen zijn Nederlands.

| Tabel | Inhoud |
|---|---|
| `recipes` | naam, bierstijl, beschrijving, aanmaak- en wijzigingstijd |
| `ingredients`, `hops`, `extra_ingredients` | catalogi die recepten delen (een hop of mout bestaat één keer) |
| `recipe_ingredients` | vergistbare ingrediënten per recept, hoeveelheid in gram |
| `hop_additions` | hopgiften per recept: hoeveelheid en kooktijd; dezelfde hop kan meerdere keren |
| `recipe_extras` | extra ingrediënten per recept met toevoegmoment (`beslag` of `koken`) en kooktijd bij koken |
| `recipe_water` | maisch- en spoelwater in liter |
| `recipe_mash_steps`, `recipe_fermentation_steps` | maisch- en vergistingsstappen met temperatuur en duur |

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
