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
const db_1 = require("./utils/db");
const chat_socket_1 = require("./sockets/chat.socket");
const app = (0, express_1.default)();
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
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api', limiter);
// Body Parser and Cookie Parser
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/health', health_routes_1.default);
// Global Error Handling Middleware
app.use(error_middleware_1.errorHandler);
const PORT = env_1.env.PORT || 5000;
const startServer = async () => {
    try {
        await db_1.prisma.$connect();
        logger_1.logger.info('Database connected successfully');
        httpServer.listen(PORT, () => {
            logger_1.logger.info(`Server running in ${env_1.env.NODE_ENV} mode on port ${PORT}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to connect to database format', error);
        process.exit(1);
    }
};
startServer();
