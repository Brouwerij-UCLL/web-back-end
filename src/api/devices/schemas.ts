import { z } from 'zod';

const ketel = {
  mac: 'a4cf12b3c8e0',
  type: 'ketel',
  name: 'Brouwketel 1',
  firmware: '1.0.0',
  online: true,
  last_seen: '2026-11-18 14:05:12',
  sensors: [{ name: 'temperatuur', unit: '°C', value: 66.8, updated_at: '2026-11-18 14:05:10' }],
  actuators: [
    { name: 'verwarming', values: ['on', 'off'], state: 'on', updated_at: '2026-11-18 14:04:55' },
    { name: 'roerwerk', values: ['on', 'off'], state: null, updated_at: null },
  ],
  commands: ['setpoint', 'actuator', 'recept'],
};

export const DeviceParams = z
  .object({
    mac: z
      .string()
      .regex(/^[0-9a-fA-F]{12}$/, 'mac moet 12 hexadecimale tekens zijn, zonder dubbelpunten')
      .transform((mac) => mac.toLowerCase())
      .meta({ description: 'MAC-adres van het toestel, 12 hexadecimale tekens zonder dubbelpunten', example: 'a4cf12b3c8e0' }),
  })
  .meta({ example: { mac: 'a4cf12b3c8e0' } });

export const Device = z
  .object({
    mac: z.string().meta({ description: 'MAC-adres, ook het id in de MQTT-topics (brouwer/<mac>/…)' }),
    type: z.string().nullable().meta({ description: 'Soort toestel uit het info-bericht, bv. ketel of kast; null zolang er geen info is' }),
    name: z.string().nullable(),
    firmware: z.string().nullable(),
    online: z.boolean().meta({ description: 'Laatst gemelde status; offline ook via de last will van het toestel' }),
    last_seen: z.string().nullable().meta({ description: 'Tijdstip van het laatste info- of statusbericht' }),
    sensors: z.array(
      z.object({
        name: z.string(),
        unit: z.string().optional(),
        value: z.number().nullable().meta({ description: 'Laatst gemeten waarde; null zolang er geen meting is' }),
        updated_at: z.string().nullable(),
      }),
    ),
    actuators: z.array(
      z.object({
        name: z.string(),
        values: z.array(z.string()).optional(),
        state: z.string().nullable().meta({ description: 'Laatst gemelde toestand, bv. on of off; null zolang er geen is' }),
        updated_at: z.string().nullable(),
      }),
    ),
    commands: z.array(z.string()).meta({ description: 'Opdrachten die het toestel begrijpt' }),
  })
  .meta({ example: ketel });

export const SendRecipeInput = z
  .object({ recipe_id: z.number().int().positive().meta({ description: 'Id van het recept dat het toestel moet laden' }) })
  .strict()
  .meta({ example: { recipe_id: 1 } });

export const SendRecipeResult = z
  .object({
    mac: z.string(),
    recipe_id: z.number().int(),
    message_id: z.string().meta({ description: 'Id van de opdracht; het toestel bevestigde met dezelfde message_id' }),
    ok: z.literal(true),
  })
  .meta({ example: { mac: 'a4cf12b3c8e0', recipe_id: 1, message_id: 'b41d07aa', ok: true } });

export const DeviceList = z.array(Device).meta({ example: [ketel] });
