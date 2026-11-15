import { MediaKind, MediaVisibility, ProcessingStatus } from '@prisma/client';
import { MediaFolderDto } from '../folders/folders.service';

export type MediaImpulseType =
  | 'MEDIA_ADDED'
  | 'MEDIA_PROCESSING'
  | 'MEDIA_READY'
  | 'MEDIA_FAILED'
  | 'MEDIA_UPDATED'
  | 'MEDIA_ACCESS_CHANGED'
  | 'MEDIA_FAVORITED'
  | 'MEDIA_VIEWED'
  | 'MEDIA_DELETED'
  | 'FOLDER_CREATED'
  | 'FOLDER_DELETED';

export interface MediaEventImpulse {
  id: string;
  type: MediaImpulseType;
  timestamp: string;
  assetId?: string;
  folderId?: string;
  folderPath?: string;
  kind?: MediaKind;
  visibility?: MediaVisibility;
  processingStatus?: ProcessingStatus;
  asset?: Record<string, any>;
  folder?: MediaFolderDto;
  payload?: Record<string, any>;
}

export interface InternalMediaEvent extends MediaEventImpulse {
  /** Internal ACL metadata stripped before sending over SSE */
  _access?: {
    visibility: MediaVisibility;
    sourceApp: string;
    grantedClientIds: string[];
  };
}

export interface MediaStreamFilter {
  folderPath?: string;
  kind?: MediaKind;
  assetId?: string;
  includeFolderEvents?: boolean;
}
