import { z } from 'zod';
import { FoutSchema } from './schemas.ts';
import { operaties, type Operatie, type Tag } from './route.ts';

const tagOmschrijvingen: Record<Tag, string> = {
  recipes: 'Bierrecepten en hun ingrediënten',
  ingredients: 'Catalogus van vergistbare ingrediënten (mouten, suikers, …) die recepten gebruiken',
  hops: 'Catalogus van hops die recepten gebruiken',
  extras: 'Catalogus van extra ingrediënten (kruiden, fruit, suikers, …) die recepten gebruiken',
  brouwsessies: 'Brouwsessies en hun stappen',
  installatie: 'De brouwinstallatie: sensoren en actuatoren',
  health: 'Status van de back-end',
};

function jsonSchema(schema: z.ZodType, io: 'input' | 'output'): Record<string, unknown> {
  const { $schema, ...rest } = z.toJSONSchema(schema, { io, unrepresentable: 'any' });
  return rest;
}

const foutRef = { $ref: '#/components/schemas/Fout' };

function foutAntwoord(omschrijving: string) {
  return {
    description: omschrijving,
    content: { 'application/json': { schema: foutRef, example: { fout: omschrijving } } },
  };
}

function operatieDocument(operatie: Operatie) {
  const parameter = (naam: string, schema: z.ZodType, plaats: 'path' | 'query') => {
    const parameterSchema = jsonSchema(schema, 'input');
    return {
      name: naam,
      in: plaats,
      required: plaats === 'path' || !schema.safeParse(undefined).success,
      description: parameterSchema.description,
      schema: parameterSchema,
      example: parameterSchema.example,
    };
  };
  const parameters = [
    ...Object.entries(operatie.params?.shape ?? {}).map(([naam, schema]) => parameter(naam, schema as z.ZodType, 'path')),
    ...Object.entries(operatie.query?.shape ?? {}).map(([naam, schema]) => parameter(naam, schema as z.ZodType, 'query')),
  ];

  const fouten: Record<string, string> = {};
  if (operatie.params || operatie.query || operatie.body) fouten[400] = 'Ongeldige invoer';
  if (operatie.auth) fouten[401] = 'Niet ingelogd of ongeldig token';
  Object.assign(fouten, operatie.errors);
  fouten[500] = 'Onverwachte fout in de back-end';

  return {
    tags: [operatie.tag],
    summary: operatie.summary,
    ...(operatie.description && { description: operatie.description }),
    operationId: `${operatie.method}${operatie.pad.replace(/[/:]+(\w)/g, (_, letter: string) => letter.toUpperCase())}`,
    ...(operatie.auth && { security: [{ bearerAuth: [] }] }),
    ...(parameters.length > 0 && { parameters }),
    ...(operatie.body && {
      requestBody: {
        required: true,
        content: { 'application/json': { schema: jsonSchema(operatie.body, 'input') } },
      },
    }),
    responses: {
      [operatie.status ?? 200]:
        operatie.status === 204
          ? { description: operatie.responseDescription }
          : {
              description: operatie.responseDescription,
              content: { 'application/json': { schema: jsonSchema(operatie.response, 'output') } },
            },
      ...Object.fromEntries(Object.entries(fouten).map(([status, omschrijving]) => [status, foutAntwoord(omschrijving)])),
    },
  };
}

let document: Record<string, unknown> | undefined;

// De OpenAPI 3-specificatie, opgebouwd uit alle endpoints die via createRoutes geregistreerd zijn.
export function getOpenApiDocument(): Record<string, unknown> {
  if (document) return document;

  const paths: Record<string, Record<string, unknown>> = {};
  for (const operatie of operaties) {
    const pad = operatie.pad.replace(/:(\w+)/g, '{$1}');
    paths[pad] = { ...paths[pad], [operatie.method]: operatieDocument(operatie) };
  }

  document = {
    openapi: '3.1.0',
    info: {
      title: 'Brouwerij API',
      version: '1.0.0',
      description: 'REST API van de brouwerij-back-end. Foutantwoorden hebben altijd het formaat `{"fout": "..."}`.',
    },
    tags: Object.entries(tagOmschrijvingen).map(([name, description]) => ({ name, description })),
    paths,
    components: {
      schemas: { Fout: jsonSchema(FoutSchema, 'output') },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT-token van een ingelogde gebruiker',
        },
      },
    },
  };
  return document;
}
