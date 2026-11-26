// Topics waarop de back-end luistert: brouwer/<brouwerId>/... (brouwerId = MAC-adres van het toestel)
export const subscribedTopics = [
  'brouwer/+/info',
  'brouwer/+/sensor/+',
  'brouwer/+/actuator/+/state',
  'brouwer/+/status',
  'brouwer/+/fout',
  'brouwer/+/ack',
];

// Status van de back-end zelf (retained): "online", of "offline" als last will. Toestellen kunnen erop
// abonneren om te weten of de back-end er is.
export const BACKEND_STATUS_ID = 'server';
export const BACKEND_STATUS_TOPIC = `brouwer/${BACKEND_STATUS_ID}/status`;

export type ParsedTopic = {
  brouwerId: string;
  hoofdtype: string;
  naam: string | undefined;
};

// Splitst bv. "brouwer/3/sensor/temperatuur" in brouwerId "3", hoofdtype "sensor" en naam "temperatuur".
export function parseTopic(topic: string): ParsedTopic {
  const [, brouwerId = '', hoofdtype = '', naam] = topic.split('/');
  return { brouwerId, hoofdtype, naam };
}
