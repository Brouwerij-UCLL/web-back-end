import { z } from 'zod';

export const FoutVeldSchema = z
  .object({
    veld: z.string().meta({ description: 'Pad naar het ongeldige veld, bv. stappen[1].temperatuur_celsius' }),
    melding: z.string().meta({ description: 'Nederlandstalige melding met uitleg en toegestane waarde' }),
  })
  .meta({
    example: {
      veld: 'stappen[1].temperatuur_celsius',
      melding: 'temperatuur moet tussen 20 en 80 °C liggen',
    },
  });

// Het formaat van elk foutantwoord van de API.
export const FoutSchema = z
  .object({
    fout: z.string().meta({ description: 'Leesbare omschrijving van de fout' }),
    velden: z.array(FoutVeldSchema).optional().meta({ description: 'Optionele lijst met ongeldige velden en bijbehorende meldingen' }),
  })
  .meta({
    example: {
      fout: 'Het recept bevat ongeldige gegevens',
      velden: [
        { veld: 'naam', melding: 'naam is verplicht' },
        { veld: 'stappen[1].temperatuur_celsius', melding: 'temperatuur moet tussen 20 en 80 °C liggen' },
      ],
    },
  });
