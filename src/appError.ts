/**
 * Custom AppError klasse voor het werpen van gestructureerde fouten binnen de Express applicatie
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  /**
   * @param message Het foutbericht dat naar de client gestuurd mag worden
   * @param statusCode De HTTP statuscode (bijv. 400, 401, 403, 404, 500). Standaard 500
   */
  constructor(message: string, statusCode: number = 500) {
    super(message);

    this.statusCode = statusCode;
    
    // isOperational geeft aan dat dit een bekende/verwachte fout is 
    // (bijv. validatiefout of 404) en geen onverwachte crash/bug op de server
    this.isOperational = true;

    // Herstel de prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    // Leg de stacktrace vast zonder deze constructor erin
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}