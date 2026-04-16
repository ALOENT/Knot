import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/db';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    username: z.string().min(3, 'Username must be at least 3 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    // Accept email OR username in either field for backwards compatibility
    email: z.string().min(1, 'Email or username is required').optional(),
    identifier: z.string().min(1, 'Email or username is required').optional(),
    password: z.string().min(1, 'Password is required'),
  }).refine((data) => data.email || data.identifier, {
    message: 'Email or username is required',
  }),
});

const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  });
};

const sendTokenResponse = (user: any, statusCode: number, res: Response) => {
  const token = generateToken(user.id);

  const options = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
  };

  res.status(statusCode).cookie('jwt', token, options).json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isVerified: user.isVerified,
      isBanned: user.isBanned,
    },
  });
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, username, password } = req.body;

    const userExists = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Determine role: if email matches ADMIN_EMAIL, set role to ADMIN
    const role = email === process.env.ADMIN_EMAIL ? 'ADMIN' : 'USER';

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role,
      },
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, identifier, password } = req.body;

    // Support both 'email' and 'identifier' fields for flexibility
    const loginId = (identifier || email || '').trim();
    if (!loginId) {
      return res.status(400).json({ success: false, message: 'Email or username is required' });
    }

    // Lookup user by email first, then by username
    let user = await prisma.user.findUnique({ where: { email: loginId } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { username: loginId } });
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.isBanned) {
      return res.status(403).json({ success: false, message: 'Your account has been banned. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

export const logout = (req: Request, res: Response) => {
  res.cookie('jwt', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        bio: true,
        profilePic: true,
        banner: true,
        isOnline: true,
        role: true,
        isVerified: true,
        isBanned: true,
        privacySettings: true,
      },
    });

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};
