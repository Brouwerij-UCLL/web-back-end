import { Router, type Request, type Response } from 'express';
import { getDevices } from '../database/devices/queries.ts';
import { gebeurtenissen, type Gebeurtenissen } from '../events.ts';

// Live updates voor de front-end met Server-Sent Events (EventSource in de browser) op GET /api/events.
// Bij het verbinden komt eerst een snapshot met alle toestellen, daarna elke wijziging:
//   event: snapshot        data: {"devices": [...]}
//   event: device.status   data: {"mac": "...", "online": true, "last_seen": "..."}
//   event: device.updated  data: { het volledige toestel, zoals GET /api/devices/{mac} }
//   event: device.removed  data: {"mac": "..."}
//   event: meting          data: {"mac", "sensor", "value", "unit", "at"}
//   event: actuator.state  data: {"mac", "actuator", "state", "at"}
//   event: fout            data: {"mac", "code", "message", "at"}

export const eventsRouter = Router();

// Een commentaarregel om de zoveel tijd houdt de verbinding open langs proxy's.
const HARTSLAG_MS = 25_000;

const doorgestuurd = ['device.status', 'device.updated', 'device.removed', 'meting', 'actuator.state', 'fout'] as const satisfies (keyof Gebeurtenissen)[];

function stuur(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

eventsRouter.get('/', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx: niet bufferen
  });
  // Na een weggevallen verbinding probeert de browser het na 3 s opnieuw en krijgt hij een nieuwe snapshot.
  res.write('retry: 3000\n\n');
  stuur(res, 'snapshot', { devices: getDevices() });

  const luisteraars = doorgestuurd.map((event) => {
    const luisteraar = (data: unknown) => stuur(res, event, data);
    gebeurtenissen.on(event, luisteraar);
    return () => gebeurtenissen.off(event, luisteraar);
  });
  const hartslag = setInterval(() => res.write(': ping\n\n'), HARTSLAG_MS);

  req.on('close', () => {
    clearInterval(hartslag);
    for (const stop of luisteraars) stop();
  });
});
