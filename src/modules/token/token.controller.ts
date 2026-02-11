import { Request, Response, NextFunction } from 'express';
import { TokenService } from './token.service';
import { AuthenticatedRequest } from '../../shared/guards/auth.guard';

export class TokenController {
  private service: TokenService;

  constructor() {
    this.service = new TokenService();
  }

  public create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entity = await this.service.create(String(req.user!.id), req.body);
      
      res.status(201).json({
        success: true,
        data: entity,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entity = await this.service.getById(req.params.id);
      
      res.status(200).json({
        success: true,
        data: entity,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, sort, fields, ...filters } = req.query;
      
      const result = await this.service.getAll({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        sort: sort as string,
        fields: fields as string,
        filters,
      });
      
      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          ...result.meta,
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entity = await this.service.update(req.params.id, String(req.user!.id), req.body);
      
      res.status(200).json({
        success: true,
        data: entity,
        meta: {
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public delete = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.delete(req.params.id, String(req.user!.id));
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
