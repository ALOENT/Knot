"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const error_middleware_1 = require("./middlewares/error.middleware");
const message_routes_1 = __importDefault(require("./routes/message.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const report_routes_1 = __importDefault(require("./routes/report.routes"));
const upload_routes_1 = __importDefault(require("./routes/upload.routes"));
const db_1 = require("./utils/db");
const chat_socket_1 = require("./sockets/chat.socket");
const app = (0, express_1.default)();
app.set('trust proxy', env_1.env.TRUST_PROXY);
const httpServer = http_1.default.createServer(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: env_1.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true,
    }
});
// Initialize Chat Socket Logic
(0, chat_socket_1.initChatSocket)(io);
// Security Middlewares
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: env_1.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
}));
// Request Logging Middleware
app.use((req, res, next) => {
    logger_1.logger.info(`${req.method} ${req.url}`);
    next();
});
// Rate Limiting
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 150,
    message: 'Too many requests, please try again later.',
});
const sensitiveLimiter = (0, express_rate_limit_1.default)({
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
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/messages', message_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/reports', report_routes_1.default);
app.use('/api/health', health_routes_1.default);
app.use('/api/upload', upload_routes_1.default);
// Global Error Handling Middleware
app.use(error_middleware_1.errorHandler);
const PORT = Number.parseInt(env_1.env.PORT, 10);
const listenPort = Number.isFinite(PORT) && PORT > 0 ? PORT : 5000;
const startServer = async () => {
    try {
        await db_1.prisma.$connect();
        logger_1.logger.info('Database connected successfully');
        httpServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                logger_1.logger.error(`Port ${listenPort} is already in use (another process is listening). Stop that process or set PORT in your environment to a free port.`);
                process.exit(1);
            }
            logger_1.logger.error('HTTP server failed to start', err);
            process.exit(1);
        });
        httpServer.listen(listenPort, () => {
            logger_1.logger.info(`Server running in ${env_1.env.NODE_ENV} mode on port ${listenPort}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to connect to database format', error);
        process.exit(1);
    }
};
startServer();
