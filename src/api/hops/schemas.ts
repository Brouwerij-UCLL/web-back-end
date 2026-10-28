import { z } from 'zod';

const saaz = { id: 3, name: 'Saaz', alpha_acid_percentage: 3.5, type: 1, origin: 'Czech Republic' };
const citra = { id: 1, name: 'Citra', alpha_acid_percentage: 13.5, type: 1, origin: 'USA' };

export const HopIdParams = z
  .object({
    id: z.coerce.number().int().positive().meta({ description: 'Id van de hop', example: 3 }),
  })
  .meta({ example: { id: 3 } });

export const HopsQuery = z
  .object({
    search: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .meta({ description: 'Toon alleen hops waarvan de naam deze tekst bevat (hoofdletters niet meegerekend)', example: 'saaz' }),
  })
  .meta({ example: { search: 'saaz' } });

export const Hop = z
  .object({
    id: z.number().int(),
    name: z.string(),
    alpha_acid_percentage: z.number().nullable().meta({ description: 'Alfazuur in procent' }),
    type: z.number().int().meta({ description: '0 = bloemen, 1 = pellet' }),
    origin: z.string().nullable().meta({ description: 'Land of streek van herkomst' }),
  })
  .meta({ example: saaz });

export const HopsList = z.array(Hop).meta({ example: [citra, saaz] });

export const HopInput = z
  .object({
    name: z.string().trim().min(1, 'naam is verplicht').max(100, 'naam mag maximaal 100 tekens lang zijn'),
    alpha_acid_percentage: z
      .number({ error: 'alpha_acid_percentage moet een getal zijn' })
      .min(0, 'alpha_acid_percentage moet tussen 0 en 30 % liggen')
      .max(30, 'alpha_acid_percentage moet tussen 0 en 30 % liggen')
      .nullable()
      .optional()
      .transform((waarde) => waarde ?? null)
      .meta({ description: 'Alfazuur in procent, van 0 tot en met 30' }),
    type: z
      .union([z.literal(0), z.literal(1)], { error: 'type moet 0 (bloemen) of 1 (pellet) zijn' })
      .meta({ description: '0 = bloemen, 1 = pellet' }),
    origin: z
      .string()
      .trim()
      .max(100, 'herkomst mag maximaal 100 tekens lang zijn')
      .nullable()
      .optional()
      .transform((waarde) => (waarde ? waarde : null)),
  })
  .strict()
  .meta({ example: { name: 'Saaz', alpha_acid_percentage: 3.5, type: 1, origin: 'Czech Republic' } });
