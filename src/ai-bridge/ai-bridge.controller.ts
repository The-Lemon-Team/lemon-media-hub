import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireAdmin } from '../auth/auth.decorators';

@ApiTags('AI Studio Bridge')
@ApiBearerAuth()
@RequireAdmin()
@Controller('api/ai-studio')
export class AiBridgeController {
  private readonly aiBaseUrl?: string;
  private readonly aiApiKey?: string;

  constructor(private readonly config: ConfigService) {
    this.aiBaseUrl = this.config.get<string>('LEMON_AI_SERVICE_URL')?.trim().replace(/\/$/, '') || undefined;
    this.aiApiKey = this.config.get<string>('LEMON_AI_SERVICE_API_KEY')?.trim() || undefined;
  }

  @Get('status')
  @ApiOperation({ summary: 'Check connection to external lemon-ai-service (Admin only)' })
  async getStatus() {
    if (!this.aiBaseUrl) {
      return { configured: false, serviceUrl: null, textModels: [], imageModels: [] };
    }
    try {
      const res = await fetch(`${this.aiBaseUrl}/api/ai/status`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) {
        return { configured: false, serviceUrl: this.aiBaseUrl, textModels: [], imageModels: [] };
      }
      const data = await res.json();
      return {
        ...data,
        serviceUrl: this.aiBaseUrl,
      };
    } catch {
      return { configured: false, serviceUrl: this.aiBaseUrl, textModels: [], imageModels: [] };
    }
  }

  @Post('generate-images')
  @ApiOperation({ summary: 'Delegate image generation from Admin Studio to lemon-ai-service (Admin only)' })
  async generateImages(@Body() body: Record<string, any>) {
    return this.forwardPost('/api/ai/generate-images', body);
  }

  @Post('remix-image')
  @ApiOperation({ summary: 'Delegate image remix from Admin Studio to lemon-ai-service (Admin only)' })
  async remixImage(@Body() body: Record<string, any>) {
    return this.forwardPost('/api/ai/remix-image', body);
  }

  private async forwardPost(endpoint: string, body: Record<string, any>) {
    if (!this.aiBaseUrl) {
      throw new ServiceUnavailableException('LEMON_AI_SERVICE_URL is not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.aiApiKey) {
      headers['X-Ai-Api-Key'] = this.aiApiKey;
    }

    let res: Response;
    try {
      res = await fetch(`${this.aiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
    } catch (err: any) {
      throw new BadGatewayException(`Failed to reach lemon-ai-service: ${err.message}`);
    }

    const data = await res.json().catch(() => ({ message: res.statusText }));
    if (!res.ok) {
      throw new BadGatewayException(data.message || `lemon-ai-service error HTTP ${res.status}`);
    }
    return data;
  }
}
