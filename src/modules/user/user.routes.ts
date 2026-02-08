import { Router } from 'express';
import { UserController } from './user.controller';
import { authGuard } from '../../shared/guards/auth.guard';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { validateDto } from '../../shared/middleware/validation';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto/user.dto';

const router = Router();
const controller = new UserController();

router.post(
  '/',
  authGuard,
  permissionGuard('user:create'),
  validateDto(CreateUserDto),
  controller.createUser
);

router.get(
  '/',
  authGuard,
  permissionGuard('user:read'),
  controller.getUsers
);

router.get(
  '/:id',
  authGuard,
  permissionGuard('user:read'),
  controller.getUser
);

router.put(
  '/:id',
  authGuard,
  permissionGuard('user:update'),
  validateDto(UpdateUserDto),
  controller.updateUser
);

router.delete(
  '/:id',
  authGuard,
  permissionGuard('user:delete'),
  controller.deleteUser
);

router.post(
  '/change-password',
  authGuard,
  validateDto(ChangePasswordDto),
  controller.changePassword
);

export { router as userRouter };
