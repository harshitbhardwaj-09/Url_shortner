import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { 
    urlCreationLimiter,
    redirectLimiter,
    analyticsLimiter
} from '../middleware/rate-limiter.middleware';
import {
    createUrlPostRequestBodySchema,
    updateUrlPutRequestBodySchema,
    listUrlsQuerySchema
} from '../validation/request.validation';
import {
    createUrl,
    getUrlByShortCode,
    getUserUrls,
    getUrlById,
    updateUrl,
    deleteUrl,
    incrementClickCount,
    getUrlAnalytics
} from '../services/url.service';

const router = express.Router();

// Create new shortened URL (Protected)
router.post('/create', urlCreationLimiter, authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
        const validationResult = await createUrlPostRequestBodySchema.safeParseAsync(req.body);
        
        if (validationResult.error) {
            return res.status(400).json({ error: validationResult.error.message });
        }

        const { originalUrl, customShortCode, expiresAt } = validationResult.data;
        const userId = req.userId!;

        const url = await createUrl({
            originalUrl,
            userId,
            customShortCode,
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        });

        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        
        return res.status(201).json({
            data: {
                id: url.id,
                originalUrl: url.originalUrl,
                shortCode: url.shortCode,
                shortUrl: `${baseUrl}/${url.shortCode}`,
                clicks: url.clicks,
                expiresAt: url.expiresAt,
                createdAt: url.createdAt,
            }
        });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

// Get user's URLs with pagination (Protected)
router.get('/list', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
        const queryValidation = listUrlsQuerySchema.safeParse(req.query);
        
        if (queryValidation.error) {
            return res.status(400).json({ error: queryValidation.error.message });
        }

        const { page, limit, isActive } = queryValidation.data;
        const userId = req.userId!;

        const result = await getUserUrls(userId, page, limit, isActive);
        
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        
        const urlsWithShortUrl = result.urls.map((url: any) => ({
            ...url,
            shortUrl: `${baseUrl}/${url.shortCode}`,
        }));

        return res.json({
            data: urlsWithShortUrl,
            pagination: result.pagination,
        });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

// Get URL analytics (Protected)
router.get('/:id/analytics', analyticsLimiter, authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId!;

        const analytics = await getUrlAnalytics(id, userId);

        if (!analytics) {
            return res.status(404).json({ error: 'URL not found' });
        }

        return res.json({ data: analytics });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

// Update URL (Protected)
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId!;

        const validationResult = await updateUrlPutRequestBodySchema.safeParseAsync(req.body);
        
        if (validationResult.error) {
            return res.status(400).json({ error: validationResult.error.message });
        }

        const { originalUrl, isActive, expiresAt } = validationResult.data;

        const updatedUrl = await updateUrl(id, userId, {
            originalUrl,
            isActive,
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        });

        if (!updatedUrl) {
            return res.status(404).json({ error: 'URL not found or unauthorized' });
        }

        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

        return res.json({
            data: {
                ...updatedUrl,
                shortUrl: `${baseUrl}/${updatedUrl.shortCode}`,
            }
        });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

// Delete URL (Protected)
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId!;

        const deletedUrl = await deleteUrl(id, userId);

        if (!deletedUrl) {
            return res.status(404).json({ error: 'URL not found or unauthorized' });
        }

        return res.json({
            message: 'URL deleted successfully',
            data: { id: deletedUrl.id }
        });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

// Redirect to original URL (Public route - no auth required)
router.get('/:shortCode', redirectLimiter, async (req, res) => {
    try {
        const { shortCode } = req.params;

        const url = await getUrlByShortCode(shortCode);

        if (!url) {
            return res.status(404).json({ error: 'Short URL not found' });
        }

        // Check if URL has expired
        if (url.expiresAt && new Date() > url.expiresAt) {
            return res.status(410).json({ error: 'Short URL has expired' });
        }

        // Increment click count with analytics data
        const userAgent = req.get('User-Agent');
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const referrer = req.get('Referer');
        
        await incrementClickCount(shortCode, userAgent, ipAddress, referrer);

        // Redirect to original URL
        return res.redirect(301, url.originalUrl);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;
