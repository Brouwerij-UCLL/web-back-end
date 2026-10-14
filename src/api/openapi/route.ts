import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

// Groepen in de documentatie; elk endpoint hoort bij precies één groep.
export type Tag = 'recepten' | 'brouwsessies' | 'installatie' | 'health';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

// Statuscodes waarvoor een endpoint een fout in het formaat {"fout": "..."} kan teruggeven.
export type FoutStatus = 400 | 401 | 403 | 404 | 409 | 503;

// Gooi dit in een handler om een fout met statuscode terug te sturen.
export class HttpFout extends Error {
  readonly status: FoutStatus;

  constructor(status: FoutStatus, fout: string) {
    super(fout);
    this.status = status;
  }
}

export type RouteDefinitie<P extends z.ZodObject, B extends z.ZodType, R extends z.ZodType> = {
  method: Method;
  path: string; // relatief aan de groep, bv. '/:id'
  summary: string;
  description?: string;
  params?: P;
  body?: B;
  status?: 200 | 201;
  response: R;
  responseDescription: string;
  errors?: Partial<Record<FoutStatus, string>>; // statuscode -> wanneer die fout optreedt
  auth?: boolean; // true: endpoint vereist een ingelogde gebruiker (JWT)
  handler: (input: { params: z.output<P>; body: z.output<B> }) => z.input<R> | Promise<z.input<R>>;
};

export type Operatie = Omit<RouteDefinitie<z.ZodObject, z.ZodType, z.ZodType>, 'handler'> & {
  pad: string; // volledig Express-pad, bv. '/api/recepten/:id'
  tag: Tag;
};

// Alle geregistreerde endpoints; hieruit wordt de OpenAPI-specificatie opgebouwd.
export const operaties: Operatie[] = [];

function valideer<T extends z.ZodType>(schema: T | undefined, waarde: unknown, wat: string): z.output<T> {
  if (!schema) return undefined as z.output<T>;
  const resultaat = schema.safeParse(waarde);
  if (!resultaat.success) {
    const details = resultaat.error.issues.map((issue) => `${issue.path.join('.') || wat}: ${issue.message}`).join('; ');
    throw new HttpFout(400, `Ongeldige ${wat}: ${details}`);
  }
  return resultaat.data;
}

// Maakt een groep endpoints onder één pad. Elk endpoint wordt gevalideerd én gedocumenteerd vanuit dezelfde definitie.
export function createRoutes(mountPath: string, tag: Tag) {
  const router = Router();

  function route<P extends z.ZodObject = z.ZodObject<{}>, B extends z.ZodType = z.ZodUndefined, R extends z.ZodType = z.ZodType>(
    definitie: RouteDefinitie<P, B, R>,
  ): void {
    const { handler, ...documentatie } = definitie;
    operaties.push({ ...documentatie, pad: mountPath + (definitie.path === '/' ? '' : definitie.path), tag });

    router[definitie.method](definitie.path, async (req: Request, res: Response) => {
      if (definitie.auth && !/^Bearer \S+/.test(req.get('authorization') ?? '')) {
        throw new HttpFout(401, 'Inloggen vereist: stuur een JWT-token mee als "Authorization: Bearer <token>"');
      }
      const params = valideer(definitie.params, req.params, 'parameter');
      const body = valideer(definitie.body, req.body, 'request body');
      const resultaat = await handler({ params, body });
      // Het antwoord moet aan het gedocumenteerde schema voldoen; zo niet, dan is dat een fout in de back-end (500).
      res.status(definitie.status ?? 200).json(definitie.response.parse(resultaat));
    });
  }

  return { mountPath, router, route };
}
