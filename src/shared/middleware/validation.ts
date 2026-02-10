import { Request, Response, NextFunction } from 'express';
import { validate, ValidationError as ClassValidatorError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { ValidationError } from '../errors/app-error';

export const validateDto = (dtoClass: any) => {
  return async (req: Request, _: Response, next: NextFunction): Promise<void> => {
    try {
      const dtoInstance = plainToClass(dtoClass, req.body);
      const errors = await validate(dtoInstance, { validationError: { target: false } });

      if (errors.length > 0) {
        const formatValidationErrors = (errors: ClassValidatorError[]): Record<string, any> => {
          const formatted: Record<string, any> = {};

          errors.forEach((error) => {
            if (error.children && error.children.length > 0) {
              formatted[error.property] = formatValidationErrors(error.children);
            } else if (error.constraints) {
              formatted[error.property] = Object.values(error.constraints);
            }
          });

          return formatted;
        };

        const formattedErrors = formatValidationErrors(errors);

        console.log('Validation failed with errors:', JSON.stringify(formattedErrors, null, 2));

        throw new ValidationError('Validation failed', formattedErrors);
      }

      req.body = dtoInstance;
      next();
    } catch (error) {
      next(error);
    }
  };
};
