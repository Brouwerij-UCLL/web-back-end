import { z } from 'zod';

const koriander = {
  id: 1,
  name: 'Gedroogde Koriander (Coriander)',
  description: 'Licht geplet voor citrus/kruidig aroma',
  unit: 'g',
};
const lactose = {
  id: 5,
  name: 'Lactose (Melksuiker)',
  description: 'Niet-vergistbare suiker voor romigheid in Stouts',
  unit: 'g',
};

export const ExtraIdParams = z
  .object({
    id: z.coerce.number().int().positive().meta({ description: 'Id van het extra ingrediënt', example: 1 }),
  })
  .meta({ example: { id: 1 } });

export const ExtrasQuery = z
  .object({
    search: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .meta({ description: 'Toon alleen extra ingrediënten waarvan de naam deze tekst bevat (hoofdletters niet meegerekend)', example: 'suiker' }),
  })
  .meta({ example: { search: 'suiker' } });

export const Extra = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    unit: z.string().meta({ description: 'Eenheid van de hoeveelheid in een recept, bv. g, ml of stuks' }),
  })
  .meta({ example: koriander });

export const ExtrasList = z.array(Extra).meta({ example: [koriander, lactose] });

export const ExtraInput = z
  .object({
    name: z.string().trim().min(1, 'naam is verplicht').max(100, 'naam mag maximaal 100 tekens lang zijn'),
    description: z
      .string()
      .trim()
      .max(1000, 'beschrijving mag maximaal 1000 tekens lang zijn')
      .nullable()
      .optional()
      .transform((waarde) => (waarde ? waarde : null)),
    unit: z
      .string({ error: 'eenheid is verplicht' })
      .trim()
      .min(1, 'eenheid is verplicht')
      .max(20, 'eenheid mag maximaal 20 tekens lang zijn')
      .meta({ description: 'Eenheid van de hoeveelheid in een recept, bv. g, ml of stuks' }),
  })
  .strict()
  .meta({ example: { name: 'Gedroogde Koriander (Coriander)', description: 'Licht geplet voor citrus/kruidig aroma', unit: 'g' } });
