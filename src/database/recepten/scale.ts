import type { Recipe } from './queries.ts';

const roundKg = (value: number): number => Math.round(value * 100) / 100;
const roundLiter = (value: number): number => Math.round(value * 10) / 10;
const roundGram = (value: number): number => Math.round(value);

function scaleByUnit(amount: number, unit: string, scaleFactor: number) {
  const scaled = amount * scaleFactor;
  const normalizedUnit = unit.trim().toLowerCase();

  if (normalizedUnit === 'kg') return roundKg(scaled);
  if (normalizedUnit === 'l' || normalizedUnit === 'liter') return roundLiter(scaled);
  if (normalizedUnit === 'g' || normalizedUnit === 'gram') return roundGram(scaled);

  return roundGram(scaled);
}

export function scaleRecipe(recipe: Recipe, targetVolumeL: number) {
  const scaleFactor = Number((targetVolumeL / recipe.recept_volume).toFixed(4));

  const ingredients = recipe.ingredients.map((item) => ({
    ...item,
    amount_g: roundGram(item.amount_g * scaleFactor),
  }));

  const hops = recipe.hops.map((hop) => ({
    ...hop,
    amount_g: roundGram(hop.amount_g * scaleFactor),
  }));

  const extras = recipe.extras.map((extra) => ({
    ...extra,
    amount: scaleByUnit(extra.amount, extra.unit, scaleFactor),
  }));

  const water = recipe.water
    ? {
        mash_water_l: roundLiter(recipe.water.mash_water_l * scaleFactor),
        sparge_water_l: roundLiter(recipe.water.sparge_water_l * scaleFactor),
      }
    : null;

  const hopBoilTimes = hops.map((h) => h.boil_time_min ?? 0);
  const extraBoilTimes = extras
    .filter((e) => e.add_moment === 'koken')
    .map((e) => e.boil_time_min ?? 0);
  const boilTimeMin = Math.max(0, ...hopBoilTimes, ...extraBoilTimes);

  return {
    recipe: {
      id: recipe.id,
      name: recipe.name,
      beer_style: recipe.beer_style,
      description: recipe.description,
      recept_volume: recipe.recept_volume,
      created_at: recipe.created_at,
      updated_at: recipe.updated_at,
    },
    target_volume_l: roundLiter(targetVolumeL),
    scale_factor: scaleFactor,
    water,
    ingredients,
    hops,
    extras,
    mash_schedule: recipe.mash_schedule,
    boil_time_min: boilTimeMin,
    fermentation_schedule: recipe.fermentation_schedule,
  };
}