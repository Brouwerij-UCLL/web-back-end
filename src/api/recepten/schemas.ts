import { z } from 'zod';

const tripelOverzicht = {
  id: 2,
  naam: 'Gouden Tripel',
  bierstijl: 'Belgische Tripel',
  beschrijving: 'Klassieke krachtige blondine met fruitige esters en een volle, warme afdronk.',
};

const tripel = {
  ...tripelOverzicht,
  aangemaakt_op: '2026-10-14 12:38:49',
  gewijzigd_op: '2026-10-14 12:38:49',
};

const pilsnerMout = { ingredient_id: 1, naam: 'Pilsner Malt', fabrikant: 'Dingemans', hoeveelheid_g: 5500 };

export const ReceptIdParams = z
  .object({
    id: z.coerce.number().int().positive().meta({ description: 'Id van het recept', example: 2 }),
  })
  .meta({ example: { id: 2 } });

const receptOverzichtVelden = {
  id: z.number().int(),
  naam: z.string(),
  bierstijl: z.string().nullable(),
  beschrijving: z.string().nullable(),
};

export const ReceptOverzicht = z.object(receptOverzichtVelden).meta({ example: tripelOverzicht });

export const ReceptenLijst = z.array(ReceptOverzicht).meta({ example: [tripelOverzicht] });

const receptVelden = {
  ...receptOverzichtVelden,
  aangemaakt_op: z.string().meta({ description: 'Tijdstip in het formaat "JJJJ-MM-DD uu:mm:ss"' }),
  gewijzigd_op: z.string().meta({ description: 'Tijdstip in het formaat "JJJJ-MM-DD uu:mm:ss"' }),
};

export const Recept = z.object({...receptVelden, maischwater_liter: z.number().positive().nullable(),
  spoelwater_liter: z.number().nonnegative().nullable()
}).meta({ example: tripel, maischwater_liter: 18.5, spoelwater_liter: 12 });

export const Ingredient = z
  .object({
    ingredient_id: z.number().int(),
    naam: z.string(),
    fabrikant: z.string().nullable(),
    hoeveelheid_g: z.number().meta({ description: 'Hoeveelheid in gram' }),
  })
  .meta({ example: pilsnerMout });

export const IngredientenLijst = z.array(Ingredient).meta({ example: [pilsnerMout] });

export const ReceptMetIngredienten = z
  .object({ ...receptVelden, ingredienten: z.array(Ingredient) })
  .meta({ example: { ...tripel, ingredienten: [pilsnerMout] } });

export const ReceptWaterInvoer = z.object({
  maischwater_liter: z.number({
    error: 'maischwater_liter moet een getal zijn'
  }).positive('maischwater_liter moet groter zijn dan 0'),

  spoelwater_liter: z.number({
     error: 'spoelwater_liter moet een getal zijn'
  }).nonnegative('spoelwater_liter mag niet negatief zijn')
}).meta({
  example: {
    maischwater_liter: 18.5,
    spoelwater_liter: 12
  }
});

export const ReceptWaterAntwoord = z.object({
  maischwater_liter: z.number().positive(),
  spoelwater_liter: z.number().nonnegative()
}).meta({
  example: {
    maischwater_liter: 18.5,
    spoelwater_liter: 12
  }
});
