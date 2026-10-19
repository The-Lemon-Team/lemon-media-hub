import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import { AssetsService, MediaAsset } from '../assets/assets.service';
import { FoldersService } from '../folders/folders.service';
import { GeminiTextService } from './gemini-text.service';

export type ImageAspectRatio = '16:9' | '1:1' | '9:16' | '4:3' | '3:4';

export interface GenerateImageBatchDto {
  prompt: string;
  style?: string;
  aspectRatio?: ImageAspectRatio;
  folderPath?: string;
  count?: number; // 1 to 4
  tags?: string[];
  context?: string;
}

export interface RemixImageDto {
  sourceAssetId: string;
  instruction: string;
  style?: string;
  aspectRatio?: ImageAspectRatio;
  folderPath?: string; // defaults to 'remixes'
  count?: number; // 1 to 4
}

export interface BatchGenerationResult {
  synthesizedPrompt: string;
  model: string;
  isFallback: boolean;
  folderPath: string;
  items: MediaAsset[];
}

export interface RemixGenerationResult {
  sourceAsset: MediaAsset;
  remixPrompt: string;
  description: string;
  model: string;
  isFallback: boolean;
  folderPath: string;
  items: MediaAsset[];
}

@Injectable()
export class ImagenService {
  private readonly logger = new Logger(ImagenService.name);
  private readonly apiKey?: string;
  private readonly imagenModels = ['imagen-3.0-generate-002', 'imagen-3.0-fast-generate-001'];

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly assetsService: AssetsService,
    private readonly foldersService: FoldersService,
    private readonly geminiTextService: GeminiTextService,
  ) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
  }

  async callImagenApi(
    prompt: string,
    aspectRatio: ImageAspectRatio = '16:9',
    sampleCount = 1,
  ): Promise<Buffer[]> {
    if (!this.apiKey) return [];

    const validAspects: ImageAspectRatio[] = ['16:9', '1:1', '9:16', '4:3', '3:4'];
    const chosenAspect = validAspects.includes(aspectRatio) ? aspectRatio : '16:9';
    const count = Math.min(Math.max(sampleCount, 1), 4);

    for (const model of this.imagenModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${this.apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: count,
              aspectRatio: chosenAspect,
              outputMimeType: 'image/jpeg',
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const predictions = data?.predictions || [];
          const buffers = predictions
            .map((p: any) => (p?.bytesBase64Encoded ? Buffer.from(p.bytesBase64Encoded, 'base64') : null))
            .filter(Boolean) as Buffer[];

          if (buffers.length > 0) return buffers;
        } else {
          const errText = await response.text();
          this.logger.warn(`Imagen model ${model} HTTP ${response.status}: ${errText.slice(0, 160)}`);
        }
      } catch (err: any) {
        this.logger.warn(`Imagen model ${model} call failed: ${err.message}`);
      }
    }

    return [];
  }

  generateFallbackSvg(title: string, subtitle?: string, accent = '#f59e0b', variant = 0): Buffer {
    const cleanTitle = (title || 'Lemon Media Hub').replace(/[<>&"]/g, '');
    const cleanSub = (subtitle || 'Media & AI Asset').slice(0, 100).replace(/[<>&"]/g, '');
    const dateStr = new Date().toISOString().split('T')[0];

    const svg = `<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b0f17" />
      <stop offset="55%" stop-color="#141a24" />
      <stop offset="100%" stop-color="#080c12" />
    </linearGradient>
    <radialGradient id="glow" cx="${variant % 2 === 0 ? '82%' : '18%'}" cy="22%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <rect width="100%" height="100%" fill="url(#glow)" />
  <line x1="80" y1="120" x2="1200" y2="120" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
  <line x1="80" y1="600" x2="1200" y2="600" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
  <rect x="80" y="80" width="180" height="30" rx="6" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="1.2" />
  <text x="170" y="100" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="${accent}" text-anchor="middle" letter-spacing="1">LEMON MEDIA • AI</text>
  <text x="80" y="270" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="800" fill="#ffffff">${cleanTitle}</text>
  <text x="80" y="340" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="400" fill="#9ca3af">${cleanSub}</text>
  <text x="80" y="580" font-family="monospace, monospace" font-size="13" fill="#6b7280" letter-spacing="1">GENERATIVE ASSET • ${dateStr} • VARIANT #${variant + 1}</text>
</svg>`;

    return Buffer.from(svg, 'utf-8');
  }

  async generateBatch(dto: GenerateImageBatchDto): Promise<BatchGenerationResult> {
    const style = dto.style || 'cinematic';
    const aspectRatio = dto.aspectRatio || '16:9';
    const folderPath = dto.folderPath ? dto.folderPath.replace(/^\/|\/$/g, '') : 'covers';
    const count = Math.min(Math.max(dto.count || 2, 1), 4);

    const folder = await this.foldersService.getFolderByPath(folderPath);

    // 1. Synthesize vivid English prompt
    const { prompt: synthesizedPrompt, tags: synthesizedTags } = await this.geminiTextService.synthesizeImagePrompt(
      dto.prompt,
      style,
      dto.context,
    );

    const mergedTags = Array.from(new Set([...(dto.tags || []), ...synthesizedTags, style]));

    // 2. Try Imagen 3 API
    let rawBuffers = await this.callImagenApi(synthesizedPrompt, aspectRatio, count);
    let isFallback = false;
    let modelName = 'imagen-3.0-generate-002';

    if (rawBuffers.length === 0) {
      this.logger.warn(`Using styled SVG fallbacks for batch "${dto.prompt}"`);
      isFallback = true;
      modelName = 'svg-fallback';
      const accents = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];
      rawBuffers = Array.from({ length: count }, (_, i) =>
        this.generateFallbackSvg(dto.prompt, `${style} generation fallback`, accents[i % accents.length], i),
      );
    }

    // 3. Process & save each buffer to Storage & DAM Registry
    const savedAssets: MediaAsset[] = [];
    for (let i = 0; i < rawBuffers.length; i++) {
      const buf = rawBuffers[i];
      const isSvg = isFallback;
      const originalName = isSvg ? `ai-${Date.now()}-v${i + 1}.svg` : `ai-${Date.now()}-v${i + 1}.jpg`;

      const processed = await this.storageService.processAndSaveBuffer(buf, originalName, isSvg);

      const asset = await this.assetsService.saveAsset({
        url: processed.url,
        thumbnailUrl: processed.thumbnailUrl,
        filename: processed.filename,
        folderId: folder?.id,
        folderPath,
        prompt: synthesizedPrompt,
        userPrompt: dto.prompt,
        style,
        aspectRatio,
        model: modelName,
        sourceAssetId: null,
        width: processed.width,
        height: processed.height,
        sizeBytes: processed.sizeBytes,
        mimeType: processed.mimeType,
        tags: mergedTags,
        isFavorite: false,
      });

      savedAssets.push(asset);
    }

    return {
      synthesizedPrompt,
      model: modelName,
      isFallback,
      folderPath,
      items: savedAssets,
    };
  }

  async remixAsset(dto: RemixImageDto): Promise<RemixGenerationResult> {
    const sourceAsset = await this.assetsService.getAssetById(dto.sourceAssetId);
    if (!sourceAsset) {
      throw new NotFoundException(`Source asset '${dto.sourceAssetId}' not found for remix`);
    }

    const style = dto.style || sourceAsset.style || 'cinematic';
    const aspectRatio = dto.aspectRatio || (sourceAsset.aspectRatio as ImageAspectRatio) || '16:9';
    const folderPath = dto.folderPath ? dto.folderPath.replace(/^\/|\/$/g, '') : 'remixes';
    const count = Math.min(Math.max(dto.count || 2, 1), 4);

    const folder = await this.foldersService.getFolderByPath(folderPath);

    // 1. Fetch source image buffer from storage
    const sourceFile = await this.storageService.getBufferFromUrl(sourceAsset.url);
    let remixPrompt = `${dto.instruction}, variation of ${sourceAsset.prompt || sourceAsset.filename}`;
    let remixDescription = `Variation based on asset #${sourceAsset.id.slice(0, 8)}`;
    let remixTags: string[] = ['remix', style];

    if (sourceFile) {
      // 2. Multimodal Vision analysis via Gemini Flash
      const analysis = await this.geminiTextService.analyzeImageForRemix(
        sourceFile.buffer,
        sourceFile.mimeType,
        dto.instruction,
        style,
      );
      remixPrompt = analysis.remixPrompt;
      remixDescription = analysis.description;
      remixTags = Array.from(new Set([...analysis.tags, ...sourceAsset.tags, 'remix']));
    }

    // 3. Call Imagen 3 with synthesized remix prompt
    let rawBuffers = await this.callImagenApi(remixPrompt, aspectRatio, count);
    let isFallback = false;
    let modelName = 'imagen-3.0-generate-002';

    if (rawBuffers.length === 0) {
      isFallback = true;
      modelName = 'svg-fallback';
      const accents = ['#ec4899', '#8b5cf6', '#06b6d4', '#f59e0b'];
      rawBuffers = Array.from({ length: count }, (_, i) =>
        this.generateFallbackSvg(`Remix: ${dto.instruction}`, `Source: ${sourceAsset.filename}`, accents[i % accents.length], i),
      );
    }

    // 4. Register remixed assets in target folder with sourceAssetId link
    const savedAssets: MediaAsset[] = [];
    for (let i = 0; i < rawBuffers.length; i++) {
      const buf = rawBuffers[i];
      const isSvg = isFallback;
      const originalName = isSvg ? `remix-${Date.now()}-v${i + 1}.svg` : `remix-${Date.now()}-v${i + 1}.jpg`;

      const processed = await this.storageService.processAndSaveBuffer(buf, originalName, isSvg);

      const asset = await this.assetsService.saveAsset({
        url: processed.url,
        thumbnailUrl: processed.thumbnailUrl,
        filename: processed.filename,
        folderId: folder?.id,
        folderPath,
        prompt: remixPrompt,
        userPrompt: dto.instruction,
        style,
        aspectRatio,
        model: modelName,
        sourceAssetId: sourceAsset.id, // Preserves image lineage
        width: processed.width,
        height: processed.height,
        sizeBytes: processed.sizeBytes,
        mimeType: processed.mimeType,
        tags: remixTags,
        isFavorite: false,
      });

      savedAssets.push(asset);
    }

    // Increment source asset usage
    await this.assetsService.incrementUsage(sourceAsset.id);

    return {
      sourceAsset,
      remixPrompt,
      description: remixDescription,
      model: modelName,
      isFallback,
      folderPath,
      items: savedAssets,
    };
  }
}
