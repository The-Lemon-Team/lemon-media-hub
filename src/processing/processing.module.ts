import { Global, Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { MediaProcessorService } from './media-processor.service';
import { ProcessingQueueService } from './processing-queue.service';

@Global()
@Module({
  imports: [StorageModule],
  providers: [MediaProcessorService, ProcessingQueueService],
  exports: [MediaProcessorService, ProcessingQueueService],
})
export class ProcessingModule {}
