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
const tripelDetails = {
  ...tripel,
  water: { maischwater_liter: 20, spoelwater_liter: 14 },
  ingredienten: [
    { ingredient_id: 1, naam: 'Pilsner Malt', fabrikant: 'Dingemans', hoeveelheid_g: 5500 },
    { ingredient_id: 3, naam: 'Wheat Malt (Tarwemout)', fabrikant: 'Dingemans', hoeveelheid_g: 800 },
    { ingredient_id: 7, naam: 'CaraPils', fabrikant: 'Dingemans', hoeveelheid_g: 200 },
  ],
  vergistbaar: [
    { id: 1, naam: 'Pilsner Malt', fabrikant: 'Dingemans', hoeveelheid_kg: 5.5 },
  ],
  hop: [
    {
      id: 1,
      hop_id: 4,
      naam: 'Styrian Goldings',
      alfazuur_percentage: 5.2,
      type: 1,
      herkomst: 'Slovenia',
      hoeveelheid_gram: 35,
      kooktijd_minuten: 60,
    },
  ],
  extra: [
    {
      id: 2,
      naam: 'Kandijsuiker (Wit)',
      omschrijving: 'Voor hogere vergistingsgraad in zware Belgische bieren',
      hoeveelheid: 500,
      eenheid: 'g',
      toevoegmoment: 'koken',
      kooktijd_minuten: 15,
    },
  ],
  maischschema: {
    stappen: [
      { stap_volgorde: 1, temperatuur_celsius: 62, duur_minuten: 40 },
      { stap_volgorde: 2, temperatuur_celsius: 72, duur_minuten: 20 },
      { stap_volgorde: 3, temperatuur_celsius: 78, duur_minuten: 5 },
    ],
  },
  vergistingsschema: {
    stappen: [
      { stap_volgorde: 1, temperatuur_celsius: 20, duur_dagen: 10 },
      { stap_volgorde: 2, temperatuur_celsius: 23, duur_dagen: 5 },
      { stap_volgorde: 3, temperatuur_celsius: 12, duur_dagen: 14 },
    ],
  },
};

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

const waterVelden = {
  maischwater_liter: z.number(),
  spoelwater_liter: z.number(),
};

const vergistbaarVelden = {
  id: z.number().int(),
  naam: z.string(),
  fabrikant: z.string().nullable(),
  hoeveelheid_kg: z.number(),
};

const hopVelden = {
  id: z.number().int().meta({ description: 'Id van de hopgift binnen dit recept' }),
  hop_id: z.number().int().meta({ description: 'Id van de hop in de catalogus' }),
  naam: z.string(),
  alfazuur_percentage: z.number().nullable(),
  type: z.number().int(),
  herkomst: z.string().nullable(),
  hoeveelheid_gram: z.number(),
  kooktijd_minuten: z.number().int(),
};

const extraVelden = {
  id: z.number().int(),
  naam: z.string(),
  omschrijving: z.string().nullable(),
  hoeveelheid: z.number(),
  eenheid: z.string(),
  toevoegmoment: z.enum(['beslag', 'koken']),
  kooktijd_minuten: z.number().int().nullable(),
};

const maischstapVelden = {
  stap_volgorde: z.number().int(),
  temperatuur_celsius: z.number(),
  duur_minuten: z.number().int(),
};

const vergistingsstapVelden = {
  stap_volgorde: z.number().int(),
  temperatuur_celsius: z.number(),
  duur_dagen: z.number().int(),
};

export const Ingredient = z
  .object({
    ingredient_id: z.number().int(),
    naam: z.string(),
    fabrikant: z.string().nullable(),
    hoeveelheid_g: z.number().meta({ description: 'Hoeveelheid in gram' }),
  })
  .meta({ example: pilsnerMout });

const receptDetailsVelden = {
  ...receptVelden,
  water: z.object(waterVelden).nullable(),
  ingredienten: z.array(Ingredient),
  vergistbaar: z.array(z.object(vergistbaarVelden)),
  hop: z.array(z.object(hopVelden)),
  extra: z.array(z.object(extraVelden)),
  maischschema: z.object({ stappen: z.array(z.object(maischstapVelden)) }),
  vergistingsschema: z.object({ stappen: z.array(z.object(vergistingsstapVelden)) }),
};

export const Recept = z.object(receptDetailsVelden).meta({ example: tripelDetails });

export const IngredientenLijst = z.array(Ingredient).meta({ example: [pilsnerMout] });

export const ReceptMetIngredienten = z
  .object(receptDetailsVelden)
  .meta({ example: tripelDetails });

// ----- Invoer voor POST /api/recepten en PUT /api/recepten/{id} (SCRUM-56) -----

const optioneleTekst = (max: number, veld: string) =>
  z
    .string()
    .trim()
    .max(max, `${veld} mag maximaal ${max} tekens lang zijn`)
    .nullable()
    .optional()
    .transform((waarde) => (waarde ? waarde : null));

const ingredientRegel = z
  .object({
    ingredient_id: z.number().int().positive().meta({ description: 'Id uit de catalogus (GET /api/ingredients)' }),
    hoeveelheid_g: z.number().positive('hoeveelheid moet groter zijn dan 0 g').max(100000, 'hoeveelheid mag maximaal 100 kg zijn'),
  })
  .strict();

