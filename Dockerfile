# ---- Base ----
FROM node:20-bookworm-slim AS base
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@10.34.4

# ---- Stage 1: Build Admin UI, NestJS API & Prisma seed/migrate scripts ----
FROM base AS builder

COPY package.json pnpm-lock.yaml ./
COPY admin/package.json admin/pnpm-lock.yaml ./admin/
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile \
 && pnpm --dir admin install --frozen-lockfile

COPY tsconfig.json nest-cli.json ./
COPY src ./src
COPY admin ./admin

RUN pnpm run prisma:generate \
 && pnpm run build \
 && ./node_modules/.bin/tsc prisma/seed.ts prisma/migrate-json.ts \
      --outDir dist-seed --module commonjs --target ES2021 \
      --esModuleInterop --skipLibCheck --resolveJsonModule

# ---- Stage 2: Production Runner ----
FROM base AS runner

ENV NODE_ENV=production \
    PORT=3005 \
    UPLOAD_DIR=/app/uploads \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    FFPROBE_PATH=/usr/bin/ffprobe

RUN npm install -g prisma@6.4.1

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

RUN pnpm install --prod --frozen-lockfile \
 && prisma generate \
 && pnpm store prune

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-seed ./dist-seed

RUN mkdir -p /app/uploads

EXPOSE 3005

CMD ["sh", "-c", "prisma db push --skip-generate && node dist-seed/seed.js && node dist/main.js"]
