import { Controller, MessageEvent, Query, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MediaKind } from '@prisma/client';
import { Observable, map } from 'rxjs';
import { MediaCaller, RequireScope } from '../auth/auth.decorators';
import { MediaCallerContext } from '../auth/auth.types';
import { MediaEventsService } from './media-events.service';

@ApiTags('Media Events Stream')
@ApiBearerAuth()
@Controller('api/media')
export class MediaEventsController {
  constructor(private readonly mediaEvents: MediaEventsService) {}

  @Sse('stream')
  @RequireScope('media:read')
  @ApiOperation({
    summary:
      'Multiplexed Server-Sent Events (SSE) impulse stream for live media addition, processing, viewing, access updates, and deletion',
  })
  @ApiQuery({ name: 'folderPath', required: false })
  @ApiQuery({ name: 'kind', required: false, enum: MediaKind })
  @ApiQuery({ name: 'assetId', required: false })
  streamEvents(
    @MediaCaller() caller: MediaCallerContext,
    @Query('folderPath') folderPath?: string,
    @Query('kind') kind?: MediaKind,
    @Query('assetId') assetId?: string,
  ): Observable<MessageEvent> {
    return this.mediaEvents
      .observeFiltered(caller, {
        folderPath,
        kind,
        assetId,
      })
      .pipe(
        map((impulse) => ({
          id: impulse.id,
          data: impulse,
        })),
      );
  }
}
