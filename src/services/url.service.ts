import { db } from '../db/index';
import { urlsTable } from '../models/index';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { redisService } from './redis.service';
import { queueService, QueueNames, UrlAnalyticsEvent } from './queue.service';

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
    
    // Cache the new URL
    await redisService.cacheUrl(shortCode, url, 3600); // Cache for 1 hour
    
    // Invalidate user URLs cache
    await redisService.invalidateUserUrlsCache(data.userId);
    
    // Send analytics event
    await queueService.publishUrlAnalytics({
        urlId: url.id,
        userId: data.userId,
        action: 'created',
        metadata: { shortCode, originalUrl: data.originalUrl },
        timestamp: new Date()
    });
    
    return url;
}

// Find URL by short code (for redirect)
export async function getUrlByShortCode(shortCode: string) {
    // Try to get from cache first
    const cachedUrl = await redisService.getCachedUrl(shortCode);
    if (cachedUrl) {
        console.log(`🎯 Cache hit for shortCode: ${shortCode}`);
        return cachedUrl;
    }
    
    console.log(`💾 Cache miss for shortCode: ${shortCode}, fetching from DB`);
    
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
    
    // Cache the result if found
    if (url) {
        await redisService.cacheUrl(shortCode, url, 3600); // Cache for 1 hour
    }
    
    return url || null;
}

// Increment click count
export async function incrementClickCount(shortCode: string, userAgent?: string, ipAddress?: string, referrer?: string) {
    // Update in database
    await db
        .update(urlsTable)
        .set({
            clicks: sql`${urlsTable.clicks} + 1`,
            updatedAt: new Date(),
        })
        .where(eq(urlsTable.shortCode, shortCode));
    
    // Update in Redis cache
    await redisService.incrementClickCount(shortCode);
    
    // Get URL details for analytics
    const url = await getUrlByShortCode(shortCode);
    
    if (url) {
        // Send click event to queue for analytics
        await queueService.publishUrlClick({
            shortCode,
            urlId: url.id,
            originalUrl: url.originalUrl,
            userAgent,
            ipAddress,
            referrer,
            timestamp: new Date(),
            userId: url.userId
        });
    }
}

// Get user's URLs with pagination
export async function getUserUrls(
    userId: string,
    page: number = 1,
    limit: number = 10,
    isActive?: boolean
) {
    // Try to get from cache first
    const cachedResult = await redisService.getCachedUserUrls(userId, page, limit, isActive);
    if (cachedResult) {
        console.log(`🎯 Cache hit for user URLs: ${userId}`);
        return cachedResult;
    }
    
    console.log(`💾 Cache miss for user URLs: ${userId}, fetching from DB`);
    
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
    
    const result = {
        urls,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
    
    // Cache the result
    await redisService.cacheUserUrls(userId, page, limit, isActive, result, 300); // Cache for 5 minutes
    
    return result;
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
    
    if (updatedUrl) {
        // Update cache
        await redisService.cacheUrl(updatedUrl.shortCode, updatedUrl, 3600);
        
        // Invalidate user URLs cache
        await redisService.invalidateUserUrlsCache(userId);
        
        // Send analytics event
        await queueService.publishUrlAnalytics({
            urlId: id,
            userId,
            action: 'updated',
            metadata: data,
            timestamp: new Date()
        });
    }
    
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
    
    if (deletedUrl) {
        // Remove from cache
        await redisService.invalidateUrlCache(deletedUrl.shortCode);
        
        // Invalidate user URLs cache
        await redisService.invalidateUserUrlsCache(userId);
        
        // Send analytics event
        await queueService.publishUrlAnalytics({
            urlId: id,
            userId,
            action: 'deleted',
            metadata: { shortCode: deletedUrl.shortCode },
            timestamp: new Date()
        });
    }
    
    return deletedUrl || null;
}

// Get URL analytics
export async function getUrlAnalytics(id: string, userId: string) {
    // Try to get from cache first
    const cachedAnalytics = await redisService.getCachedUrlAnalytics(id);
    if (cachedAnalytics) {
        console.log(`🎯 Cache hit for URL analytics: ${id}`);
        return cachedAnalytics;
    }
    
    console.log(`💾 Cache miss for URL analytics: ${id}, fetching from DB`);
    
    const url = await getUrlById(id, userId);
    
    if (!url) {
        return null;
    }
    
    const analytics = {
        ...url,
        shortUrl: `${process.env.BASE_URL || 'http://localhost:8000'}/${url.shortCode}`,
    };
    
    // Cache the analytics
    await redisService.cacheUrlAnalytics(id, analytics, 300); // Cache for 5 minutes
    
    // Send analytics view event
    await queueService.publishUrlAnalytics({
        urlId: id,
        userId,
        action: 'viewed',
        metadata: { type: 'analytics' },
        timestamp: new Date()
    });
    
    return analytics;
}