const hopRegel = z
  .object({
    hop_id: z.number().int().positive().meta({ description: 'Id van de hop in de catalogus' }),
    hoeveelheid_gram: z.number().positive('hoeveelheid moet groter zijn dan 0 g').max(5000, 'hoeveelheid mag maximaal 5000 g zijn'),
    kooktijd_minuten: z.number().int().min(0, 'kooktijd mag niet negatief zijn').max(180, 'kooktijd mag maximaal 180 minuten zijn'),
  })
  .strict();

const extraRegel = z
  .object({
    extra_ingredient_id: z.number().int().positive().meta({ description: 'Id van het extra ingrediënt in de catalogus' }),
    hoeveelheid: z.number().positive('hoeveelheid moet groter zijn dan 0'),
    toevoegmoment: z.enum(['beslag', 'koken']),
    kooktijd_minuten: z.number().int().min(0).max(180).nullable().optional().transform((waarde) => waarde ?? null),
  })
  .strict()
  .superRefine((regel, ctx) => {
    if (regel.toevoegmoment === 'koken' && regel.kooktijd_minuten === null) {
      ctx.addIssue({ code: 'custom', path: ['kooktijd_minuten'], message: 'kooktijd is verplicht bij toevoegmoment "koken"' });
    }
    if (regel.toevoegmoment === 'beslag' && regel.kooktijd_minuten !== null) {
      ctx.addIssue({ code: 'custom', path: ['kooktijd_minuten'], message: 'een kooktijd hoort alleen bij toevoegmoment "koken"' });
    }
  });

const maischstapRegel = z
  .object({
    temperatuur_celsius: z.number().min(20, 'temperatuur moet tussen 20 en 80 °C liggen').max(80, 'temperatuur moet tussen 20 en 80 °C liggen'),
    duur_minuten: z.number().int().min(1, 'duur moet tussen 1 en 240 minuten liggen').max(240, 'duur moet tussen 1 en 240 minuten liggen'),
  })
  .strict();

const vergistingsstapRegel = z
  .object({
    temperatuur_celsius: z.number().min(0, 'temperatuur moet tussen 0 en 30 °C liggen').max(30, 'temperatuur moet tussen 0 en 30 °C liggen'),
    duur_dagen: z.number().int().min(1, 'duur moet tussen 1 en 90 dagen liggen').max(90, 'duur moet tussen 1 en 90 dagen liggen'),
  })
  .strict();

// Een ingrediënt of extra ingrediënt mag maar één keer in een recept voorkomen (de database laat geen dubbels toe).
function geenDubbels<T>(lijst: T[], sleutel: (regel: T) => number, veld: string, ctx: z.RefinementCtx) {
  const gezien = new Set<number>();
  lijst.forEach((regel, i) => {
    const id = sleutel(regel);
    if (gezien.has(id)) ctx.addIssue({ code: 'custom', path: [veld, i], message: `id ${id} komt meer dan één keer voor` });
    gezien.add(id);
  });
}

const receptInvoerVoorbeeld = {
  naam: 'Gouden Tripel',
  bierstijl: 'Belgische Tripel',
  beschrijving: 'Klassieke krachtige blondine met fruitige esters en een volle, warme afdronk.',
  water: { maischwater_liter: 20, spoelwater_liter: 14 },
  ingredienten: [
    { ingredient_id: 1, hoeveelheid_g: 5500 },
    { ingredient_id: 3, hoeveelheid_g: 800 },
  ],
  hop: [
    { hop_id: 4, hoeveelheid_gram: 35, kooktijd_minuten: 60 },
    { hop_id: 3, hoeveelheid_gram: 25, kooktijd_minuten: 15 },
  ],
  extra: [{ extra_ingredient_id: 2, hoeveelheid: 500, toevoegmoment: 'koken', kooktijd_minuten: 15 }],
  maischschema: {
    stappen: [
      { temperatuur_celsius: 62, duur_minuten: 40 },
      { temperatuur_celsius: 72, duur_minuten: 20 },
    ],
  },
  vergistingsschema: { stappen: [{ temperatuur_celsius: 20, duur_dagen: 10 }] },
};

export const ReceptInvoer = z
  .object({
    naam: z.string().trim().min(1, 'naam is verplicht').max(100, 'naam mag maximaal 100 tekens lang zijn'),
    bierstijl: optioneleTekst(50, 'bierstijl'),
    beschrijving: optioneleTekst(1000, 'beschrijving'),
    water: z
      .object({
        maischwater_liter: z.number().positive('maischwater moet groter zijn dan 0 liter').max(500),
        spoelwater_liter: z.number().min(0, 'spoelwater mag niet negatief zijn').max(500),
      })
      .strict()
      .nullable()
      .optional()
      .transform((waarde) => waarde ?? null),
    ingredienten: z.array(ingredientRegel).default([]),
    hop: z.array(hopRegel).default([]),
    extra: z.array(extraRegel).default([]),
    maischschema: z.object({ stappen: z.array(maischstapRegel) }).strict().default({ stappen: [] }),
    vergistingsschema: z.object({ stappen: z.array(vergistingsstapRegel) }).strict().default({ stappen: [] }),
  })
  .strict()
  .superRefine((recept, ctx) => {
    geenDubbels(recept.ingredienten, (regel) => regel.ingredient_id, 'ingredienten', ctx);
    geenDubbels(recept.extra, (regel) => regel.extra_ingredient_id, 'extra', ctx);
  })
  .meta({ example: receptInvoerVoorbeeld });
