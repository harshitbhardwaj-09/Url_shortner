import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

export function generateToken(userId: string): string {
    return jwt.sign(
        { id: userId }, 
        JWT_SECRET, 
        { expiresIn: '1h' }
    );
}

export function verifyToken(token: string): { id: string } | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        return decoded;
    } catch (error) {
        return null;
    }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7); // Remove 'Bearer ' prefix
}

