import type {
  DriveFile,
  DrivePermission,
  DriveQuota,
  DriveUser,
} from '../types/drive';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
export const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export class DriveAuthExpiredError extends Error {
  constructor(message = 'انتهت صلاحية جلسة Google Drive. يرجى تسجيل الدخول مجدداً.') {
    super(message);
    this.name = 'DriveAuthExpiredError';
  }
}

async function driveFetch<T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 401) {
    throw new DriveAuthExpiredError();
  }

  if (!response.ok) {
    let errorMessage = `خطأ من Google Drive (${response.status})`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errorMessage = errData.error.message;
      }
    } catch {
      // Ignore JSON parse failure
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchDriveAccountAndFiles(
  accessToken: string,
  onProgress?: (loadedCount: number) => void
): Promise<{
  user: DriveUser;
  quota: DriveQuota;
  rootFolderId: string;
  files: DriveFile[];
  trashedFiles: DriveFile[];
}> {
  const [aboutData, rootData] = await Promise.all([
    driveFetch<{ user: DriveUser; storageQuota: DriveQuota }>(
      `${DRIVE_API_BASE}/about?fields=user(displayName,emailAddress,photoLink),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)`,
      accessToken
    ),
    driveFetch<{ id: string }>(
      `${DRIVE_API_BASE}/files/root?fields=id`,
      accessToken
    ),
  ]);

  const filesById = new Map<string, DriveFile>();
  let pageToken: string | undefined = undefined;
  const seenPageTokens = new Set<string>();

  do {
    const params = new URLSearchParams({
      pageSize: '1000',
      q: 'trashed = false',
      fields:
        'nextPageToken,files(id,name,mimeType,size,modifiedTime,createdTime,parents,webViewLink,starred,ownedByMe,md5Checksum,shared,permissions(id,type,role,emailAddress,domain,displayName,deleted),capabilities(canMoveItemWithinDrive,canRename,canTrash,canDelete))',
      orderBy: 'folder,modifiedTime desc',
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const page = await driveFetch<{
      nextPageToken?: string;
      files?: DriveFile[];
    }>(`${DRIVE_API_BASE}/files?${params.toString()}`, accessToken);

    if (page.files && page.files.length > 0) {
      for (const file of page.files) {
        if (file?.id) {
          filesById.set(file.id, file);
        }
      }
      onProgress?.(filesById.size);
    }

    if (page.nextPageToken && !seenPageTokens.has(page.nextPageToken)) {
      seenPageTokens.add(page.nextPageToken);
      pageToken = page.nextPageToken;
    } else {
      pageToken = undefined;
    }
  } while (pageToken);

  const trashedById = new Map<string, DriveFile>();
  let trashPageToken: string | undefined = undefined;
  const seenTrashTokens = new Set<string>();

  do {
    const trashParams = new URLSearchParams({
      pageSize: '1000',
      q: "trashed = true and 'me' in owners",
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,ownedByMe)',
    });
    if (trashPageToken) {
      trashParams.set('pageToken', trashPageToken);
    }

    const trashPage = await driveFetch<{
      nextPageToken?: string;
      files?: DriveFile[];
    }>(`${DRIVE_API_BASE}/files?${trashParams.toString()}`, accessToken);

    if (trashPage.files && trashPage.files.length > 0) {
      for (const file of trashPage.files) {
        if (file?.id) {
          trashedById.set(file.id, file);
        }
      }
    }

    if (
      trashPage.nextPageToken &&
      !seenTrashTokens.has(trashPage.nextPageToken)
    ) {
      seenTrashTokens.add(trashPage.nextPageToken);
      trashPageToken = trashPage.nextPageToken;
    } else {
      trashPageToken = undefined;
    }
  } while (trashPageToken);

  return {
    user: aboutData.user ?? {},
    quota: aboutData.storageQuota ?? {},
    rootFolderId: rootData.id,
    files: Array.from(filesById.values()),
    trashedFiles: Array.from(trashedById.values()),
  };
}

export async function createDriveFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<DriveFile> {
  const metadata: Record<string, unknown> = {
    name: name.trim(),
    mimeType: FOLDER_MIME_TYPE,
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  return driveFetch<DriveFile>(
    `${DRIVE_API_BASE}/files?fields=id,name,mimeType,parents,modifiedTime,ownedByMe,capabilities`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    }
  );
}

export async function moveDriveFile(
  accessToken: string,
  fileId: string,
  newParentId: string,
  currentParents: string[] = []
): Promise<DriveFile> {
  const params = new URLSearchParams({
    addParents: newParentId,
    fields: 'id,name,mimeType,parents,modifiedTime',
  });
  const parentsToRemove = currentParents.filter((p) => p !== newParentId);
  if (parentsToRemove.length > 0) {
    params.set('removeParents', parentsToRemove.join(','));
  }

  return driveFetch<DriveFile>(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?${params.toString()}`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
}

export async function renameDriveFile(
  accessToken: string,
  fileId: string,
  newName: string
): Promise<DriveFile> {
  return driveFetch<DriveFile>(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,parents,modifiedTime`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    }
  );
}

export async function trashDriveFile(
  accessToken: string,
  fileId: string
): Promise<DriveFile> {
  return driveFetch<DriveFile>(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?fields=id,name,trashed`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    }
  );
}

export type FolderEmptyCheckStatus = 'empty' | 'has-trashed' | 'not-empty';

export async function checkFolderEmptyStatus(
  accessToken: string,
  folderId: string
): Promise<{ status: FolderEmptyCheckStatus; sampleChildName?: string }> {
  const safeId = folderId.replace(/'/g, "\\'");

  const activeParams = new URLSearchParams({
    q: `'${safeId}' in parents and trashed = false`,
    pageSize: '1',
    fields: 'files(id,name)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const activeRes = await driveFetch<{ files?: Array<{ id: string; name: string }> }>(
    `${DRIVE_API_BASE}/files?${activeParams.toString()}`,
    accessToken
  );

  if (activeRes.files && activeRes.files.length > 0) {
    return {
      status: 'not-empty',
      sampleChildName: activeRes.files[0].name,
    };
  }

  const trashedParams = new URLSearchParams({
    q: `'${safeId}' in parents and trashed = true`,
    pageSize: '1',
    fields: 'files(id,name)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const trashedRes = await driveFetch<{ files?: Array<{ id: string; name: string }> }>(
    `${DRIVE_API_BASE}/files?${trashedParams.toString()}`,
    accessToken
  );

  if (trashedRes.files && trashedRes.files.length > 0) {
    return {
      status: 'has-trashed',
      sampleChildName: trashedRes.files[0].name,
    };
  }

  return { status: 'empty' };
}

export async function fetchDriveMediaBlobUrl(
  accessToken: string,
  fileId: string,
  signal?: AbortSignal
): Promise<string> {
  const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    throw new DriveAuthExpiredError();
  }

  if (!response.ok) {
    let errorMessage = `تعذر تحميل الملف للمعاينة (${response.status})`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errorMessage = errData.error.message;
      }
    } catch {
      // Ignore JSON parse errors on binary responses
    }
    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function emptyDriveTrash(accessToken: string): Promise<void> {
  await driveFetch<void>(`${DRIVE_API_BASE}/files/trash`, accessToken, {
    method: 'DELETE',
  });
}

export async function fetchFilePermissions(
  accessToken: string,
  fileId: string
): Promise<DrivePermission[]> {
  const params = new URLSearchParams({
    fields: 'permissions(id,type,role,emailAddress,domain,displayName,deleted)',
    supportsAllDrives: 'true',
  });
  const res = await driveFetch<{ permissions?: DrivePermission[] }>(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/permissions?${params.toString()}`,
    accessToken
  );
  return res.permissions ?? [];
}

export async function deleteDrivePermission(
  accessToken: string,
  fileId: string,
  permissionId: string
): Promise<void> {
  await driveFetch<void>(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissionId)}?supportsAllDrives=true`,
    accessToken,
    {
      method: 'DELETE',
    }
  );
}


