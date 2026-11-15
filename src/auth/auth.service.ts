import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, scryptSync, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCallerContext, ClientCallerContext, MediaCallerContext } from './auth.types';

export const ADMIN_COOKIE_NAME = 'lmh_admin_token';

interface JwtPayload {
  sub: string;
  role: 'admin';
  iat: number;
  exp: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly adminUsername: string;
  private readonly adminPassword?: string;
  private readonly adminPasswordHash?: string;
  private readonly jwtSecret: string;
  private readonly signingSecret: string;
  private readonly tokenTtlSeconds: number;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.adminUsername = this.config.get<string>('ADMIN_USERNAME') || 'admin';
    this.adminPassword = this.config.get<string>('ADMIN_PASSWORD') || 'lemon_admin_change_me';
    this.adminPasswordHash = this.config.get<string>('ADMIN_PASSWORD_HASH')?.trim() || undefined;
    this.jwtSecret = this.config.get<string>('JWT_SECRET') || 'lemon_media_jwt_secret_change_me';
    this.signingSecret =
      this.config.get<string>('MEDIA_SIGNING_SECRET') || 'lemon_media_signing_secret_change_me';
    this.tokenTtlSeconds = Number(this.config.get<string>('ADMIN_TOKEN_TTL_SECONDS')) || 60 * 60 * 24 * 7;

    if (!this.adminPasswordHash && this.adminPassword === 'lemon_admin_change_me') {
      this.logger.warn('Using default dev ADMIN_PASSWORD; override in .env for production.');
    }
  }

  getCookieName(): string {
    return ADMIN_COOKIE_NAME;
  }

  getTokenTtlSeconds(): number {
    return this.tokenTtlSeconds;
  }

  hashApiKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  verifyAdminCredentials(username: string, password: string): boolean {
    if (!username || !password) return false;
    if (username !== this.adminUsername) return false;

    if (this.adminPasswordHash && this.adminPasswordHash.startsWith('scrypt:')) {
      const parts = this.adminPasswordHash.split(':');
      if (parts.length !== 3) return false;
      const [, salt, expectedHex] = parts;
      const derived = scryptSync(password, salt, 64);
      const expected = Buffer.from(expectedHex, 'hex');
      if (derived.length !== expected.length) return false;
      return timingSafeEqual(derived, expected);
    }

    const a = Buffer.from(password, 'utf-8');
    const b = Buffer.from(this.adminPassword || '', 'utf-8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  signAdminToken(username: string): string {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: username,
        role: 'admin',
        iat: now,
        exp: now + this.tokenTtlSeconds,
      } satisfies JwtPayload),
    ).toString('base64url');
    const sig = createHmac('sha256', this.jwtSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');
    return `${header}.${payload}.${sig}`;
  }

  verifyAdminToken(token: string): AdminCallerContext | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const [header, payloadB64, sig] = parts;
      const expectedSig = createHmac('sha256', this.jwtSecret)
        .update(`${header}.${payloadB64}`)
        .digest('base64url');
      const a = Buffer.from(sig, 'utf-8');
      const b = Buffer.from(expectedSig, 'utf-8');
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as JwtPayload;
      if (payload.role !== 'admin') return null;
      if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
      return { type: 'admin', username: payload.sub };
    } catch {
      return null;
    }
  }

  extractTokenFromRequest(req: any): string | undefined {
    const authHeader = req.headers?.authorization as string | undefined;
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7).trim();
    }
    const cookieHeader = req.headers?.cookie as string | undefined;
    if (cookieHeader) {
      const parts = cookieHeader.split(';');
      for (const part of parts) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const name = part.slice(0, idx).trim();
        if (name === ADMIN_COOKIE_NAME) {
          return decodeURIComponent(part.slice(idx + 1).trim());
        }
      }
    }
    const queryToken = (req.query?.token as string | undefined)?.trim();
    if (queryToken) {
      return queryToken;
    }
    return undefined;
  }

  async resolveClientByApiKey(rawKey: string): Promise<ClientCallerContext | null> {
    if (!rawKey) return null;
    const keyHash = this.hashApiKey(rawKey);
    const client = await this.prisma.serviceClient.findUnique({
      where: { apiKeyHash: keyHash },
    });
    if (!client || !client.isActive) return null;
    return {
      type: 'client',
      clientId: client.id,
      slug: client.slug,
      name: client.name,
      scopes: client.scopes,
    };
  }

  async resolveCallerFromRequest(req: any): Promise<MediaCallerContext | null> {
    const jwt = this.extractTokenFromRequest(req);
    if (jwt) {
      const admin = this.verifyAdminToken(jwt);
      if (admin) return admin;
    }

    const rawApiKey =
      (req.headers?.['x-media-api-key'] as string | undefined)?.trim() ||
      (req.query?.apiKey as string | undefined)?.trim();
    if (rawApiKey) {
      const client = await this.resolveClientByApiKey(rawApiKey);
      if (client) return client;
    }

    return null;
  }

  signMediaUrl(params: {
    assetId: string;
    variant: string;
    expUnixSec: number;
    clientSlug?: string;
  }): string {
    const payload = `${params.assetId}:${params.variant}:${params.expUnixSec}:${params.clientSlug || ''}`;
    return createHmac('sha256', this.signingSecret).update(payload).digest('base64url');
  }

  verifyMediaSignature(params: {
    assetId: string;
    variant: string;
    exp: string | undefined;
    sig: string | undefined;
    clientSlug?: string;
  }): boolean {
    if (!params.exp || !params.sig) return false;
    const expUnixSec = Number(params.exp);
    if (!Number.isFinite(expUnixSec) || expUnixSec < Math.floor(Date.now() / 1000)) {
      return false;
    }
    const expected = this.signMediaUrl({
      assetId: params.assetId,
      variant: params.variant,
      expUnixSec,
      clientSlug: params.clientSlug,
    });
    const a = Buffer.from(params.sig, 'utf-8');
    const b = Buffer.from(expected, 'utf-8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
