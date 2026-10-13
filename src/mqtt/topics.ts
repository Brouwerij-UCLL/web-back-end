// Topics waarop de back-end luistert: brouwer/<brouwerId>/...
export const subscribedTopics = [
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
