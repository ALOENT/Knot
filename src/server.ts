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
import { prisma } from './utils/db';
import { initChatSocket } from './sockets/chat.socket';

const app = express();
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
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api', limiter);

// Body Parser and Cookie Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/health', healthRoutes);

// Global Error Handling Middleware
app.use(errorHandler);

const PORT = env.PORT || 5000;

const startServer = async () => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
    
    httpServer.listen(PORT, () => {
      logger.info(`Server running in ${env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to connect to database format', error);
    process.exit(1);
  }
};

startServer();
