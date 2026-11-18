export type FileCategoryId =
  | 'documents'
  | 'pdf'
  | 'spreadsheets'
  | 'presentations'
  | 'images'
  | 'media'
  | 'archives'
  | 'code'
  | 'forms'
  | 'other';

export type TopicCategoryId =
  | 'security-bounty'
  | 'dev-ai'
  | 'credentials-tools'
  | 'personal-docs'
  | 'media-screenshots'
  | 'archive-misc';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  parents?: string[];
  webViewLink?: string;
  starred?: boolean;
  ownedByMe?: boolean;
  md5Checksum?: string;
  shared?: boolean;
  capabilities?: {
    canMoveItemWithinDrive?: boolean;
    canRename?: boolean;
    canTrash?: boolean;
    canDelete?: boolean;
  };
}

export interface DriveQuota {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  usageInDriveTrash?: string;
}

export interface DriveUser {
  displayName?: string;
  emailAddress?: string;
  photoLink?: string;
}

export type OrganizeStrategy =
  | 'by-topic'
  | 'by-category'
  | 'by-year'
  | 'by-category-year';
export type OrganizeScope = 'root-only' | 'all-owned';

export interface CategoryDefinition {
  id: FileCategoryId;
  labelAr: string;
  folderName: string;
  descriptionAr: string;
}

export interface TopicDefinition {
  id: TopicCategoryId;
  labelAr: string;
  folderName: string;
  descriptionAr: string;
}

export interface PlanFolderBucket {
  key: string;
  targetFolderName: string;
  parentFolderName?: string;
  categoryId: FileCategoryId;
  topicId?: TopicCategoryId;
  existingFolderId?: string;
  files: DriveFile[];
}

export interface DuplicateGroup {
  key: string;
  reason: 'md5' | 'name-type' | 'copy-suffix';
  displayName: string;
  totalSizeBytes: number;
  wastedSizeBytes: number;
  files: DriveFile[];
}

export interface ExecutionProgress {
  isRunning: boolean;
  totalSteps: number;
  completedSteps: number;
  currentLabel: string;
  succeededCount: number;
  failedItems: Array<{ name: string; reason: string }>;
}

export interface ConfirmationRequest {
  title: string;
  description: string;
  confirmLabel: string;
  variant: 'primary' | 'danger';
  itemsPreview: string[];
  totalCount: number;
  onConfirm: () => Promise<void>;
}
