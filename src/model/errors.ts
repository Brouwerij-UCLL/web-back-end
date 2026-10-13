// Fouten uit het model, met de HTTP-status die de API ervoor teruggeeft.

export class ValidatieFout extends Error {
  readonly status = 400;
}

export class NietGevonden extends Error {
  readonly status = 404;
}

export class Conflict extends Error {
  readonly status = 409;
}

export class SessieAfgerond extends Conflict {
  constructor(sessieId: number) {
    super(`brouwsessie ${sessieId} is afgerond en kan niet gewijzigd worden`);
  }
}
