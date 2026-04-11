import { Router } from 'express';
import { prisma } from '../utils/db';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', async (req, res) => {
  try {
    // Ping the database to check if the connection is active
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({
      success: true,
      status: 'UP',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    logger.error('Health check failed: Database connection error', error);
    res.status(503).json({
      success: false,
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

export default router;
