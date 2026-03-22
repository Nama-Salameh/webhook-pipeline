import { Request, Response, NextFunction } from "express";

export const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return next();

  const key = req.header("x-api-key");
  if (!key || key !== apiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};
