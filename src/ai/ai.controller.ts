import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { GeminiTextService, NoteGenerationRequest } from './gemini-text.service';
import { ImagenService, GenerateImageBatchDto, RemixImageDto } from './imagen.service';

@ApiTags('AI Engine')
@Controller('api/ai')
export class AiController {
  constructor(
    private readonly geminiTextService: GeminiTextService,
    private readonly imagenService: ImagenService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Check AI service configuration and status' })
  getStatus() {
    return {
      configured: this.geminiTextService.isConfigured(),
      textModels: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
      imageModels: ['imagen-3.0-generate-002', 'imagen-3.0-fast-generate-001'],
    };
  }

  @Post('generate-text')
  @ApiOperation({ summary: 'Generate free-form text or summaries' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string' },
        systemInstruction: { type: 'string' },
        temperature: { type: 'number', default: 0.7 },
      },
    },
  })
  async generateText(
    @Body('prompt') prompt: string,
    @Body('systemInstruction') systemInstruction?: string,
    @Body('temperature') temperature?: number,
  ) {
    const text = await this.geminiTextService.generateText(prompt, systemInstruction, temperature);
    return { text };
  }

  @Post('generate-note')
  @ApiOperation({ summary: 'Generate formatted structured Markdown note content with auto-tags' })
  async generateNote(@Body() req: NoteGenerationRequest) {
    return this.geminiTextService.generateNoteContent(req);
  }

  @Post('parse-quick-add')
  @ApiOperation({ summary: 'Parse messy natural language input into structured calendar note fields' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['rawText'],
      properties: {
        rawText: { type: 'string' },
      },
    },
  })
  async parseQuickAdd(@Body('rawText') rawText: string) {
    return this.geminiTextService.parseQuickAdd(rawText || '');
  }

  @Post('generate-images')
  @ApiOperation({ summary: 'Generate 1..4 candidate images using Imagen 3 and persist to DAM folder' })
  async generateImages(@Body() dto: GenerateImageBatchDto) {
    return this.imagenService.generateBatch(dto);
  }

  @Post('remix-image')
  @ApiOperation({ summary: 'Remix/vary an existing image asset using Gemini Vision and Imagen 3' })
  async remixImage(@Body() dto: RemixImageDto) {
    return this.imagenService.remixAsset(dto);
  }
}
