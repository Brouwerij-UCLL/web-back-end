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

export const Recept = z.object(receptVelden).meta({ example: tripel });

export const Ingredient = z
  .object({
    ingredient_id: z.number().int(),
    naam: z.string(),
    fabrikant: z.string().nullable(),
    hoeveelheid_g: z.number().meta({ description: 'Hoeveelheid in gram' }),
  })
  .meta({ example: pilsnerMout });

export const IngredientenLijst = z.array(Ingredient).meta({ example: [pilsnerMout] });

export const ReceptMetIngredienten = z
  .object({ ...receptVelden, ingredienten: z.array(Ingredient) })
  .meta({ example: { ...tripel, ingredienten: [pilsnerMout] } });

// Maischschema: stappen + kooktijd. De foutmeldingen noemen de stap (vanaf 1) en het veld.

const maischschemaInvoer = {
  kooktijd_minuten: 60,
  stappen: [
    { temperatuur_celsius: 63, duur_minuten: 45 },
    { temperatuur_celsius: 72, duur_minuten: 20 },
  ],
};

const maischschema = {
  recept_id: 2,
  kooktijd_minuten: 60,
  stappen: [
    { stap_volgorde: 1, temperatuur_celsius: 63, duur_minuten: 45 },
    { stap_volgorde: 2, temperatuur_celsius: 72, duur_minuten: 20 },
  ],
};

// Foutmelding voor een veld van een stap, bv. "stap 2: temperatuur moet tussen 20 en 80 °C liggen (gekregen: 90)".
function stapFout(tekst: string) {
  return (issue: { path?: PropertyKey[]; input?: unknown }) => {
    const index = issue.path?.find((deel) => typeof deel === 'number');
    const stap = index === undefined ? 'stap' : `stap ${index + 1}`;
    return `${stap}: ${tekst}${issue.input === undefined ? '' : ` (gekregen: ${JSON.stringify(issue.input)})`}`;
  };
}

function kooktijdFout(tekst: string) {
  return (issue: { input?: unknown }) => `${tekst}${issue.input === undefined ? '' : ` (gekregen: ${JSON.stringify(issue.input)})`}`;
}

const MaischstapInvoer = z.object({
  temperatuur_celsius: z
    .number({ error: stapFout('temperatuur ontbreekt of is geen getal') })
    .min(20, { error: stapFout('temperatuur moet tussen 20 en 80 °C liggen') })
    .max(80, { error: stapFout('temperatuur moet tussen 20 en 80 °C liggen') })
    .meta({ description: 'Temperatuur in °C, van 20 tot en met 80' }),
  duur_minuten: z
    .number({ error: stapFout('duur ontbreekt of is geen getal') })
    .int({ error: stapFout('duur moet een geheel aantal minuten zijn') })
    .min(1, { error: stapFout('duur moet tussen 1 en 240 minuten liggen') })
    .max(240, { error: stapFout('duur moet tussen 1 en 240 minuten liggen') })
    .meta({ description: 'Duur in minuten, van 1 tot en met 240' }),
});

export const MaischschemaInvoer = z
  .object({
    kooktijd_minuten: z
      .number({ error: kooktijdFout('ontbreekt of is geen getal') })
      .int({ error: kooktijdFout('moet een geheel aantal minuten zijn') })
      .min(1, { error: kooktijdFout('moet tussen 1 en 180 minuten liggen') })
      .max(180, { error: kooktijdFout('moet tussen 1 en 180 minuten liggen') })
      .meta({ description: 'Kooktijd in minuten, van 1 tot en met 180' }),
    stappen: z
      .array(MaischstapInvoer, { error: 'stappen moet een lijst zijn' })
      .min(1, { error: 'stappen moet minstens één stap bevatten' })
      .meta({ description: 'De maischstappen in uitvoeringsvolgorde; de back-end nummert ze vanaf 1' }),
  })
  .meta({ example: maischschemaInvoer });

export const Maischschema = z
  .object({
    recept_id: z.number().int(),
    kooktijd_minuten: z.number().int().nullable().meta({ description: 'Kooktijd in minuten; null als er nog geen is ingesteld' }),
    stappen: z.array(
      z.object({
        stap_volgorde: z.number().int().meta({ description: 'Volgnummer, vanaf 1' }),
        temperatuur_celsius: z.number(),
        duur_minuten: z.number().int(),
      }),
    ),
  })
  .meta({ example: maischschema });
