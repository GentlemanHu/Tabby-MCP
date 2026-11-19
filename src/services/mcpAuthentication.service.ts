import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { McpApiKey } from '../types/types';

export interface GeneratedMcpApiKey {
    record: McpApiKey;
    secret: string;
}

export function generateMcpApiKey(name: string): GeneratedMcpApiKey {
    const secret = `tmcp_${randomBytes(32).toString('hex')}`;
    return {
        secret,
        record: {
            id: `key_${randomBytes(12).toString('hex')}`,
            name: name.trim() || 'Unnamed key',
            keyHash: hashMcpApiKey(secret),
            keyPrefix: secret.slice(0, 13),
            createdAt: new Date().toISOString()
        }
    };
}

export function hashMcpApiKey(secret: string): string {
    return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function matchesMcpApiKey(secret: string, expectedHash: string): boolean {
    const actual = Buffer.from(hashMcpApiKey(secret), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}
