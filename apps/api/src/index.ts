/**
 * SoloCompass API Server
 * Express server with comprehensive middleware and error handling
 */

import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from 'dotenv';
import crypto from 'crypto';

// Load environment variables
config();

const app: Application = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// =============================================================================
// Middleware
// =============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: process.env['CORS_ORIGIN'] || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// Request ID for tracing
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
  next();
});

// Logging
const logFormat = process.env['NODE_ENV'] === 'production' 
  ? ':remote-addr - :method :url :status :res[content-length] - :response-time ms'
  : 'dev';
app.use(morgan(logFormat));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =============================================================================
// Environment Validation
// =============================================================================

function validateEnv(): void {
  const required = ['NODE_ENV', 'PORT', 'DATABASE_URL'];
  const missing = required.filter((key) => !process.env[key]);
  
  if (missing.length > 0 && process.env['NODE_ENV'] === 'production') {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  
  // Warn about missing optional vars
  const optional = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_ACCESS_SECRET'];
  const missingOptional = optional.filter((key) => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(`⚠️ Missing optional environment variables: ${missingOptional.join(', ')}`);
  }
}

validateEnv();

// =============================================================================
// API Routes
// =============================================================================

// Health check with dependency status
app.get('/health', async (_req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] || 'development',
    version: process.env['npm_package_version'] || '1.0.0',
  };
  
  res.json(health);
});

// Liveness probe (for k8s/load balancers)
app.get('/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'alive' });
});

// Readiness probe
app.get('/health/ready', async (_req: Request, res: Response) => {
  // Add DB check when ready
  res.json({ status: 'ready' });
});

// API status
app.get('/api/v1/status', (_req: Request, res: Response) => {
  res.json({
    version: '1.0.0',
    environment: process.env['NODE_ENV'] || 'development',
    timestamp: new Date().toISOString(),
  });
});

// =============================================================================
// Error Handling
// =============================================================================

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Unhandled error:', err);
  
  const isProduction = process.env['NODE_ENV'] === 'production';
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: isProduction ? 'An unexpected error occurred' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

// =============================================================================
// WebSocket
// =============================================================================

io.on('connection', (socket) => {
  console.log(`📡 Client connected: ${socket.id}`);
  
  socket.on('disconnect', (reason) => {
    console.log(`📡 Client disconnected: ${socket.id} (${reason})`);
  });
  
  // Handle custom events
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
});

// =============================================================================
// Graceful Shutdown
// =============================================================================

const shutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
  
  // Stop accepting new connections
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
  });
  
  // Close WebSocket connections
  io.close(() => {
    console.log('✅ WebSocket server closed');
  });
  
  // Close database connections
  try {
    // await db.close(); // Uncomment when DB is ready
    console.log('✅ Database connections closed');
  } catch (err) {
    console.error('❌ Error closing database:', err);
  }
  
  // Exit
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// =============================================================================
// Start Server
// =============================================================================

const PORT = process.env['PORT'] || 3001;

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  🚀 SoloCompass API Server                              ║
╠════════════════════════════════════════════════════════════╣
║  Port:     ${PORT.toString().padEnd(43)}║
║  Env:      ${(process.env['NODE_ENV'] || 'development').padEnd(43)}║
║  WebSocket: Enabled                                  ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export { app, httpServer, io };
