import { Request, Response, NextFunction } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { ValidationError } from '../errors/app-error';

export const validateDto = (dtoClass: any) => {
  return async (req: Request, _: Response, next: NextFunction): Promise<void> => {
    try {
      const dtoInstance = plainToClass(dtoClass, req.body);
      const errors = await validate(dtoInstance);
      console.log({ errors });

      if (errors.length > 0) {
        const formattedErrors = errors.reduce<Record<string, string[]>>((acc, error) => {
          if (error.constraints) {
            console.log(
              'Validation error for property:',
              error.property,
              'with constraints:',
              error.constraints,
            );
            acc[error.property] = Object.values(error.constraints);
          }
          return acc;
        }, {});

        console.log('Validation failed with errors:', formattedErrors);

        throw new ValidationError('Validation failed', formattedErrors);
      }

      req.body = dtoInstance;
      next();
    } catch (error) {
      next(error);
    }
  };
};
