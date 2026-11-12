import { Aedes, type AuthenticateError } from 'aedes';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';

// Eigen MQTT-broker in de back-end (Aedes), zodat ketel en kast niet via een publieke testbroker communiceren.
// Retained berichten, last will en QoS 0, 1 en 2 werken zoals in de MQTT-afspraken met elektronica.

export type BrokerOpties = {
  port: number; // 0 = een vrije poort (voor tests)
  username?: string; // leeg = iedereen mag verbinden
  password?: string;
};

export type Broker = {
  port: number;
  close: () => Promise<void>;
};

// Code 4 uit MQTT 3.1.1: "Bad user name or password".
const BAD_USERNAME_OR_PASSWORD = 4;

export async function startBroker(opties: BrokerOpties): Promise<Broker> {
  const aedes = await Aedes.createBroker({
    authenticate: (_client, username, password, done) => {
      if (!opties.username) return done(null, true);
      if (username === opties.username && password?.toString() === opties.password) return done(null, true);
      const fout = Object.assign(new Error('ongeldige gebruikersnaam of wachtwoord'), {
        returnCode: BAD_USERNAME_OR_PASSWORD,
      }) as AuthenticateError;
      done(fout, false);
    },
  });

  aedes.on('client', (client) => console.log(`[BROKER] ${client.id} verbonden`));
  aedes.on('clientDisconnect', (client) => console.log(`[BROKER] ${client.id} verbroken`));

  const server = createServer(aedes.handle);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opties.port, () => resolve());
  });

  return {
    port: (server.address() as AddressInfo).port,
    close: () => new Promise((resolve) => aedes.close(() => server.close(() => resolve()))),
  };
}
