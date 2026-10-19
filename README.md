# 🍋 Lemon Media Hub (Project Lenta Media & AI Hub)

Standalone AI & Digital Asset Management (DAM) microservice powering:
- **Image Generation (Google Imagen 3)** with batch support (1–4 candidate variations) and themed SVG fallback.
- **Image-to-Image Remixing** utilizing Gemini Vision multimodal analysis to preserve source composition while executing user style transformations, complete with `sourceAssetId` lineage tracking.
- **Native Media Storage**: Sharp-powered WebP optimization (quality 90, 4-pass effort) and automatic 360px thumbnail generation.
- **Virtual & Physical Folder DAM Hierarchy**: Tagging, favorite toggling, usage metrics, and folder organization (`/covers`, `/events-2026`, `/themes`, `/remixes`, `/archive`).
- **Markdown & Note AI Services**: Executive note drafting, structured takeaways, and voice/unstructured quick-add parser.
- **Reusable Client SDK**: Type-safe `LemonMediaClient` for consumption across `lemon-calendarium` and future microservices.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment (`.env`)
```ini
PORT=3005
GEMINI_API_KEY="your-google-ai-studio-api-key"
UPLOAD_DIR="./uploads"
```

### 3. Run Development Server
```bash
pnpm run start:dev
```

### 4. Interactive Swagger Documentation
Open [http://localhost:3005/docs](http://localhost:3005/docs) to test and inspect all API endpoints interactively.

---

## 📁 Architecture & File Layout

```
lemon-media-hub/
├── src/
│   ├── ai/                      # AI Engine
│   │   ├── gemini-text.service.ts   # Text synthesis, quick-add parser, vision image analysis
│   │   ├── imagen.service.ts        # Imagen 3 batch generation, remixing, SVG fallbacks
│   │   ├── ai.controller.ts         # /api/ai endpoints
│   │   └── ai.module.ts
│   ├── assets/                  # Asset Metadata & DAM Registry
│   │   ├── assets.service.ts        # Indexing, search, filtering, usage & lineage tracking
│   │   ├── assets.controller.ts     # /api/assets endpoints (CRUD, upload, favorite, usage)
│   │   └── assets.module.ts
│   ├── folders/                 # Folder DAM System
│   │   ├── folders.service.ts       # Folder tree, preset folders, disk sync
│   │   ├── folders.controller.ts    # /api/folders endpoints
│   │   └── folders.module.ts
│   ├── storage/                 # Physical Disk & Sharp Processing
│   │   ├── storage.service.ts       # WebP conversion, 360px thumbnails, disk persistence
│   │   └── storage.module.ts
│   ├── client/                  # Consumer SDK
│   │   ├── lemon-media-client.ts    # Type-safe client for Lemon Calendarium / external apps
│   │   └── index.ts
│   ├── app.module.ts            # Root module
│   ├── main.ts                  # NestJS bootstrap (Port 3005, CORS, Static uploads, Swagger)
│   └── index.ts
├── uploads/                     # Local storage directory (persisted)
│   ├── media/                   # Full-resolution WebP images
│   ├── thumbs/                  # 360px WebP thumbnails
│   ├── folders-index.json       # Persisted folders registry
│   └── media-index.json         # Persisted assets registry with lineage
├── package.json
└── tsconfig.json
```

---

## 📡 API Overview

### 1. Image Generation & Remixing (`/api/ai`)
* `POST /api/ai/generate-images`:
  ```json
  {
    "prompt": "Golden autumn forest with morning mist and sunlight",
    "style": "cinematic",
    "aspectRatio": "16:9",
    "folderPath": "covers",
    "count": 4
  }
  ```
* `POST /api/ai/remix-image`:
  ```json
  {
    "sourceAssetId": "c88f2845-...",
    "instruction": "Transform into a neon-lit cyberpunk night scene with rain reflections",
    "style": "cyberpunk",
    "count": 2,
    "folderPath": "remixes"
  }
  ```
  *(Preserves composition via Gemini Vision and tracks lineage via `sourceAssetId`)*.

### 2. Note & Text Intelligence (`/api/ai`)
* `POST /api/ai/generate-note`:
  ```json
  {
    "topic": "History of mechanical clocks in Medieval Europe",
    "tone": "academic",
    "tags": ["history", "horology"]
  }
  ```
* `POST /api/ai/parse-quick-add`:
  ```json
  {
    "rawText": "Встреча с командой дизайнеров в следующую пятницу в 15:00 обсудить новую обложку для зимнего сезона"
  }
  ```
  *(Returns structured JSON: `title`, `content`, `tags`, `eventDate`, `priority`, `suggestedCoverPrompt`)*.

### 3. Digital Asset Management (`/api/assets`)
* `GET /api/assets?folderPath=covers&isFavorite=true&search=autumn&limit=20`
* `GET /api/assets/:id`
* `PATCH /api/assets/:id/favorite`
* `POST /api/assets/:id/usage`
* `POST /api/assets/upload` (multipart/form-data)
* `DELETE /api/assets/:id`

### 4. Folder Management (`/api/folders`)
* `GET /api/folders`
* `POST /api/folders`: `{ "name": "Projects", "path": "projects" }`
* `DELETE /api/folders/:id`

---

## 🔌 Consuming via `LemonMediaClient`

In any TypeScript / Node / Frontend app (e.g. `lemon-calendarium`):

```typescript
import { LemonMediaClient } from './lemon-media-client';

const mediaHub = new LemonMediaClient({ baseUrl: 'http://localhost:3005' });

// 1. Generate 4 cover variations
const batch = await mediaHub.ai.generateImages({
  prompt: 'Cosmic library with floating glowing books',
  style: 'cinematic',
  folderPath: 'covers',
  count: 4,
});

console.log(batch.items); // [{ id, url, thumbnailUrl, ... }]

// 2. Remix an existing asset
const remix = await mediaHub.ai.remixImage({
  sourceAssetId: batch.items[0].id,
  instruction: 'Add glowing auroras in the sky and snow on the ground',
  style: 'cinematic',
  count: 2,
});

// 3. Resolve relative URL to full URL
const fullUrl = mediaHub.resolveUrl(remix.items[0].url);
```
