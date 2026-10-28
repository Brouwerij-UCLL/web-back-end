import { z } from 'zod';

const tripelSummary = {
  id: 2,
  name: 'Gouden Tripel',
  beer_style: 'Belgische Tripel',
  description: 'Klassieke krachtige blondine met fruitige esters en een volle, warme afdronk.',
};

const pilsnerMalt = { ingredient_id: 1, name: 'Pilsner Malt', manufacturer: 'Dingemans', amount_g: 5500 };

const tripel = {
  ...tripelSummary,
  created_at: '2026-10-14 12:38:49',
  updated_at: '2026-10-14 12:38:49',
  water: { mash_water_l: 20, sparge_water_l: 14 },
  ingredients: [
    pilsnerMalt,
    { ingredient_id: 3, name: 'Wheat Malt (Tarwemout)', manufacturer: 'Dingemans', amount_g: 800 },
    { ingredient_id: 7, name: 'CaraPils', manufacturer: 'Dingemans', amount_g: 200 },
  ],
  hops: [
    {
      id: 4,
      hop_id: 4,
      name: 'Styrian Goldings',
      alpha_acid_percentage: 5.2,
      type: 1,
      origin: 'Slovenia',
      amount_g: 35,
      boil_time_min: 60,
    },
  ],
  extras: [
    {
      extra_ingredient_id: 2,
      name: 'Kandijsuiker (Wit)',
      description: 'Voor hogere vergistingsgraad in zware Belgische bieren',
      amount: 500,
      unit: 'g',
      add_moment: 'koken',
      boil_time_min: 15,
    },
  ],
  mash_schedule: {
    steps: [
      { step_nr: 1, temperature_c: 62, duration_min: 40 },
      { step_nr: 2, temperature_c: 72, duration_min: 20 },
      { step_nr: 3, temperature_c: 78, duration_min: 5 },
    ],
  },
  fermentation_schedule: {
    steps: [
      { step_nr: 1, temperature_c: 20, duration_days: 10 },
      { step_nr: 2, temperature_c: 23, duration_days: 5 },
      { step_nr: 3, temperature_c: 12, duration_days: 14 },
    ],
  },
};

export const ReceptIdParams = z
  .object({
    id: z.coerce.number().int().positive().meta({ description: 'Id van het recept', example: 2 }),
  })
  .meta({ example: { id: 2 } });

// ----- Antwoorden -----

const summaryFields = {
  id: z.number().int(),
  name: z.string(),
  beer_style: z.string().nullable(),
  description: z.string().nullable(),
};

export const RecipeSummary = z.object(summaryFields).meta({ example: tripelSummary });

export const RecipeList = z.array(RecipeSummary).meta({ example: [tripelSummary] });

export const RecipeIngredient = z
  .object({
    ingredient_id: z.number().int().meta({ description: 'Id in de catalogus (GET /api/ingredients)' }),
    name: z.string(),
    manufacturer: z.string().nullable(),
    amount_g: z.number().meta({ description: 'Hoeveelheid in gram' }),
  })
  .meta({ example: pilsnerMalt });

export const RecipeIngredientList = z.array(RecipeIngredient).meta({ example: [pilsnerMalt] });

const hopAddition = z.object({
  id: z.number().int().meta({ description: 'Id van de hopgift binnen dit recept' }),
  hop_id: z.number().int().meta({ description: 'Id van de hop in de catalogus' }),
  name: z.string(),
  alpha_acid_percentage: z.number().nullable(),
  type: z.number().int().meta({ description: '0 = bloemen, 1 = pellet' }),
  origin: z.string().nullable(),
  amount_g: z.number().meta({ description: 'Hoeveelheid in gram' }),
  boil_time_min: z.number().int().meta({ description: 'Hoe lang de hop meekookt, in minuten' }),
});

const recipeExtra = z.object({
  extra_ingredient_id: z.number().int().meta({ description: 'Id van het extra ingrediënt in de catalogus' }),
  name: z.string(),
  description: z.string().nullable(),
  amount: z.number(),
  unit: z.string(),
  add_moment: z.enum(['beslag', 'koken']),
  boil_time_min: z.number().int().nullable().meta({ description: 'Alleen bij add_moment "koken"' }),
});

export const Recipe = z
  .object({
    ...summaryFields,
    created_at: z.string().meta({ description: 'Tijdstip in het formaat "JJJJ-MM-DD uu:mm:ss"' }),
    updated_at: z.string().meta({ description: 'Tijdstip in het formaat "JJJJ-MM-DD uu:mm:ss"' }),
    water: z.object({ mash_water_l: z.number(), sparge_water_l: z.number() }).nullable(),
    ingredients: z.array(RecipeIngredient),
    hops: z.array(hopAddition),
    extras: z.array(recipeExtra),
    mash_schedule: z.object({
      steps: z.array(z.object({ step_nr: z.number().int(), temperature_c: z.number(), duration_min: z.number().int() })),
    }),
    fermentation_schedule: z.object({
      steps: z.array(z.object({ step_nr: z.number().int(), temperature_c: z.number(), duration_days: z.number().int() })),
    }),
  })
  .meta({ example: tripel });

