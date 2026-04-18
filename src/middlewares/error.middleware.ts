import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { ZodError } from 'zod';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Anonymize IP if not configured to include it
  const maskIp = (ip: string) => {
    if (!ip) return 'unknown';
    if (ip.includes(':')) {
      // IPv6 - mask last part
      return ip.split(':').slice(0, 3).join(':') + ':****';
    }
    // IPv4 - mask last two octets
    return ip.split('.').slice(0, 2).join('.') + '.*.*';
  };

  const displayIp = env.LOG_INCLUDE_IP ? req.ip : maskIp(req.ip || '');

  // Log the error
  logger.error(`${err.message} - ${req.method} ${req.url} - ${displayIp}`);
  if (err.stack && env.NODE_ENV === 'development') {
    logger.error(err.stack);
  }

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.issues.map((e: any) => ({ path: e.path.join('.'), message: e.message }))
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
