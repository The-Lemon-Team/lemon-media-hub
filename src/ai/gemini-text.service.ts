import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface NoteGenerationRequest {
  title?: string;
  topic?: string;
  tags?: string[];
  tone?: 'professional' | 'creative' | 'concise' | 'academic';
}

export interface GeneratedNoteResult {
  title: string;
  content: string;
  tags: string[];
  summary: string;
}

export interface QuickAddParsedResult {
  title: string;
  content: string;
  tags: string[];
  eventDate: string | null;
  priority: 'low' | 'normal' | 'high';
  suggestedCoverPrompt: string;
}

export interface ImagePromptSynthesis {
  prompt: string;
  tags: string[];
}

export interface ImageRemixAnalysis {
  remixPrompt: string;
  tags: string[];
  description: string;
}

@Injectable()
export class GeminiTextService {
  private readonly logger = new Logger(GeminiTextService.name);
  private readonly apiKey?: string;
  private readonly flashModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (this.apiKey) {
      this.logger.log('🧠 Gemini Text & Vision AI service initialized with API key.');
    } else {
      this.logger.warn('⚠️ GEMINI_API_KEY not found. AI text & vision services will use heuristic fallbacks.');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private async callGeminiApi(
    contents: any[],
    options?: { systemInstruction?: string; jsonMode?: boolean; temperature?: number; maxTokens?: number },
  ): Promise<any> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const payload: any = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 1500,
      },
    };

    if (options?.jsonMode) {
      payload.generationConfig.responseMimeType = 'application/json';
    }

    if (options?.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    let lastError: any = null;
    for (const model of this.flashModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return options?.jsonMode ? JSON.parse(text) : text;
          }
        } else {
          const errText = await res.text();
          lastError = new Error(`Model ${model} returned HTTP ${res.status}: ${errText.slice(0, 150)}`);
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error('All Gemini models failed to generate content');
  }

  /**
   * General text generation with customizable system instruction.
   */
  async generateText(prompt: string, systemInstruction?: string, temperature = 0.7): Promise<string> {
    if (!this.apiKey) {
      return `[AI Generation offline: GEMINI_API_KEY not set]\n\nPrompt: ${prompt}`;
    }

    try {
      const res = await this.callGeminiApi([{ parts: [{ text: prompt }] }], {
        systemInstruction,
        temperature,
      });
      return typeof res === 'string' ? res : JSON.stringify(res);
    } catch (err: any) {
      this.logger.error(`generateText error: ${err.message}`);
      return `Failed to generate text: ${err.message}`;
    }
  }

  /**
   * Generates formatted Markdown notes with structured headings and auto-tags.
   */
  async generateNoteContent(req: NoteGenerationRequest): Promise<GeneratedNoteResult> {
    const topic = req.topic || req.title || 'Untitled note';
    const tone = req.tone || 'professional';

    if (!this.apiKey) {
      return {
        title: req.title || topic,
        content: `## ${req.title || topic}\n\n*Generated in offline mode*\n\n- Overview for ${topic}\n- Key observations`,
        tags: req.tags || ['notes'],
        summary: `Note regarding ${topic}`,
      };
    }

    const systemInstruction = `You are an expert research assistant and knowledge curator.
Generate a structured, insightful, beautifully formatted Markdown note based on the user's input.
Tone: ${tone}.
Return strictly a JSON object:
{
  "title": "Clear concise note title",
  "summary": "1-2 sentence executive summary",
  "content": "Full markdown content with sections (## Overview, ## Key Takeaways, ## Chronology/Points, ## Action Items/Conclusions)",
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const prompt = `Topic/Concept: ${topic}\nExisting Title: ${req.title || 'None'}\nTags requested: ${(req.tags || []).join(', ')}`;

    try {
      const parsed = await this.callGeminiApi([{ parts: [{ text: prompt }] }], {
        systemInstruction,
        jsonMode: true,
        temperature: 0.6,
      });

      return {
        title: parsed.title || topic,
        content: parsed.content || `## ${topic}\n\nNo detailed content generated.`,
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['ai-note'],
        summary: parsed.summary || topic,
      };
    } catch (err: any) {
      this.logger.warn(`generateNoteContent fallback: ${err.message}`);
      return {
        title: req.title || topic,
        content: `## ${req.title || topic}\n\n${topic}\n\n*(AI service error: ${err.message})*`,
        tags: req.tags || ['draft'],
        summary: topic,
      };
    }
  }

  /**
   * Parses quick-add unstructured inputs (voice notes, rough drafts, event blurbs) into structured note entities.
   */
  async parseQuickAdd(rawText: string): Promise<QuickAddParsedResult> {
    if (!this.apiKey) {
      return {
        title: rawText.slice(0, 50).trim() || 'Quick Note',
        content: rawText,
        tags: ['quick-add'],
        eventDate: null,
        priority: 'normal',
        suggestedCoverPrompt: `${rawText.slice(0, 40)}, cinematic, calendar art`,
      };
    }

    const systemInstruction = `You are an intelligent calendar and knowledge organizer.
Analyze the user's raw note or thought dump and extract structured information.
Today's date is: ${new Date().toISOString().split('T')[0]}.
Return strictly a JSON object:
{
  "title": "Concise clean title (max 60 chars)",
  "content": "Refined and clean markdown note body preserving all essential details",
  "tags": ["tag1", "tag2", "tag3"],
  "eventDate": "YYYY-MM-DD or null if no specific date/event mentioned",
  "priority": "low" | "normal" | "high",
  "suggestedCoverPrompt": "A vivid 15-25 word English visual scene description suitable for image generation"
}`;

    try {
      const parsed = await this.callGeminiApi([{ parts: [{ text: `Raw input:\n${rawText}` }] }], {
        systemInstruction,
        jsonMode: true,
        temperature: 0.4,
      });

      return {
        title: parsed.title || 'Quick Note',
        content: parsed.content || rawText,
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['quick-add'],
        eventDate: parsed.eventDate || null,
        priority: ['low', 'normal', 'high'].includes(parsed.priority) ? parsed.priority : 'normal',
        suggestedCoverPrompt: parsed.suggestedCoverPrompt || `${parsed.title || 'Calendar event'}, cinematic illustration`,
      };
    } catch (err: any) {
      this.logger.warn(`parseQuickAdd fallback: ${err.message}`);
      return {
        title: rawText.slice(0, 50).trim() || 'Quick Note',
        content: rawText,
        tags: ['quick-add'],
        eventDate: null,
        priority: 'normal',
        suggestedCoverPrompt: `${rawText.slice(0, 30)}, cinematic artwork`,
      };
    }
  }

  /**
   * Art director prompt synthesis for Imagen 3.
   */
  async synthesizeImagePrompt(subject: string, visualStyle = 'cinematic', context?: string): Promise<ImagePromptSynthesis> {
    if (!this.apiKey) {
      return {
        prompt: `${subject}, ${visualStyle} style, high quality artwork`,
        tags: [visualStyle, 'digital-art'],
      };
    }

    const systemPrompt = `You are an expert art director and prompt engineer for Imagen 3 and digital calendar visuals.
Transform the given subject or topic into a single evocative English image generation prompt.

Styles reference:
- 'photorealistic' / 'photo': 35mm photography, natural cinematic lighting, authentic textures, sharp focus, hyperdetailed depth of field.
- 'editorial' / 'magazine': Modern editorial photography, high-contrast framing, National Geographic / Vogue aesthetic.
- 'minimalist' / 'flat': Modern flat vector graphic, clean geometry, bold Swiss design layout, balanced negative space.
- 'cyberpunk' / 'scifi': Volumetric neon lighting, rain-slicked surfaces, retro-futuristic interfaces, atmospheric fog.
- 'vintage' / 'historical': Period-accurate archival aesthetic, sepia/matte tones, rich grain, classic oil painting texture.
- 'cinematic' (default): 8k resolution, dramatic anamorphic lighting, photorealistic cinematic film still, atmospheric haze.

Subject: "${subject}"
Style: "${visualStyle}"
${context ? `Context: "${context.slice(0, 300)}"` : ''}

Output strictly valid JSON:
{
  "prompt": "Final prompt in English (max 70 words, no quotes)",
  "tags": ["tag1", "tag2", "tag3"]
}`;

    try {
      const parsed = await this.callGeminiApi([{ parts: [{ text: systemPrompt }] }], {
        jsonMode: true,
        temperature: 0.6,
        maxTokens: 250,
      });

      return {
        prompt: parsed.prompt?.trim() || `${subject}, ${visualStyle}`,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [visualStyle],
      };
    } catch {
      return {
        prompt: `${subject}, ${visualStyle} style, high definition atmospheric artwork`,
        tags: [visualStyle],
      };
    }
  }

  /**
   * Multimodal vision inspection of a source image buffer for remixing.
   */
  async analyzeImageForRemix(
    imageBuffer: Buffer,
    mimeType: string,
    remixInstruction: string,
    targetStyle = 'cinematic',
  ): Promise<ImageRemixAnalysis> {
    if (!this.apiKey) {
      return {
        remixPrompt: `${remixInstruction}, inspired by original image, ${targetStyle} style`,
        tags: ['remix', targetStyle],
        description: 'Original image visual base with requested modifications',
      };
    }

    const base64Data = imageBuffer.toString('base64');
    const systemPrompt = `You are a visual director specializing in image variation and remixing for Imagen 3.
Inspect the attached image carefully, then incorporate the user's remix instruction.
Preserve the key compositional balance, perspective, and core subject identity of the original image,
while seamlessly applying the requested stylistic, atmospheric, or contextual modifications.

Requested Modification: "${remixInstruction}"
Target Style: "${targetStyle}"

Return strictly valid JSON:
{
  "remixPrompt": "Vivid English prompt (max 70 words) for Imagen 3 that describes the transformed scene with original composition preserved",
  "description": "Short explanation of what was changed vs preserved",
  "tags": ["tag1", "tag2", "remix"]
}`;

    const contents = [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
              data: base64Data,
            },
          },
          { text: systemPrompt },
        ],
      },
    ];

    try {
      const parsed = await this.callGeminiApi(contents, {
        jsonMode: true,
        temperature: 0.5,
        maxTokens: 300,
      });

      return {
        remixPrompt: parsed.remixPrompt?.trim() || `${remixInstruction}, ${targetStyle} aesthetic, cinematic artwork`,
        description: parsed.description || 'Remixed variation',
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['remix', targetStyle],
      };
    } catch (err: any) {
      this.logger.warn(`analyzeImageForRemix vision call fallback: ${err.message}`);
      return {
        remixPrompt: `${remixInstruction}, high fidelity variation, ${targetStyle} style`,
        description: `Remix based on instruction: ${remixInstruction}`,
        tags: ['remix', targetStyle],
      };
    }
  }
}
