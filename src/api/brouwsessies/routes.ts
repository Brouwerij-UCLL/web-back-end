import { slaBrouwsessieOp } from '../../database/brouwsessies/queries.ts';
import { getRecept } from '../../database/recepten/queries.ts';
import { createRoutes, HttpFout } from '../openapi/route.ts';
import { Recipe } from '../recepten/schemas.ts';
import { Brouwsessie, BrouwsessieInput, GeschaaldeHoeveelheden } from './schemas.ts';

export const brouwsessies = createRoutes('/api/brouwsessies', 'brouwsessies');

brouwsessies.route({
  method: 'post',
  path: '/',
  summary: 'Brouwsessie starten op basis van een recept en volume',
  description: 'Schaalt de hoeveelheden naar het doelvolume en bewaart een kopie van het oorspronkelijke recept.',
  body: BrouwsessieInput,
  status: 201,
  response: Brouwsessie,
  responseDescription: 'De opgeslagen brouwsessie met schaalfactor, receptkopie en geschaalde hoeveelheden',
  errors: {
    400: 'Ongeldige invoer of de hoeveelheden kunnen niet worden geschaald naar het doelvolume',
    404: 'Er bestaat geen recept met dit id',
  },
  handler: ({ body }) => {
    const recept = getRecept(body.recept_id);
    if (!recept) throw new HttpFout(404, `recept ${body.recept_id} niet gevonden`);

    const snapshot = Recipe.parse(recept);
    const schaalfactor = body.doel_volume_liter / snapshot.recept_volume;
    const { water, ingredients, hops, extras } = snapshot;
    const geschaald = GeschaaldeHoeveelheden.safeParse({
      water: water === null ? null : {
        mash_water_l: water.mash_water_l * schaalfactor,
        sparge_water_l: water.sparge_water_l * schaalfactor,
      },
      ingredients: ingredients.map((regel) => ({ ...regel, amount_g: regel.amount_g * schaalfactor })),
      hops: hops.map((gift) => ({ ...gift, amount_g: gift.amount_g * schaalfactor })),
      extras: extras.map((regel) => ({ ...regel, amount: regel.amount * schaalfactor })),
    });

    if (!Number.isFinite(schaalfactor) || schaalfactor <= 0 || !geschaald.success) {
      throw new HttpFout(400, 'doel_volume_liter: de hoeveelheden kunnen niet worden geschaald naar dit volume');
    }

    return slaBrouwsessieOp({
      ...body,
      schaalfactor,
      recept_snapshot: snapshot,
      geschaalde_hoeveelheden: geschaald.data,
    });
  },
});