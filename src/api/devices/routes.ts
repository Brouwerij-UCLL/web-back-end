import { getDevice, getDevices } from '../../database/devices/queries.ts';
import { createRoutes, HttpFout } from '../openapi/route.ts';
import { Device, DeviceList, DeviceParams } from './schemas.ts';

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
