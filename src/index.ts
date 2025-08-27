import express, { Application, Request, Response } from 'express';
import userRoutes from './routes/user.routes';
import urlRoutes from './routes/url.routes';
const app: Application = express();
const PORT = process.env.PORT ?? 8000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Short URL redirect - this should be last to avoid conflicts
app.use('/', urlRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📱 API URL: http://localhost:${PORT}`);
});

export default app;
