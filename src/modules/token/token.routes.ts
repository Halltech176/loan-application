import { Router } from 'express';
import { TokenController } from './token.controller';
import { authGuard } from '../../shared/guards/auth.guard';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { validateDto } from '../../shared/middleware/validation';
import { CreateTokenDto, UpdateTokenDto } from './dto/token.dto';

const router = Router();
const controller = new TokenController();

router.post(
  '/',
  authGuard,
  permissionGuard('token:create'),
  validateDto(CreateTokenDto),
  controller.create
);

router.get(
  '/',
  authGuard,
  permissionGuard('token:read'),
  controller.getAll
);

router.get(
  '/:id',
  authGuard,
  permissionGuard('token:read'),
  controller.getOne
);

router.put(
  '/:id',
  authGuard,
  permissionGuard('token:update'),
  validateDto(UpdateTokenDto),
  controller.update
);

router.delete(
  '/:id',
  authGuard,
  permissionGuard('token:delete'),
  controller.delete
);

export { router as tokenRouter };
