import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authGuard } from '../../shared/guards/auth.guard';
import { validateDto } from '../../shared/middleware/validation';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { authRateLimiter } from '../../shared/middleware/rate-limiter';

const router = Router();
const controller = new AuthController();

router.post(
  '/register',
  authRateLimiter,
  validateDto(RegisterDto),
  controller.register
);

router.post(
  '/login',
  authRateLimiter,
  validateDto(LoginDto),
  controller.login
);

router.post(
  '/refresh-token',
  validateDto(RefreshTokenDto),
  controller.refreshToken
);

router.post(
  '/logout',
  authGuard,
  validateDto(RefreshTokenDto),
  controller.logout
);

router.post(
  '/logout-all',
  authGuard,
  controller.logoutAll
);

export { router as authRouter };
