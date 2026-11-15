import { Injectable } from '@nestjs/common';
import { MediaVisibility } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Observable, Subject, filter, map } from 'rxjs';
import { MediaCallerContext } from '../auth/auth.types';
import { MediaFolderDto } from '../folders/folders.service';
import {
  InternalMediaEvent,
  MediaEventImpulse,
  MediaImpulseType,
  MediaStreamFilter,
} from './media-events.types';

@Injectable()
export class MediaEventsService {
  private readonly stream$ = new Subject<InternalMediaEvent>();

  emitAssetEvent(
    type: MediaImpulseType,
    rawAsset: any,
    formattedAsset?: Record<string, any>,
    extraPayload?: Record<string, any>,
  ): void {
    const now = new Date();
    const grantedClientIds = (rawAsset.grants || [])
      .filter((g: any) => !g.expiresAt || new Date(g.expiresAt) > now)
      .map((g: any) => g.clientId);

    const event: InternalMediaEvent = {
      id: randomUUID(),
      type,
      timestamp: now.toISOString(),
      assetId: rawAsset.id,
      folderId: rawAsset.folderId ?? undefined,
      folderPath: rawAsset.folderPath,
      kind: rawAsset.kind,
      visibility: rawAsset.visibility,
      processingStatus: rawAsset.processingStatus,
      asset: formattedAsset,
      payload: extraPayload,
      _access: {
        visibility: rawAsset.visibility,
        sourceApp: rawAsset.sourceApp,
        grantedClientIds,
      },
    };

    this.stream$.next(event);
  }

  emitFolderEvent(type: 'FOLDER_CREATED' | 'FOLDER_DELETED', folder: MediaFolderDto): void {
    this.stream$.next({
      id: randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      folderId: folder.id,
      folderPath: folder.path,
      visibility: folder.defaultVisibility,
      folder,
    });
  }

  private canCallerObserve(caller: MediaCallerContext, event: InternalMediaEvent): boolean {
    if (caller.type === 'admin') return true;
    if (event.type === 'FOLDER_CREATED' || event.type === 'FOLDER_DELETED') {
      return event.visibility === MediaVisibility.PUBLIC || event.type === 'FOLDER_CREATED';
    }
    const acl = event._access;
    if (!acl) return false;
    if (acl.visibility === MediaVisibility.PUBLIC) return true;
    if (acl.sourceApp === caller.slug) return true;
    if (acl.visibility === MediaVisibility.SCOPED && acl.grantedClientIds.includes(caller.clientId)) {
      return true;
    }
    return false;
  }

  private sanitizeForCaller(
    caller: MediaCallerContext,
    event: InternalMediaEvent,
  ): MediaEventImpulse {
    const { _access, ...publicEvent } = event;
    if (caller.type === 'admin' || !publicEvent.asset) {
      return publicEvent;
    }
    const { grants, jobs, ...safeAsset } = publicEvent.asset;
    return {
      ...publicEvent,
      asset: safeAsset,
    };
  }

  observeFiltered(
    caller: MediaCallerContext,
    filters: MediaStreamFilter = {},
  ): Observable<MediaEventImpulse> {
    const normalizedFolder =
      filters.folderPath && filters.folderPath !== 'all'
        ? filters.folderPath.trim().replace(/^\/|\/$/g, '').toLowerCase()
        : undefined;

    return this.stream$.pipe(
      filter((event) => this.canCallerObserve(caller, event)),
      filter((event) => {
        if (filters.assetId && event.assetId !== filters.assetId) return false;
        if (filters.kind && event.kind && event.kind !== filters.kind) return false;
        if (normalizedFolder && event.folderPath?.toLowerCase() !== normalizedFolder) {
          return false;
        }
        if (
          filters.includeFolderEvents === false &&
          (event.type === 'FOLDER_CREATED' || event.type === 'FOLDER_DELETED')
        ) {
          return false;
        }
        return true;
      }),
      map((event) => this.sanitizeForCaller(caller, event)),
    );
  }
}
