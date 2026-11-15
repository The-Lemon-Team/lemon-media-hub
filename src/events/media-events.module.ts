import { Global, Module } from '@nestjs/common';
import { MediaEventsController } from './media-events.controller';
import { MediaEventsService } from './media-events.service';

@Global()
@Module({
  controllers: [MediaEventsController],
  providers: [MediaEventsService],
  exports: [MediaEventsService],
})
export class MediaEventsModule {}