// ----- Hopgiften van een recept: /api/recipes/{id}/hops (SCRUM-52) -----
// De invoer (HopAdditionInput) staat verder, bij de invoer van het volledige recept.

const saazGift = {
  id: 7,
  hop_id: 3,
  name: 'Saaz',
  alpha_acid_percentage: 3.5,
  type: 1,
  origin: 'Czech Republic',
  amount_g: 45,
  boil_time_min: 60,
};

export const HopAdditionParams = z
  .object({
    id: z.coerce.number().int().positive().meta({ description: 'Id van het recept', example: 2 }),
    hopAdditionId: z.coerce.number().int().positive().meta({ description: 'Id van de hopgift', example: 4 }),
  })
  .meta({ example: { id: 2, hopAdditionId: 4 } });

export const HopAdditionResponse = hopAddition.meta({ example: saazGift });

export const HopAdditionList = z
  .array(hopAddition)
  .meta({ example: [saazGift, { ...saazGift, id: 8, amount_g: 20, boil_time_min: 10 }] });

// ----- Invoer voor POST /api/recipes en PUT /api/recipes/{id} (SCRUM-56) -----

const optionalText = (max: number, veld: string) =>
  z
    .string()
    .trim()
    .max(max, `${veld} mag maximaal ${max} tekens lang zijn`)
    .nullable()
    .optional()
    .transform((waarde) => (waarde ? waarde : null));

const ingredientInput = z
  .object({
    ingredient_id: z.number().int().positive().meta({ description: 'Id uit de catalogus (GET /api/ingredients)' }),
    amount_g: z.number().positive('hoeveelheid moet groter zijn dan 0 g').max(100000, 'hoeveelheid mag maximaal 100 kg zijn'),
  })
  .strict();

const hopInput = z
  .object({
    hop_id: z.number().int().positive().meta({ description: 'Id van de hop in de catalogus' }),
    amount_g: z.number().positive('hoeveelheid moet groter zijn dan 0 g').max(5000, 'hoeveelheid mag maximaal 5000 g zijn'),
    boil_time_min: z.number().int().min(0, 'kooktijd mag niet negatief zijn').max(180, 'kooktijd mag maximaal 180 minuten zijn'),
  })
  .strict();

// Eén hopgift voor POST /api/recipes/{id}/hops en PUT /api/recipes/{id}/hops/{hopAdditionId}.
export const HopAdditionInput = hopInput.meta({ example: { hop_id: 3, amount_g: 45, boil_time_min: 60 } });

const extraInput = z
  .object({
    extra_ingredient_id: z.number().int().positive().meta({ description: 'Id van het extra ingrediënt in de catalogus' }),
    amount: z.number().positive('hoeveelheid moet groter zijn dan 0'),
    add_moment: z.enum(['beslag', 'koken']),
    boil_time_min: z.number().int().min(0).max(180).nullable().optional().transform((waarde) => waarde ?? null),
  })
  .strict()
  .superRefine((regel, ctx) => {
    if (regel.add_moment === 'koken' && regel.boil_time_min === null) {
      ctx.addIssue({ code: 'custom', path: ['boil_time_min'], message: 'kooktijd is verplicht bij add_moment "koken"' });
    }
    if (regel.add_moment === 'beslag' && regel.boil_time_min !== null) {
      ctx.addIssue({ code: 'custom', path: ['boil_time_min'], message: 'een kooktijd hoort alleen bij add_moment "koken"' });
    }
  });

const mashStepInput = z
  .object({
    temperature_c: z.number().min(20, 'temperatuur moet tussen 20 en 80 °C liggen').max(80, 'temperatuur moet tussen 20 en 80 °C liggen'),
    duration_min: z.number().int().min(1, 'duur moet tussen 1 en 240 minuten liggen').max(240, 'duur moet tussen 1 en 240 minuten liggen'),
  })
  .strict();

const fermentationStepInput = z
  .object({
    temperature_c: z.number().min(0, 'temperatuur moet tussen 0 en 30 °C liggen').max(30, 'temperatuur moet tussen 0 en 30 °C liggen'),
    duration_days: z.number().int().min(1, 'duur moet tussen 1 en 90 dagen liggen').max(90, 'duur moet tussen 1 en 90 dagen liggen'),
  })
  .strict();

// Een ingrediënt of extra ingrediënt mag maar één keer in een recept voorkomen (de database laat geen dubbels toe).
function noDuplicates<T>(lijst: T[], sleutel: (regel: T) => number, veld: string, ctx: z.RefinementCtx) {
  const gezien = new Set<number>();
  lijst.forEach((regel, i) => {
    const id = sleutel(regel);
    if (gezien.has(id)) ctx.addIssue({ code: 'custom', path: [veld, i], message: `id ${id} komt meer dan één keer voor` });
    gezien.add(id);
  });
}

