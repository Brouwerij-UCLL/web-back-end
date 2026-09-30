# web-back-end

Korte beschrijving van de applicatie.

## Vereisten

- [Node.js](https://nodejs.org/) 18 of hoger (LTS aanbevolen)
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