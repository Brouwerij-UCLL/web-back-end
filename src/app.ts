import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { checkDatabaseConnection, db } from './db.ts';
import migrate from './migrate.ts';
import { brewSessionRoutes } from './routes/brew-sessions.ts';
import { recipeRoutes } from './routes/recipes.ts';

const app: Express = express();
const port = Number(process.env.PORT ?? 3000);

migrate();

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.get('/health/db', (req: Request, res: Response) => {
  try {
    checkDatabaseConnection();
    res.json({ database: 'ok' });
  } catch (error) {
    res.status(503).json({ database: 'unreachable', error: (error as Error).message });
  }
});

app.use('/api/recepten', recipeRoutes(db));
app.use('/api/brouwsessies', brewSessionRoutes(db));

// Zet fouten om naar een HTTP-status: 400/404/409 uit het model, 409 als een
// databasetrigger een afgeronde sessie beschermt, anders 500.
app.use((error: Error & { status?: number }, req: Request, res: Response, next: NextFunction) => {
  const status = error.status ?? (error.message.includes('brouwsessie is afgerond') ? 409 : 500);
  if (status === 500) console.error(error);
  res.status(status).json({ error: status === 500 ? 'interne fout' : error.message });
});

app.listen(port, () => {
  console.log(`online op http://localhost:${port}`);
  try {
    checkDatabaseConnection();
    console.log('verbonden met database');
  } catch (error) {
    console.error('geen verbinding met database:', (error as Error).message);
  }
});