const recipeInputExample = {
  name: 'Gouden Tripel',
  beer_style: 'Belgische Tripel',
  description: 'Klassieke krachtige blondine met fruitige esters en een volle, warme afdronk.',
  water: { mash_water_l: 20, sparge_water_l: 14 },
  ingredients: [
    { ingredient_id: 1, amount_g: 5500 },
    { ingredient_id: 3, amount_g: 800 },
  ],
  hops: [
    { hop_id: 4, amount_g: 35, boil_time_min: 60 },
    { hop_id: 3, amount_g: 25, boil_time_min: 15 },
  ],
  extras: [{ extra_ingredient_id: 2, amount: 500, add_moment: 'koken', boil_time_min: 15 }],
  mash_schedule: {
    steps: [
      { temperature_c: 62, duration_min: 40 },
      { temperature_c: 72, duration_min: 20 },
    ],
  },
  fermentation_schedule: { steps: [{ temperature_c: 20, duration_days: 10 }] },
};

export const RecipeInput = z
  .object({
    name: z.string().trim().min(1, 'naam is verplicht').max(100, 'naam mag maximaal 100 tekens lang zijn'),
    beer_style: optionalText(50, 'bierstijl'),
    description: optionalText(1000, 'beschrijving'),
    water: z
      .object({
        mash_water_l: z.number().positive('maischwater moet groter zijn dan 0 liter').max(500),
        sparge_water_l: z.number().min(0, 'spoelwater mag niet negatief zijn').max(500),
      })
      .strict()
      .nullable()
      .optional()
      .transform((waarde) => waarde ?? null),
    ingredients: z.array(ingredientInput).default([]),
    hops: z.array(hopInput).default([]),
    extras: z.array(extraInput).default([]),
    mash_schedule: z.object({ steps: z.array(mashStepInput) }).strict().default({ steps: [] }),
    fermentation_schedule: z.object({ steps: z.array(fermentationStepInput) }).strict().default({ steps: [] }),
  })
  .strict()
  .superRefine((recept, ctx) => {
    noDuplicates(recept.ingredients, (regel) => regel.ingredient_id, 'ingredients', ctx);
    noDuplicates(recept.extras, (regel) => regel.extra_ingredient_id, 'extras', ctx);
  })
  .meta({ example: recipeInputExample });

// Maischschema: de maischstappen, met de veldnamen van het datamodel.
// De foutmeldingen noemen de stap (vanaf 1) en het veld.

const mashScheduleInputExample = {
  steps: [
    { temperature: 63, duration: 45 },
    { temperature: 72, duration: 20 },
  ],
};

// Het antwoord is de invoer plus recipe_id en step_nr; zo staat elke waarde maar één keer hier.
const mashScheduleExample = {
  recipe_id: 2,
  steps: mashScheduleInputExample.steps.map((step, i) => ({ step_nr: i + 1, ...step })),
};

// Foutmelding voor een veld van een stap, bv. "stap 2: temperature moet tussen 20 en 80 °C liggen (gekregen: 90)".
function stepError(text: string) {
  return (issue: { path?: PropertyKey[]; input?: unknown }) => {
    const index = issue.path?.find((part) => typeof part === 'number');
    const step = index === undefined ? 'stap' : `stap ${index + 1}`;
    return `${step}: ${text}${received(issue.input)}`;
  };
}

function received(input: unknown): string {
  return input === undefined ? '' : ` (gekregen: ${JSON.stringify(input)})`;
}

const MashStepInput = z.object({
  temperature: z
    .number({ error: stepError('temperature ontbreekt of is geen getal') })
    .min(20, { error: stepError('temperature moet tussen 20 en 80 °C liggen') })
    .max(80, { error: stepError('temperature moet tussen 20 en 80 °C liggen') })
    .meta({ description: 'Temperatuur in °C, van 20 tot en met 80' }),
  duration: z
    .number({ error: stepError('duration ontbreekt of is geen getal') })
    .int({ error: stepError('duration moet een geheel aantal minuten zijn') })
    .min(1, { error: stepError('duration moet tussen 1 en 240 minuten liggen') })
    .max(240, { error: stepError('duration moet tussen 1 en 240 minuten liggen') })
    .meta({ description: 'Duur in minuten, van 1 tot en met 240' }),
});

export const MashScheduleInput = z
  .object({
    steps: z
      .array(MashStepInput, { error: 'steps moet een lijst zijn' })
      .min(1, { error: 'steps moet minstens één stap bevatten' })
      .meta({ description: 'De maischstappen in uitvoeringsvolgorde; de back-end nummert ze vanaf 1 (step_nr)' }),
  })
  .meta({ example: mashScheduleInputExample });

export const MashSchedule = z
  .object({
    recipe_id: z.number().int(),
    steps: z.array(
      z.object({
        step_nr: z.number().int().meta({ description: 'Volgnummer, vanaf 1' }),
        temperature: z.number().meta({ description: 'Temperatuur in °C' }),
        duration: z.number().int().meta({ description: 'Duur in minuten' }),
      }),
    ),
  })
  .meta({ example: mashScheduleExample });
