// Topics waarop de back-end luistert: brouwer/<brouwerId>/... (brouwerId = MAC-adres van het toestel)
export const subscribedTopics = [
  'brouwer/+/info',
  'brouwer/+/sensor/+',
  'brouwer/+/actuator/+/state',
  'brouwer/+/status',
];

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
