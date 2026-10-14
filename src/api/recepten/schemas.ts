import { z } from 'zod';

const tripelOverzicht = {
  id: 1,
  naam: 'Gouden Tripel',
  bierstijl: 'Belgische Tripel',
  beschrijving: 'Klassieke krachtige blondine met fruitige en kruidige tonen.',
};

const tripel = {
  ...tripelOverzicht,
  basis_volume_liter: 20,
  aangemaakt_op: '2026-10-14 12:38:49',
  gewijzigd_op: '2026-10-14 12:38:49',
};

const pilsnerMout = { ingredient_id: 1, naam: 'Pilsner Mout', fabrikant: 'Dingemans', hoeveelheid_kg: 5.5 };

export const ReceptIdParams = z
  .object({
    id: z.coerce.number().int().positive().meta({ description: 'Id van het recept', example: 1 }),
  })
  .meta({ example: { id: 1 } });

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
  basis_volume_liter: z.number().meta({ description: 'Oorspronkelijk brouwvolume in liter' }),
  aangemaakt_op: z.string().meta({ description: 'Tijdstip in het formaat "JJJJ-MM-DD uu:mm:ss"' }),
  gewijzigd_op: z.string().meta({ description: 'Tijdstip in het formaat "JJJJ-MM-DD uu:mm:ss"' }),
};

export const Recept = z.object(receptVelden).meta({ example: tripel });

export const Ingredient = z
  .object({
    ingredient_id: z.number().int(),
    naam: z.string(),
    fabrikant: z.string().nullable(),
    hoeveelheid_kg: z.number(),
  })
  .meta({ example: pilsnerMout });

export const IngredientenLijst = z.array(Ingredient).meta({ example: [pilsnerMout] });

export const ReceptMetIngredienten = z
  .object({ ...receptVelden, ingredienten: z.array(Ingredient) })
  .meta({ example: { ...tripel, ingredienten: [pilsnerMout] } });
