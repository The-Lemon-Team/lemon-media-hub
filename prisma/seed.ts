import { createHash } from 'crypto';
import { MediaVisibility, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

const DEFAULT_CLIENTS = [
  {
    slug: 'lemon-calendarium',
    name: 'Lemon Calendarium',
    rawKey: 'lmh_dev_calendarium_key',
    scopes: ['media:read', 'media:write'],
  },
  {
    slug: 'lemon-seasons',
    name: 'Lemon Seasons',
    rawKey: 'lmh_dev_seasons_key',
    scopes: ['media:read', 'media:write', 'media:publish'],
  },
  {
    slug: 'smart-botanik',
    name: 'Smart Botanik (Growing App)',
    rawKey: 'lmh_dev_botanik_key',
    scopes: ['media:read', 'media:write'],
  },
  {
    slug: 'lemon-ai-service',
    name: 'Lemon AI Service',
    rawKey: 'lmh_dev_ai_service_key',
    scopes: ['media:read', 'media:write', 'media:publish'],
  },
];

const DEFAULT_FOLDERS = [
  { name: 'Обложки заметок', path: 'covers', icon: 'sparkles', color: '#f59e0b' },
  { name: 'События 2026', path: 'events-2026', icon: 'calendar', color: '#38bdf8' },
  { name: 'Темы и арты', path: 'themes', icon: 'palette', color: '#a855f7' },
  { name: 'Ремиксы и вариации', path: 'remixes', icon: 'layers', color: '#10b981' },
  { name: 'Видео и ролики', path: 'videos', icon: 'video', color: '#ef4444' },
  { name: 'Аудио и музыка', path: 'audio', icon: 'music', color: '#06b6d4' },
  { name: 'Архив', path: 'archive', icon: 'archive', color: '#64748b' },
];

async function main() {
  for (const client of DEFAULT_CLIENTS) {
    await prisma.serviceClient.upsert({
      where: { slug: client.slug },
      update: {
        name: client.name,
        scopes: client.scopes,
        isActive: true,
      },
      create: {
        slug: client.slug,
        name: client.name,
        apiKeyHash: hashKey(client.rawKey),
        apiKeyPrefix: client.rawKey.slice(0, 12) + '...',
        scopes: client.scopes,
        isActive: true,
      },
    });
  }

  for (const folder of DEFAULT_FOLDERS) {
    await prisma.mediaFolder.upsert({
      where: { path: folder.path },
      update: {},
      create: {
        name: folder.name,
        path: folder.path,
        icon: folder.icon,
        color: folder.color,
        defaultVisibility: MediaVisibility.PRIVATE,
      },
    });
  }

  console.log('Seeded ServiceClient apps:', DEFAULT_CLIENTS.map((c) => `${c.slug} (${c.rawKey})`).join(', '));
  console.log('Ensured default MediaFolder entries.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
