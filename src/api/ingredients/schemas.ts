import { z } from 'zod';

const pilsnerMalt = { id: 1, name: 'Pilsner Malt', manufacturer: 'Dingemans' };
const munichMalt = { id: 5, name: 'Munich Malt', manufacturer: 'Weyermann' };

export const IngredientIdParams = z
  .object({
    id: z.coerce.number().int().positive().meta({ description: 'Id van het ingrediënt', example: 1 }),
  })
  .meta({ example: { id: 1 } });

export const IngredientsQuery = z
  .object({
    search: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .meta({ description: 'Toon alleen ingrediënten waarvan de naam deze tekst bevat (hoofdletters niet meegerekend)', example: 'malt' }),
  })
  .meta({ example: { search: 'malt' } });

export const Ingredient = z
  .object({
    id: z.number().int(),
    name: z.string(),
    manufacturer: z.string().nullable(),
  })
  .meta({ example: pilsnerMalt });

export const IngredientsList = z.array(Ingredient).meta({ example: [munichMalt, pilsnerMalt] });

export const IngredientInput = z
  .object({
    name: z.string().trim().min(1, 'naam is verplicht').max(100, 'naam mag maximaal 100 tekens lang zijn'),
    manufacturer: z
      .string()
      .trim()
      .max(100, 'fabrikant mag maximaal 100 tekens lang zijn')
      .nullable()
      .optional()
      .transform((waarde) => (waarde ? waarde : null)),
  })
  .strict()
  .meta({ example: { name: 'Pilsner Malt', manufacturer: 'Dingemans' } });
