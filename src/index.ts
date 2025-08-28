import express, { Application, Request, Response } from 'express';
import userRoutes from './routes/user.routes';
import urlRoutes from './routes/url.routes';
import { redisService } from './services/redis.service';
import { queueService } from './services/queue.service';
import { generalLimiter } from './middleware/rate-limiter.middleware';
const app: Application = express();
const PORT = process.env.PORT ?? 8000;

// Initialize services
async function initializeServices() {
    try {
        console.log('🚀 Initializing services...');
        
        // Connect to Redis
        await redisService.connect();
        
        // Initialize RabbitMQ and start consumers
        await queueService.startAllConsumers();
        
        console.log('✅ All services initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize services:', error);
        // Don't exit the process, let the app run without cache/queue if needed
    }
}

// Global middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply general rate limiter to all routes
app.use(generalLimiter);

// Trust proxy for accurate IP addresses (if behind a proxy)
app.set('trust proxy', 1);

// Routes
app.use('/api/users', userRoutes);
app.use('/api/urls', urlRoutes);

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to URL Shortener API!',
    status: 'success',
    endpoints: {
      users: '/api/users',
      urls: '/api/urls',
      redirect: '/:shortCode'
    }
  });
});

// Health check route with service status
app.get('/health', async (req: Request, res: Response) => {
  const redisHealthy = await redisService.isHealthy();
  const queueHealthy = queueService.isHealthy();
  
  const overallStatus = redisHealthy && queueHealthy ? 'OK' : 'PARTIAL';
  
  res.status(overallStatus === 'OK' ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      redis: redisHealthy ? 'UP' : 'DOWN',
      rabbitmq: queueHealthy ? 'UP' : 'DOWN',
      database: 'UP' // Assume DB is up if app is running
    },
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime()
  });
});

// Short URL redirect - this should be last to avoid conflicts
app.use('/', urlRoutes);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('🔴 Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
async function startServer() {
  try {
    // Initialize services first
    await initializeServices();
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📱 API URL: http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`🐰 RabbitMQ Management: http://localhost:15672 (admin/admin123)`);
      console.log(`🔴 Redis Commander: http://localhost:8081`);
      console.log(`📊 Database: PostgreSQL on port 5432`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      server.close(async () => {
        console.log('🔌 HTTP server closed');
        
        try {
          await redisService.disconnect();
          console.log('🔴 Redis disconnected');
          
          await queueService.disconnect();
          console.log('🐰 RabbitMQ disconnected');
          
          console.log('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.log('⏰ Forcing shutdown...');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer();

export default app;
