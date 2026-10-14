import { z } from 'zod';

// Het formaat van elk foutantwoord van de API.
export const FoutSchema = z
  .object({
    fout: z.string().meta({ description: 'Leesbare omschrijving van de fout' }),
  })
  .meta({ example: { fout: 'recept 99 niet gevonden' } });
