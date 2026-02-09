import { Router } from 'express';
import { CustomerController } from './customer.controller';
import { authGuard } from '../../shared/guards/auth.guard';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { validateDto } from '../../shared/middleware/validation';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

const router = Router();
const controller = new CustomerController();

router.post(
  '/',
  authGuard,
  permissionGuard('customer:create'),
  validateDto(CreateCustomerDto),
  controller.create
);

router.get(
  '/',
  authGuard,
  permissionGuard('customer:read'),
  controller.getAll
);

router.get(
  '/:id',
  authGuard,
  permissionGuard('customer:read'),
  controller.getOne
);

router.put(
  '/:id',
  authGuard,
  permissionGuard('customer:update'),
  validateDto(UpdateCustomerDto),
  controller.update
);

router.delete(
  '/:id',
  authGuard,
  permissionGuard('customer:delete'),
  controller.delete
);

export { router as customerRouter };
