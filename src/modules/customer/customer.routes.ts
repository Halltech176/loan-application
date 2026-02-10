import { Router } from 'express';
import { CustomerController } from './customer.controller';
import { authGuard } from '../../shared/guards/auth.guard';
import { permissionGuard } from '../../shared/guards/permission.guard';
import { validateDto } from '../../shared/middleware/validation';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { roleGuard } from '@/shared/guards/role.guard';
import { UserRole } from '../user/user.model';

const router = Router();
const controller = new CustomerController();

router.post('/', roleGuard(UserRole.CUSTOMER), validateDto(CreateCustomerDto), controller.create);

router.get('/', authGuard, permissionGuard('customer:read'), controller.getAll);

router.get('/:id', authGuard, permissionGuard('customer:read'), controller.getOne);

router.put(
  '/:id',
  authGuard,
  permissionGuard('customer:update'),
  validateDto(UpdateCustomerDto),
  controller.update,
);

router.delete('/:id', authGuard, permissionGuard('customer:delete'), controller.delete);

export { router as customerRouter };
