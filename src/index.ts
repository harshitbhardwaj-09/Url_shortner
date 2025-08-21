import express, { Application, Request, Response } from 'express';
import userRoutes from './routes/user.routes'
const app: Application = express();
const PORT = process.env.PORT ?? 8000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to URL Shortener API!',
    status: 'success'
  });
});

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📱 API URL: http://localhost:${PORT}`);
});

export default app;
