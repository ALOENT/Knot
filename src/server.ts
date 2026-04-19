import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { Server } from 'socket.io';

import { env } from './config/env';
import { logger } from './utils/logger';
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';
import userRoutes from './routes/user.routes';
import { errorHandler } from './middlewares/error.middleware';
import messageRoutes from './routes/message.routes';
import adminRoutes from './routes/admin.routes';
import reportRoutes from './routes/report.routes';
import uploadRoutes from './routes/upload.routes';
import { prisma } from './utils/db';
import { initChatSocket } from './sockets/chat.socket';

const app = express();
app.set('trust proxy', env.TRUST_PROXY);
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  }
});

// Initialize Chat Socket Logic
initChatSocket(io);


// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// Request Logging Middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 150, 
  message: 'Too many requests, please try again later.',
});

const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per hour for sensitive actions
  message: 'Security threshold reached. Please try again in an hour.',
});

app.use('/api', generalLimiter);
app.use('/api/auth/register', sensitiveLimiter);
app.use('/api/auth/login', sensitiveLimiter);
app.use('/api/reports', sensitiveLimiter);
app.use('/api/upload', sensitiveLimiter);

// Body Parser and Cookie Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/upload', uploadRoutes);

// Global Error Handling Middleware
app.use(errorHandler);

const PORT = Number.parseInt(env.PORT, 10);
const listenPort = Number.isFinite(PORT) && PORT > 0 ? PORT : 5000;

const startServer = async () => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(
          `Port ${listenPort} is already in use (another process is listening). Stop that process or set PORT in your environment to a free port.`
        );
        process.exit(1);
      }
      logger.error('HTTP server failed to start', err);
      process.exit(1);
    });

    httpServer.listen(listenPort, () => {
      logger.info(`Server running in ${env.NODE_ENV} mode on port ${listenPort}`);
    });
  } catch (error) {
    logger.error('Failed to connect to database format', error);
    process.exit(1);
  }
};

startServer();
