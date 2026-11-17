import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

export type Tag = 'recepten' | 'brouwsessies' | 'installatie' | 'health';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type ValidatieVeld = {
  veld: string;
  melding: string;
};

export type FoutStatus = 400 | 401 | 403 | 404 | 409 | 503;

export class HttpFout extends Error {
  readonly status: FoutStatus;
  readonly velden?: ValidatieVeld[];

  constructor(status: FoutStatus, fout: string, velden?: ValidatieVeld[]) {
    super(fout);
    this.status = status;
    this.velden = velden;
  }
}

export type RouteDefinitie<P extends z.ZodObject, B extends z.ZodType, R extends z.ZodType> = {
  method: Method;
  path: string;
  summary: string;
  description?: string;
  params?: P;
  body?: B;
  status?: 200 | 201;
  response: R;
  responseDescription: string;
  errors?: Partial<Record<FoutStatus, string>>;
  auth?: boolean;
  handler: (input: { params: z.output<P>; body: z.output<B> }) => z.input<R> | Promise<z.input<R>>;
};

export type Operatie = Omit<RouteDefinitie<z.ZodObject, z.ZodType, z.ZodType>, 'handler'> & {
  pad: string;
  tag: Tag;
};

export const operaties: Operatie[] = [];

function padNaarVeld(pad: ReadonlyArray<PropertyKey>): string {
  if (!pad.length) return '';

  let resultaat = '';
  for (const stuk of pad) {
    const waarde = String(stuk);
    if (typeof stuk === 'number') {
      resultaat += `[${waarde}]`;
      continue;
    }
    if (resultaat === '') {
      resultaat = waarde;
      continue;
    }
    resultaat += `.${waarde}`;
  }
  return resultaat;
}

function validatieTekst(issue: any, fallbackPad: string): { veld: string; melding: string } {
  const pad = padNaarVeld(Array.isArray(issue.path) ? issue.path : []);
  const veld = pad || fallbackPad;

  if (issue.code === 'unrecognized_keys') {
    const keys = Array.isArray(issue.keys) ? issue.keys : [];
    if (keys.length > 0) {
      return { veld: String(keys[0]), melding: `veld "${String(keys[0])}" bestaat niet` };
    }
    return { veld, melding: `veld "${veld}" bestaat niet` };
  }

  if (issue.message) {
    return { veld, melding: issue.message };
  }

  if (issue.code === 'invalid_type') {
    const received = issue.received;
    if (received === 'undefined' || received === 'null') {
      return { veld, melding: `${veld} is verplicht` };
    }
    return { veld, melding: `${veld} heeft het verkeerde type` };
  }

  return { veld, melding: `${veld} is ongeldig` };
}

function valideer<T extends z.ZodType>(schema: T | undefined, waarde: unknown, wat: string): z.output<T> {
  if (!schema) return undefined as z.output<T>;

  const resultaat = schema.safeParse(waarde);
  if (!resultaat.success) {
    const rawIssues = Array.isArray(resultaat.error.issues) ? resultaat.error.issues : [resultaat.error];
    const foutVeldMeldingen = rawIssues.flatMap((issue: any) => {
      if (issue.code === 'unrecognized_keys') {
        const keys = Array.isArray(issue.keys) ? issue.keys : [];
        return keys.length > 0
          ? keys.map((key: any) => ({ veld: String(key), melding: `veld "${String(key)}" bestaat niet` }))
          : [validatieTekst(issue, wat)];
      }
      return [validatieTekst(issue, wat)];
    });

    if (wat === 'parameter') {
      const details = foutVeldMeldingen
        .map(({ veld, melding }) => `${veld}: ${melding}`)
        .join('; ');
      throw new HttpFout(400, details);
    }

    const velden = foutVeldMeldingen.filter((item): item is ValidatieVeld => Boolean(item && item.veld && item.melding));
    throw new HttpFout(400, 'Het recept bevat ongeldige gegevens', velden.length > 0 ? velden : [{ veld: wat, melding: 'ongeldige invoer' }]);
  }

  return resultaat.data;
}

export function createRoutes(mountPath: string, tag: Tag) {
  const router = Router();

  function route<P extends z.ZodObject = z.ZodObject<{}>, B extends z.ZodType = z.ZodUndefined, R extends z.ZodType = z.ZodType>(
    definitie: RouteDefinitie<P, B, R>,
  ): void {
    const { handler, ...documentatie } = definitie;
    operaties.push({ ...documentatie, pad: mountPath + (definitie.path === '/' ? '' : definitie.path), tag });

    router[definitie.method](definitie.path, async (req: Request, res: Response, next: (error?: unknown) => void) => {
      try {
        if (definitie.auth && !req.headers.authorization) {
          throw new HttpFout(401, 'Inloggen vereist: stuur een JWT-token mee als "Authorization: Bearer <token>"');
        }

        const params = valideer(definitie.params, req.params, 'parameter');
        const body = valideer(definitie.body, req.body, 'request body');
        const resultaat = await handler({ params, body });
        res.status(definitie.status ?? 200).json(definitie.response.parse(resultaat));
      } catch (error) {
        next(error);
      }
    });
  }

  return { mountPath, router, route };
}
