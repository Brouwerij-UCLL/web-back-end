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
  id: z.number().int(),
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
