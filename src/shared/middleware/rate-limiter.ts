import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  standardHeaders: true,
  legacyHeaders: false,

  handler: (_, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later',
    });
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,

  handler: (_, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later',
    });
  },
});
