import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  private generateApiKey(): { rawKey: string; prefix: string; hash: string } {
    const rawKey = `lmh_${randomBytes(24).toString('hex')}`;
    return {
      rawKey,
      prefix: rawKey.slice(0, 12) + '...',
      hash: this.hashKey(rawKey),
    };
  }

  async listClients() {
    const rows = await this.prisma.serviceClient.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { grants: true } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      apiKeyPrefix: c.apiKeyPrefix,
      scopes: c.scopes,
      isActive: c.isActive,
      grantsCount: c._count.grants,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  async createClient(params: { slug: string; name: string; scopes?: string[] }) {
    const cleanSlug = params.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-');
    if (!cleanSlug) throw new BadRequestException('Invalid client slug');

    const existing = await this.prisma.serviceClient.findUnique({ where: { slug: cleanSlug } });
    if (existing) {
      throw new BadRequestException(`Service client '${cleanSlug}' already exists`);
    }

    const { rawKey, prefix, hash } = this.generateApiKey();
    const client = await this.prisma.serviceClient.create({
      data: {
        slug: cleanSlug,
        name: params.name.trim(),
        apiKeyHash: hash,
        apiKeyPrefix: prefix,
        scopes: params.scopes?.length ? params.scopes : ['media:read'],
        isActive: true,
      },
    });

    return {
      id: client.id,
      slug: client.slug,
      name: client.name,
      apiKeyPrefix: client.apiKeyPrefix,
      apiKey: rawKey, // Returned once on creation
      scopes: client.scopes,
      isActive: client.isActive,
      createdAt: client.createdAt.toISOString(),
    };
  }

  async updateClient(
    id: string,
    params: { name?: string; scopes?: string[]; isActive?: boolean },
  ) {
    const existing = await this.prisma.serviceClient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Service client '${id}' not found`);

    const updated = await this.prisma.serviceClient.update({
      where: { id },
      data: {
        ...(params.name !== undefined ? { name: params.name.trim() } : {}),
        ...(params.scopes !== undefined ? { scopes: params.scopes } : {}),
        ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      },
    });

    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      apiKeyPrefix: updated.apiKeyPrefix,
      scopes: updated.scopes,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async rotateKey(id: string) {
    const existing = await this.prisma.serviceClient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Service client '${id}' not found`);

    const { rawKey, prefix, hash } = this.generateApiKey();
    const updated = await this.prisma.serviceClient.update({
      where: { id },
      data: {
        apiKeyHash: hash,
        apiKeyPrefix: prefix,
      },
    });

    return {
      id: updated.id,
      slug: updated.slug,
      apiKeyPrefix: updated.apiKeyPrefix,
      apiKey: rawKey,
    };
  }

  async deleteClient(id: string) {
    const existing = await this.prisma.serviceClient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Service client '${id}' not found`);
    await this.prisma.serviceClient.delete({ where: { id } });
    return { success: true };
  }
}
