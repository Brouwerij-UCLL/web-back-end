import { randomBytes } from 'node:crypto';
import { z } from 'zod';

// Opdrachten van de back-end naar één toestel: brouwer/<mac>/cmd/<opdracht> met {"message_id", "data"}.
// Het toestel antwoordt op brouwer/<mac>/ack met dezelfde message_id. Zo gaat een recept naar precies
// het toestel met dat MAC-adres (bv. de brouwketel of de vergistingsketel), niet naar alle toestellen.

export const ACK_TIMEOUT_MS = 10_000;

export type Publiceer = (topic: string, payload: string, qos: 0 | 1 | 2) => Promise<void>;

export type AckResultaat = { message_id: string; ok: true } | { message_id: string; ok: false; fout: string };

export class GeenBrokerFout extends Error {}
export class AckTimeoutFout extends Error {}

let publiceer: Publiceer | undefined;

// De MQTT-client zet hier hoe er gepubliceerd wordt (undefined zolang er geen verbinding is). Tests zetten een nep-versie.
export function setPublisher(nieuw: Publiceer | undefined): void {
  publiceer = nieuw;
}

type Wachtend = { mac: string; klaar: (resultaat: AckResultaat) => void };
const wachtend = new Map<string, Wachtend>();

// Publiceert de opdracht en wacht op de ack van dat toestel (of geeft na timeoutMs een AckTimeoutFout).
export async function stuurOpdracht(
  mac: string,
  opdracht: string,
  data: unknown,
  { qos = 1, timeoutMs = ACK_TIMEOUT_MS }: { qos?: 1 | 2; timeoutMs?: number } = {},
): Promise<AckResultaat> {
  if (!publiceer) throw new GeenBrokerFout('geen verbinding met de MQTT-broker');
  const message_id = randomBytes(4).toString('hex');

  let timer: NodeJS.Timeout | undefined;
  const antwoord = new Promise<AckResultaat>((resolve, reject) => {
    timer = setTimeout(() => {
      wachtend.delete(message_id);
      reject(new AckTimeoutFout(`geen bevestiging van toestel ${mac} binnen ${timeoutMs / 1000} s`));
    }, timeoutMs);
    wachtend.set(message_id, { mac, klaar: resolve });
  });

  try {
    await publiceer(`brouwer/${mac}/cmd/${opdracht}`, JSON.stringify({ message_id, data }), qos);
    return await antwoord;
  } catch (error) {
    if (error instanceof AckTimeoutFout) throw error;
    throw new GeenBrokerFout(`versturen naar de MQTT-broker mislukt: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
    wachtend.delete(message_id);
  }
}

const AckBericht = z.object({ message_id: z.string().min(1), ok: z.boolean(), fout: z.string().optional() });

// brouwer/<mac>/ack: {"message_id", "ok"} en bij ok=false een "fout". Alleen een ack van het juiste toestel telt.
export function verwerkAck(mac: string, payload: string): void {
  let ack: z.infer<typeof AckBericht>;
  try {
    ack = AckBericht.parse(JSON.parse(payload));
  } catch {
    console.warn(`[ACK] ${mac}: onleesbare bevestiging, genegeerd`);
    return;
  }
  const opdracht = wachtend.get(ack.message_id);
  if (!opdracht || opdracht.mac !== mac) {
    console.warn(`[ACK] ${mac}: onbekende message_id ${ack.message_id}, genegeerd`);
    return;
  }
  opdracht.klaar(
    ack.ok
      ? { message_id: ack.message_id, ok: true }
      : { message_id: ack.message_id, ok: false, fout: ack.fout ?? 'onbekende fout' },
  );
}
