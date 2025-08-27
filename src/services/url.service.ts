import { db } from '../db/index';
import { urlsTable } from '../models/index';
import { eq, and, desc, count, sql } from 'drizzle-orm';

// Generate random short code
export function generateShortCode(length: number = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Check if short code exists
export async function isShortCodeExists(shortCode: string): Promise<boolean> {
    const existing = await db
        .select()
        .from(urlsTable)
        .where(eq(urlsTable.shortCode, shortCode))
        .limit(1);
    
    return existing.length > 0;
}

// Create new URL
export async function createUrl(data: {
    originalUrl: string;
    userId: string;
    customShortCode?: string;
    expiresAt?: Date;
}) {
    let shortCode = data.customShortCode;
    
    // Generate unique short code if not provided
    if (!shortCode) {
        do {
            shortCode = generateShortCode();
        } while (await isShortCodeExists(shortCode));
    } else {
        // Check if custom short code is available
        if (await isShortCodeExists(shortCode)) {
            throw new Error('Short code already exists. Please choose a different one.');
        }
    }
    
    const [url] = await db
        .insert(urlsTable)
        .values({
            originalUrl: data.originalUrl,
            shortCode,
            userId: data.userId,
            expiresAt: data.expiresAt,
        })
        .returning();
    
    return url;
}

// Find URL by short code (for redirect)
export async function getUrlByShortCode(shortCode: string) {
    const [url] = await db
        .select()
        .from(urlsTable)
        .where(
            and(
                eq(urlsTable.shortCode, shortCode),
                eq(urlsTable.isActive, true)
            )
        )
        .limit(1);
    
    return url || null;
}

// Increment click count
export async function incrementClickCount(shortCode: string) {
    await db
        .update(urlsTable)
        .set({
            clicks: sql`${urlsTable.clicks} + 1`,
            updatedAt: new Date(),
        })
        .where(eq(urlsTable.shortCode, shortCode));
}

// Get user's URLs with pagination
export async function getUserUrls(
    userId: string,
    page: number = 1,
    limit: number = 10,
    isActive?: boolean
) {
    const offset = (page - 1) * limit;
    
    const whereConditions = [eq(urlsTable.userId, userId)];
    if (isActive !== undefined) {
        whereConditions.push(eq(urlsTable.isActive, isActive));
    }
    
    const [urls, totalResult] = await Promise.all([
        db
            .select()
            .from(urlsTable)
            .where(and(...whereConditions))
            .orderBy(desc(urlsTable.createdAt))
            .limit(limit)
            .offset(offset),
        
        db
            .select({ count: count() })
            .from(urlsTable)
            .where(and(...whereConditions))
    ]);
    
    const total = totalResult[0]?.count || 0;
    
    return {
        urls,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// Get URL by ID (for user's own URLs)
export async function getUrlById(id: string, userId: string) {
    const [url] = await db
        .select()
        .from(urlsTable)
        .where(
            and(
                eq(urlsTable.id, id),
                eq(urlsTable.userId, userId)
            )
        )
        .limit(1);
    
    return url || null;
}

// Update URL
export async function updateUrl(
    id: string,
    userId: string,
    data: {
        originalUrl?: string;
        isActive?: boolean;
        expiresAt?: Date;
    }
) {
    const [updatedUrl] = await db
        .update(urlsTable)
        .set({
            ...data,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(urlsTable.id, id),
                eq(urlsTable.userId, userId)
            )
        )
        .returning();
    
    return updatedUrl || null;
}

// Delete URL
export async function deleteUrl(id: string, userId: string) {
    const [deletedUrl] = await db
        .delete(urlsTable)
        .where(
            and(
                eq(urlsTable.id, id),
                eq(urlsTable.userId, userId)
            )
        )
        .returning();
    
    return deletedUrl || null;
}

// Get URL analytics
export async function getUrlAnalytics(id: string, userId: string) {
    const url = await getUrlById(id, userId);
    
    if (!url) {
        return null;
    }
    
    return {
        ...url,
        shortUrl: `${process.env.BASE_URL || 'http://localhost:8000'}/${url.shortCode}`,
    };
}
