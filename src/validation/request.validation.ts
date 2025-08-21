import {z} from 'zod';

export const signupPostRequestBodySchema=z.object({
    firstName: z.string(),
    lastName: z.string().optional(),
    email: z.string(),
    password: z.string().min(3),
});