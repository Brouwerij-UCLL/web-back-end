import { z } from 'zod';
import { config } from '../../config.ts';
import { Recipe } from '../recepten/schemas.ts';

const maxLiter = config.maxVolumeLiter;
const voorbeeldInvoer = { recept_id: 1, doel_volume_liter: Math.min(30, maxLiter) };

export const BrouwsessieInput = z.object({
  recept_id: z.number().int().positive(),
  doel_volume_liter: z
    .number({ error: 'volume is verplicht en moet een getal zijn' })
    .positive('volume moet groter zijn dan 0 liter')
    .max(maxLiter, `volume mag maximaal ${maxLiter} liter zijn`),
}).strict().meta({ example: voorbeeldInvoer });

export const GeschaaldeHoeveelheden = Recipe.pick({
  water: true,
  ingredients: true,
  hops: true,
  extras: true,
});

const voorbeeldMout = { ingredient_id: 1, name: 'Pilsner Malt', manufacturer: 'Dingemans', amount_g: 4000 };
const voorbeeldHop = {
  id: 1, hop_id: 3, name: 'Saaz', alpha_acid_percentage: 3.5, type: 1, origin: 'Czech Republic',
  amount_g: 40, boil_time_min: 60,
};
const voorbeeldRecept = {
  id: voorbeeldInvoer.recept_id,
  name: 'Voorbeeldrecept',
  beer_style: null,
  description: null,
  recept_volume: 20,
  created_at: '2026-11-18 12:00:00',
  updated_at: '2026-11-18 12:00:00',
  water: { mash_water_l: 20, sparge_water_l: 5 },
  ingredients: [voorbeeldMout],
  hops: [voorbeeldHop],
  extras: [],
  mash_schedule: { steps: [{ step_nr: 1, temperature_c: 65, duration_min: 45 }] },
  fermentation_schedule: { steps: [{ step_nr: 1, temperature_c: 20, duration_days: 10 }] },
} satisfies z.input<typeof Recipe>;

const voorbeeldFactor = voorbeeldInvoer.doel_volume_liter / voorbeeldRecept.recept_volume;

export const Brouwsessie = z.object({
  id: z.number().int().positive(),
  recept_id: z.number().int().positive(),
  doel_volume_liter: z.number().positive(),
  schaalfactor: z.number().positive(),
  created_at: z.string(),
  recept_snapshot: Recipe,
  geschaalde_hoeveelheden: GeschaaldeHoeveelheden,
}).meta({
  example: {
    id: 1,
    ...voorbeeldInvoer,
    schaalfactor: voorbeeldFactor,
    created_at: '2026-11-18 12:30:00',
    recept_snapshot: voorbeeldRecept,
    geschaalde_hoeveelheden: {
      water: { mash_water_l: 20 * voorbeeldFactor, sparge_water_l: 5 * voorbeeldFactor },
      ingredients: [{ ...voorbeeldMout, amount_g: voorbeeldMout.amount_g * voorbeeldFactor }],
      hops: [{ ...voorbeeldHop, amount_g: voorbeeldHop.amount_g * voorbeeldFactor }],
      extras: [],
    },
  },
});