import { z } from 'zod'

export const ScaledRecipeQuery = z
  .object({
    volume: z.coerce
      .number({ error: 'volume is verplicht en moet een getal zijn' })
      .positive('volume moet groter zijn dan 0')
      .max(1000, 'volume mag maximaal 1000 liter zijn')
      .meta({ description: 'Gewenst brouwvolume in liter'})
      .meta({ example: 30 }),
  })
  .strict()
  .meta({ example: { volume: 30 } });

export const ScaledRecipeResponse = z
  .object({
    recipe: z.object({
      id: z.number().int(),
      name: z.string(),
      beer_style: z.string().nullable(),
      description: z.string().nullable(),
      recept_volume: z.number(),
    }),
    target_volume_l: z.number(),
    scale_factor: z.number(),
    ingredients: z.array(z.record(z.string(), z.unknown())), // Of vervang door jullie bestaande RecipeIngredient schema
    water: z
      .object({
        mash_water_l: z.number(),
        sparge_water_l: z.number(),
      })
      .nullable(),
    hops: z.array(z.record(z.string(), z.unknown())), // Of vervang door jullie bestaande HopAddition schema
    extras: z.array(z.record(z.string(), z.unknown())), // Of vervang door jullie bestaande RecipeExtra schema
    mash_schedule: z.object({
      steps: z.array(z.record(z.string(), z.unknown())),
    }),
    boil_time_min: z.number().int().min(0),
    fermentation_schedule: z.object({
      steps: z.array(z.record(z.string(), z.unknown())),
    }),
  })
  .meta({
    example: {
      recipe: {
        id: 1,
        name: 'Gouden Tripel',
        beer_style: 'Belgische Tripel',
        description: 'Klassieke krachtige blondine.',
        basis_volume_liter: 20,
      },
      target_volume_l: 30,
      scale_factor: 1.5,
      ingredients: [{ ingredient_id: 1, name: 'Pilsmout', amount_g: 7500 }],
      water: { mash_water_l: 22.5, sparge_water_l: 18.0 },
      hops: [{ hop_id: 1, name: 'Saaz', amount_g: 45, boil_time_min: 60 }],
      extras: [{ extra_id: 1, name: 'Koriander', amount: 15, unit: 'g', addition_moment: 'koken', boil_time_min: 10 }],
      mash_schedule: { steps: [{ step_order: 1, temperature_c: 62, duration_min: 45 }] },
      boil_time_min: 60,
      fermentation_schedule: { steps: [{ step_order: 1, temperature_c: 20, duration_days: 14 }] },
    },
  });