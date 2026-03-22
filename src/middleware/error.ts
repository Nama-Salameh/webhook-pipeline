import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(public message: string, public status: number = 500) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") { super(message, 404); }
}

export class ValidationError extends AppError {
  constructor(message = "Validation error") { super(message, 400); }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") { super(message, 401); }
}

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? 500;
  const message = err.message ?? "Internal server error";
  if (status === 500) console.error(err);
  res.status(status).json({ error: message });
};
