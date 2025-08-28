import { createClient, RedisClientType } from 'redis';

class RedisService {
    private client: RedisClientType;
    private isConnected: boolean = false;

    constructor() {
        this.client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            socket: {
                reconnectStrategy: (retries: number) => {
                    console.log(`Redis reconnect attempt ${retries}`);
                    return Math.min(retries * 50, 1000);
                },
            },
        });

        this.client.on('connect', () => {
            console.log('🟢 Redis connected');
            this.isConnected = true;
        });

        this.client.on('error', (err: Error) => {
            console.error('🔴 Redis connection error:', err);
            this.isConnected = false;
        });

        this.client.on('disconnect', () => {
            console.log('🟡 Redis disconnected');
            this.isConnected = false;
        });
    }

    async connect(): Promise<void> {
        try {
            if (!this.isConnected) {
                await this.client.connect();
            }
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.isConnected) {
                await this.client.disconnect();
            }
        } catch (error) {
            console.error('Failed to disconnect from Redis:', error);
        }
    }

    // URL caching methods
    async cacheUrl(shortCode: string, url: any, expirationInSeconds: number = 3600): Promise<void> {
        try {
            if (!this.isConnected) return;
            
            const key = `url:${shortCode}`;
            await this.client.setEx(key, expirationInSeconds, JSON.stringify(url));
        } catch (error) {
            console.error('Error caching URL:', error);
        }
    }

    async getCachedUrl(shortCode: string): Promise<any | null> {
        try {
            if (!this.isConnected) return null;
            
            const key = `url:${shortCode}`;
            const cached = await this.client.get(key);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('Error getting cached URL:', error);
            return null;
        }
    }

    async invalidateUrlCache(shortCode: string): Promise<void> {
        try {
            if (!this.isConnected) return;
            
            const key = `url:${shortCode}`;
            await this.client.del(key);
        } catch (error) {
            console.error('Error invalidating URL cache:', error);
        }
    }

    // Analytics caching
    async cacheUrlAnalytics(urlId: string, analytics: any, expirationInSeconds: number = 300): Promise<void> {
        try {
            if (!this.isConnected) return;
            
            const key = `analytics:${urlId}`;
            await this.client.setEx(key, expirationInSeconds, JSON.stringify(analytics));
        } catch (error) {
            console.error('Error caching analytics:', error);
        }
    }

    async getCachedUrlAnalytics(urlId: string): Promise<any | null> {
        try {
            if (!this.isConnected) return null;
            
            const key = `analytics:${urlId}`;
            const cached = await this.client.get(key);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('Error getting cached analytics:', error);
            return null;
        }
    }

    // User URLs list caching
    async cacheUserUrls(userId: string, page: number, limit: number, isActive: boolean | undefined, urls: any, expirationInSeconds: number = 300): Promise<void> {
        try {
            if (!this.isConnected) return;
            
            const key = `user_urls:${userId}:${page}:${limit}:${isActive ?? 'all'}`;
            await this.client.setEx(key, expirationInSeconds, JSON.stringify(urls));
        } catch (error) {
            console.error('Error caching user URLs:', error);
        }
    }

    async getCachedUserUrls(userId: string, page: number, limit: number, isActive: boolean | undefined): Promise<any | null> {
        try {
            if (!this.isConnected) return null;
            
            const key = `user_urls:${userId}:${page}:${limit}:${isActive ?? 'all'}`;
            const cached = await this.client.get(key);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('Error getting cached user URLs:', error);
            return null;
        }
    }

    async invalidateUserUrlsCache(userId: string): Promise<void> {
        try {
            if (!this.isConnected) return;
            
            const pattern = `user_urls:${userId}:*`;
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(keys);
            }
        } catch (error) {
            console.error('Error invalidating user URLs cache:', error);
        }
    }

    // Increment click count with cache update
    async incrementClickCount(shortCode: string): Promise<void> {
        try {
            if (!this.isConnected) return;
            
            const key = `clicks:${shortCode}`;
            await this.client.incr(key);
            
            // Also update the cached URL if it exists
            const cachedUrl = await this.getCachedUrl(shortCode);
            if (cachedUrl) {
                cachedUrl.clicks = (cachedUrl.clicks || 0) + 1;
                await this.cacheUrl(shortCode, cachedUrl);
            }
        } catch (error) {
            console.error('Error incrementing click count:', error);
        }
    }

    async getClickCount(shortCode: string): Promise<number> {
        try {
            if (!this.isConnected) return 0;
            
            const key = `clicks:${shortCode}`;
            const count = await this.client.get(key);
            return count ? parseInt(count) : 0;
        } catch (error) {
            console.error('Error getting click count:', error);
            return 0;
        }
    }

    // General cache methods
    async set(key: string, value: any, expirationInSeconds?: number): Promise<void> {
        try {
            if (!this.isConnected) return;
            
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            
            if (expirationInSeconds) {
                await this.client.setEx(key, expirationInSeconds, stringValue);
            } else {
                await this.client.set(key, stringValue);
            }
        } catch (error) {
            console.error('Error setting cache:', error);
        }
    }

    async get(key: string): Promise<any> {
        try {
            if (!this.isConnected) return null;
            
            const value = await this.client.get(key);
            if (!value) return null;
            
            try {
                return JSON.parse(value);
            } catch {
                return value; // Return as string if not JSON
            }
        } catch (error) {
            console.error('Error getting cache:', error);
            return null;
        }
    }

    async del(key: string): Promise<void> {
        try {
            if (!this.isConnected) return;
            
            await this.client.del(key);
        } catch (error) {
            console.error('Error deleting cache:', error);
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            if (!this.isConnected) return false;
            
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            console.error('Error checking cache existence:', error);
            return false;
        }
    }

    // Health check
    async isHealthy(): Promise<boolean> {
        try {
            if (!this.isConnected) return false;
            
            const result = await this.client.ping();
            return result === 'PONG';
        } catch (error) {
            console.error('Redis health check failed:', error);
            return false;
        }
    }
}

// Export singleton instance
export const redisService = new RedisService();
export default redisService;
