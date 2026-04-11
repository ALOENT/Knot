import { Request, Response, NextFunction } from 'express';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (
    req.user && 
    (req.user.role === 'ADMIN' || req.user.email === process.env.ADMIN_EMAIL)
  ) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Not authorized as an admin' });
  }
};
