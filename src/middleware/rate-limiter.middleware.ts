import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Extend Request interface to include rateLimit property
declare global {
    namespace Express {
        interface Request {
            rateLimit?: {
                limit: number;
                current: number;
                remaining: number;
                resetTime?: Date;
            };
        }
    }
}

// Rate limiter configurations for different endpoints

// General API rate limiter
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 900),
        });
    },
});

// Strict rate limiter for URL creation
export const urlCreationLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 URL creations per minute
    message: {
        error: 'Too many URL creations from this IP, please slow down.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count all requests, not just failed ones
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'URL creation rate limit exceeded',
            message: 'You can only create 10 URLs per minute. Please wait before creating more.',
            retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 60),
        });
    },
});

// Rate limiter for authentication endpoints
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 failed login attempts per windowMs
    message: {
        error: 'Too many authentication attempts from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failed requests
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Authentication rate limit exceeded',
            message: 'Too many failed authentication attempts. Please try again later.',
            retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 900),
        });
    },
});

// Rate limiter for URL redirects (very lenient but prevents abuse)
export const redirectLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 redirects per minute
    message: {
        error: 'Too many redirects from this IP, please slow down.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Redirect rate limit exceeded',
            message: 'Too many redirects requested. Please wait a moment.',
            retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 60),
        });
    },
});

// Rate limiter for analytics endpoints
export const analyticsLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // Limit each IP to 50 analytics requests per 5 minutes
    message: {
        error: 'Too many analytics requests from this IP, please try again later.',
        retryAfter: '5 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Analytics rate limit exceeded',
            message: 'Too many analytics requests. Please wait before requesting more data.',
            retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 300),
        });
    },
});

// Aggressive rate limiter for suspected abuse
export const aggressiveLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 requests per hour
    message: {
        error: 'IP temporarily blocked due to suspicious activity.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'IP blocked',
            message: 'Your IP has been temporarily blocked due to suspicious activity. Please contact support if you believe this is an error.',
            retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : 3600),
        });
    },
});

// Helper function to create custom rate limiters
export const createCustomLimiter = (options: {
    windowMs: number;
    max: number;
    message: string;
    skipSuccessfulRequests?: boolean;
}) => {
    return rateLimit({
        windowMs: options.windowMs,
        max: options.max,
        message: {
            error: options.message,
            retryAfter: Math.ceil(options.windowMs / 1000) + ' seconds'
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: options.skipSuccessfulRequests || false,
        handler: (req: Request, res: Response) => {
            res.status(429).json({
                error: 'Rate limit exceeded',
                message: options.message,
                retryAfter: Math.ceil(req.rateLimit?.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : options.windowMs / 1000),
            });
        },
    });
};

// Export all limiters for easy access
export const rateLimiters = {
    general: generalLimiter,
    urlCreation: urlCreationLimiter,
    auth: authLimiter,
    redirect: redirectLimiter,
    analytics: analyticsLimiter,
    aggressive: aggressiveLimiter,
};
