import { ValidationError } from "../error-handler";
import { z, ZodError, ZodObject, ZodTypeAny } from "zod";
import type { NextFunction, Request, Response } from "express";

// Define AnyZodObject manually if your version doesn't export it
type AnyZodObject = ZodObject;
type Schema = AnyZodObject | ZodTypeAny;

const formatZodError = (error: ZodError) =>
  // Use .issues instead of .errors for better compatibility
  error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

export const validateRequest = (schemas: RequestValidationSchemas) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      if (schemas.params) {
        // Casting to 'any' bypasses the Express ParamsDictionary conflict
        req.params = (await schemas.params.parseAsync(req.params)) as any;
      }

      if (schemas.query) {
        // Casting to 'any' bypasses the Express Query conflict
        req.query = (await schemas.query.parseAsync(req.query)) as any;
      }

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(
          new ValidationError("Validation Error", {
            issues: formatZodError(error),
          })
        );
      }

      return next(error);
    }
  };
};

export interface RequestValidationSchemas {
  body?: Schema;
  params?: Schema;
  query?: Schema;
}