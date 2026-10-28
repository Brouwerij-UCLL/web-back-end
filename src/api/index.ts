import { extras } from './extras/routes.ts';
import { health } from './health.ts';
import { hops } from './hops/routes.ts';
import { ingredients } from './ingredients/routes.ts';
import { recepten } from './recepten/routes.ts';

// Alle groepen endpoints. Een nieuwe groep maak je met createRoutes en voeg je hier toe;
// app.ts koppelt ze en de documentatie neemt ze automatisch op.
export const routeGroepen = [health, recepten, ingredients, hops, extras];
