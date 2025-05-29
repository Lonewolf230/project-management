export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errors = {
  notFound: (message) => new AppError(message, 404),
  badRequest: (message) => new AppError(message, 400),
  unauthorized: (message) => new AppError(message, 401),
  forbidden: (message) => new AppError(message, 403),
  conflict: (message) => new AppError(message, 409),
  validation: (message) => new AppError(message, 422)
};