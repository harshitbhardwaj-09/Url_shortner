import {z} from 'zod';

export const signupPostRequestBodySchema=z.object({
    firstName: z.string(),
    lastName: z.string().optional(),
    email: z.string(),
    password: z.string().min(3),
    
});

export const loginPostRequestBodySchema=z.object({
    email : z.string().email(),
    password : z.string().min(3),
});

// URL validation schemas
export const createUrlPostRequestBodySchema = z.object({
    originalUrl: z.string().url({ message: "Valid URL required" }),
    customShortCode: z.string().min(3).max(10).optional(),
    expiresAt: z.string().datetime().optional(),
});

export const updateUrlPutRequestBodySchema = z.object({
    originalUrl: z.string().url().optional(),
    isActive: z.boolean().optional(),
    expiresAt: z.string().datetime().optional(),
});

export const listUrlsQuerySchema = z.object({
    page: z.string().default("1").transform(val => parseInt(val)),
    limit: z.string().default("10").transform(val => parseInt(val)),
    isActive: z.string().transform(val => val === "true").optional(),
});