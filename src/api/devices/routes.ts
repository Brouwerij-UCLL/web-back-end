import { getDevice, getDevices } from '../../database/devices/queries.ts';
import { getRecept } from '../../database/recepten/queries.ts';
import { AckTimeoutFout, GeenBrokerFout, stuurOpdracht } from '../../mqtt/opdrachten.ts';
import { createRoutes, HttpFout } from '../openapi/route.ts';
import { Device, DeviceList, DeviceParams, SendRecipeInput, SendRecipeResult } from './schemas.ts';

export const devices = createRoutes('/api/devices', 'installatie');

devices.route({
  method: 'get',
  path: '/',
  summary: 'Lijst van alle toestellen',
  description:
    'Alle toestellen die zich via MQTT aanmeldden (brouwer/<mac>/info), met hun laatst gemelde status (brouwer/<mac>/status). ' +
    'Live wijzigingen volgen via /api/events.',
  response: DeviceList,
  responseDescription: 'De toestellen; een lege lijst als er nog geen aangemeld zijn',
  handler: () => getDevices(),
});

devices.route({
  method: 'get',
  path: '/:mac',
  summary: 'Eén toestel',
  params: DeviceParams,
  response: Device,
  responseDescription: 'Het toestel',
  errors: { 404: 'Er is geen toestel met dit MAC-adres' },
  handler: ({ params }) => {
    const device = getDevice(params.mac);
    if (!device) throw new HttpFout(404, `toestel ${params.mac} niet gevonden`);
    return device;
  },
});

devices.route({
  method: 'post',
  path: '/:mac/recipe',
  summary: 'Recept naar een toestel sturen',
  description:
    'Stuurt het volledige recept (zoals GET /api/recipes/{id}: maischema, hop, water, vergistingsschema, ...) naar dit ene toestel ' +
    'op brouwer/<mac>/cmd/recept (QoS 2). Het antwoord komt pas als het toestel bevestigt op brouwer/<mac>/ack, of na 10 seconden.',
  params: DeviceParams,
  body: SendRecipeInput,
  response: SendRecipeResult,
  responseDescription: 'Het toestel heeft het recept geladen',
  errors: {
    404: 'Er is geen toestel met dit MAC-adres of geen recept met dit id',
    409: 'Het toestel is offline of kent de opdracht recept niet',
    502: 'Het toestel antwoordde dat het het recept niet kon laden',
    503: 'De back-end heeft geen verbinding met de MQTT-broker',
    504: 'Het toestel bevestigde niet binnen 10 seconden',
  },
  handler: async ({ params, body }) => {
    const device = getDevice(params.mac);
    if (!device) throw new HttpFout(404, `toestel ${params.mac} niet gevonden`);
    const recept = getRecept(body.recipe_id);
    if (!recept) throw new HttpFout(404, `recept ${body.recipe_id} niet gevonden`);
    if (!device.online) throw new HttpFout(409, `toestel ${params.mac} is offline`);
    if (!device.commands.includes('recept')) throw new HttpFout(409, `toestel ${params.mac} kent de opdracht recept niet`);

    let ack;
    try {
      ack = await stuurOpdracht(params.mac, 'recept', recept, { qos: 2 });
    } catch (error) {
      if (error instanceof GeenBrokerFout) throw new HttpFout(503, error.message);
      if (error instanceof AckTimeoutFout) throw new HttpFout(504, error.message);
      throw error;
    }
    if (!ack.ok) throw new HttpFout(502, `toestel ${params.mac} kon het recept niet laden: ${ack.fout}`);
    return { mac: params.mac, recipe_id: recept.id, message_id: ack.message_id, ok: true as const };
  },
});
