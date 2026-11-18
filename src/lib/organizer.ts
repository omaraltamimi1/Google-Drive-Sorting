import { FOLDER_MIME_TYPE } from './driveApi';
import type {
  CategoryDefinition,
  DriveFile,
  DuplicateGroup,
  FileCategoryId,
  OrganizeScope,
  OrganizeStrategy,
  PlanFolderBucket,
  TopicCategoryId,
  TopicDefinition,
} from '../types/drive';

export const CATEGORY_DEFINITIONS: Record<FileCategoryId, CategoryDefinition> = {
  documents: {
    id: 'documents',
    labelAr: 'المستندات والنصوص',
    folderName: '01. المستندات والنصوص',
    descriptionAr: 'مستندات Google وWord والملفات النصية',
  },
  pdf: {
    id: 'pdf',
    labelAr: 'ملفات PDF والكتب',
    folderName: '02. ملفات PDF',
    descriptionAr: 'مستندات PDF والكتب والأبحاث',
  },
  spreadsheets: {
    id: 'spreadsheets',
    labelAr: 'الجداول والبيانات',
    folderName: '03. الجداول والبيانات',
    descriptionAr: 'جداول Google وExcel وCSV وJSON',
  },
  presentations: {
    id: 'presentations',
    labelAr: 'العروض التقديمية',
    folderName: '04. العروض التقديمية',
    descriptionAr: 'عروض Google Slides وPowerPoint',
  },
  images: {
    id: 'images',
    labelAr: 'الصور والتصاميم',
    folderName: '05. الصور والتصاميم',
    descriptionAr: 'الصور والرسومات وملفات التصميم والخطوط',
  },
  media: {
    id: 'media',
    labelAr: 'الفيديو والصوتيات',
    folderName: '06. الفيديو والصوتيات',
    descriptionAr: 'مقاطع الفيديو والتسجيلات الصوتية',
  },
  archives: {
    id: 'archives',
    labelAr: 'الملفات المضغوطة',
    folderName: '07. الملفات المضغوطة',
    descriptionAr: 'أرشيف ZIP وRAR و7Z',
  },
  code: {
    id: 'code',
    labelAr: 'البرمجة والتطبيقات',
    folderName: '08. البرمجة والأكواد',
    descriptionAr: 'الشيفرات البرمجية والنماذج والسكريبتات',
  },
  forms: {
    id: 'forms',
    labelAr: 'النماذج والرسومات',
    folderName: '09. النماذج والمخططات',
    descriptionAr: 'Google Forms وDrawings والمواقع',
  },
  other: {
    id: 'other',
    labelAr: 'ملفات أخرى',
    folderName: '10. ملفات متنوعة',
    descriptionAr: 'أنواع الملفات الأخرى غير المصنفة',
  },
};

export const TOPIC_DEFINITIONS: Record<TopicCategoryId, TopicDefinition> = {
  'security-bounty': {
    id: 'security-bounty',
    labelAr: 'الأبحاث الأمنية و Bug Bounty',
    folderName: '01. الأبحاث الأمنية و Bug Bounty',
    descriptionAr: 'تقارير الثغرات، الاستطلاع، الأدلة، ونتائج الفحص الأمني',
  },
  'dev-ai': {
    id: 'dev-ai',
    labelAr: 'البرمجة والذكاء الاصطناعي',
    folderName: '02. البرمجة والذكاء الاصطناعي',
    descriptionAr: 'الأكواد البرمجية، المشاريع، نماذج AI وملفات التطوير',
  },
  'credentials-tools': {
    id: 'credentials-tools',
    labelAr: 'الأدوات والمفاتيح والإعدادات',
    folderName: '03. الأدوات والمفاتيح والإعدادات',
    descriptionAr: 'ملفات البيئة والاعتمادات والشهادات وبرامج التثبيت',
  },
  'personal-docs': {
    id: 'personal-docs',
    labelAr: 'المستندات الشخصية والمالية',
    folderName: '04. المستندات الشخصية والمالية',
    descriptionAr: 'الأوراق المهمة، العقود، الفواتير، الملاحظات وملفات PDF',
  },
  'media-screenshots': {
    id: 'media-screenshots',
    labelAr: 'الصور ولقطات الشاشة والوسائط',
    folderName: '05. الصور ولقطات الشاشة والوسائط',
    descriptionAr: 'الصور، لقطات الشاشة، التسجيلات ومقاطع الفيديو',
  },
  'archive-misc': {
    id: 'archive-misc',
    labelAr: 'الأرشيف والملفات المؤقتة',
    folderName: '06. الأرشيف والملفات المؤقتة',
    descriptionAr: 'الملفات المضغوطة، المجلدات المؤقتة والعناصر المتفرقة',
  },
};

const MASTER_TOPIC_FOLDER_NAMES = new Set(
  Object.values(TOPIC_DEFINITIONS).map((d) => d.folderName.trim())
);

const CODE_EXTENSIONS = new Set([
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'java',
  'c',
  'h',
  'cpp',
  'cs',
  'go',
  'rs',
  'php',
  'rb',
  'swift',
  'kt',
  'html',
  'css',
  'scss',
  'sql',
  'sh',
  'yaml',
  'yml',
  'xml',
  'env',
  'ipynb',
  'wasm',
  'map',
  'tflite',
  'binarypb',
  'bundle',
  'md',
]);

const ARCHIVE_EXTENSIONS = new Set([
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  'bz2',
  'xz',
  'iso',
  'dmg',
]);

const DESIGN_IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'heic',
  'psd',
  'ai',
  'fig',
  'sketch',
  'raw',
  'tiff',
  'woff2',
  'woff',
  'ttf',
  'otf',
]);

const DOC_EXTENSIONS = new Set([
  'doc',
  'docx',
  'txt',
  'rtf',
  'odt',
  'pages',
]);

const SHEET_EXTENSIONS = new Set([
  'xls',
  'xlsx',
  'csv',
  'tsv',
  'ods',
  'numbers',
  'json',
]);
const SLIDE_EXTENSIONS = new Set(['ppt', 'pptx', 'odp', 'key']);
const MEDIA_EXTENSIONS = new Set([
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'mp3',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'flac',
]);

export function getExtension(fileName: string): string {
  const cleanName = fileName.replace(/\s*\(\d+\)(\.[^.]+)?$/, '$1');
  const idx = cleanName.lastIndexOf('.');
  if (idx <= 0 || idx === cleanName.length - 1) return '';
  return cleanName.slice(idx + 1).toLowerCase();
}

const PREVIEWABLE_IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'avif',
]);

const PREVIEWABLE_VIDEO_EXTENSIONS = new Set([
  'mp4',
  'mov',
  'webm',
  'm4v',
  'mkv',
  'avi',
  'ogv',
]);

export function getMediaPreviewType(file: DriveFile): 'image' | 'video' | null {
  if (isFolder(file)) return null;
  const mime = (file.mimeType || '').toLowerCase();
  const ext = getExtension(file.name || '');

  if (
    mime.startsWith('image/') &&
    !mime.includes('photoshop') &&
    !mime.includes('tiff')
  ) {
    return 'image';
  }
  if (PREVIEWABLE_IMAGE_EXTENSIONS.has(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || PREVIEWABLE_VIDEO_EXTENSIONS.has(ext)) {
    return 'video';
  }
  return null;
}

export function getFileCategory(file: DriveFile): FileCategoryId {
  const mime = (file.mimeType || '').toLowerCase();
  const ext = getExtension(file.name || '');

  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';

  if (
    mime === 'application/vnd.google-apps.spreadsheet' ||
    mime.includes('spreadsheetml') ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'text/csv' ||
    mime === 'application/json' ||
    SHEET_EXTENSIONS.has(ext)
  ) {
    return 'spreadsheets';
  }

  if (
    mime === 'application/vnd.google-apps.presentation' ||
    mime.includes('presentationml') ||
    mime === 'application/vnd.ms-powerpoint' ||
    SLIDE_EXTENSIONS.has(ext)
  ) {
    return 'presentations';
  }

  if (mime.startsWith('image/') || DESIGN_IMAGE_EXTENSIONS.has(ext)) {
    return 'images';
  }

  if (
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    MEDIA_EXTENSIONS.has(ext)
  ) {
    return 'media';
  }

  if (
    mime.includes('zip') ||
    mime.includes('rar') ||
    mime.includes('7z') ||
    mime.includes('tar') ||
    mime.includes('compressed') ||
    ARCHIVE_EXTENSIONS.has(ext)
  ) {
    return 'archives';
  }

  if (
    mime === 'application/vnd.google-apps.script' ||
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    mime.includes('python') ||
    mime.includes('wasm') ||
    CODE_EXTENSIONS.has(ext)
  ) {
    return 'code';
  }

  if (
    mime === 'application/vnd.google-apps.document' ||
    mime.includes('wordprocessingml') ||
    mime === 'application/msword' ||
    mime.startsWith('text/plain') ||
    DOC_EXTENSIONS.has(ext)
  ) {
    return 'documents';
  }

  if (
    mime === 'application/vnd.google-apps.form' ||
    mime === 'application/vnd.google-apps.drawing' ||
    mime === 'application/vnd.google-apps.site' ||
    mime === 'application/vnd.google-apps.jam'
  ) {
    return 'forms';
  }

  return 'other';
}

export function getTopicCategory(file: DriveFile): TopicCategoryId {
  const name = (file.name || '').toLowerCase();
  const ext = getExtension(file.name || '');

  // 1. Security & Bug Bounty
  const securityKeywords = [
    'bounty',
    'bug',
    'recon',
    'burp',
    'xss',
    'ssrf',
    'csrf',
    'idor',
    'poc',
    'exploit',
    'payload',
    'cheatsheet',
    'hunt',
    'evidence',
    'scope',
    'oast',
    'probe',
    'report',
    'submission',
    'repro',
    'subdomain',
    'secret',
    'wolfssl',
    'varonis',
    'elastic',
    'chime',
    'rapyd',
    'binance',
    'salto',
    'wolt',
    'infomaniak',
    'instacart',
    'hubspot',
    'mercado',
    'worldfirst',
    'expressvpn',
    'digitalocean',
    'verily',
    'xai',
    'grok',
    'cmc',
    'fedramp',
    'investigation',
    'alert(1)',
    'onerror=',
    'ticket-sharing',
    'view-source',
    'scim',
  ];
  if (securityKeywords.some((kw) => name.includes(kw))) {
    return 'security-bounty';
  }

  // 2. Credentials, Configs, System & Installers
  const credToolKeywords = [
    'credential',
    'backup-codes',
    'token',
    'enrollment',
    'policy',
    'policies',
    'installer',
    'tools',
    '.admin',
    'islc',
    'obs-studio',
    'adobe',
    'system & activity',
    'all tools',
    'we1.crt',
    'atlas-',
  ];
  const credExts = new Set(['env', 'crt', 'pem', 'key', 'reg', 'exe', 'msi', 'dmg']);
  if (credToolKeywords.some((kw) => name.includes(kw)) || credExts.has(ext)) {
    return 'credentials-tools';
  }

  // 3. Development, Code & AI Models
  const devAiKeywords = [
    '.github',
    'development',
    'extension',
    'gemini',
    'ollama',
    'ai studio',
    'inference',
    'ocr',
    'opal',
    'wrapper',
    'chatgpt',
    'migration',
    'guidance',
    'mobilenet',
    'granular_image',
    'storage_slab',
    'pr-24551',
    'readme',
    'virtual_mf',
    'incident-digital-twin',
  ];
  if (
    devAiKeywords.some((kw) => name.includes(kw)) ||
    /^exp\d+_/i.test(name) ||
    ['py', 'js', 'ts', 'tsx', 'jsx', 'c', 'cpp', 'html', 'css', 'wasm', 'tflite', 'binarypb', 'map', 'md', 'json'].includes(ext)
  ) {
    return 'dev-ai';
  }

  // 4. Media & Screenshots
  const mediaKeywords = ['screenshot', 'screnshot', 'vids', 'download'];
  const fileCat = isFolder(file) ? 'other' : getFileCategory(file);
  if (
    mediaKeywords.some((kw) => name.includes(kw)) ||
    fileCat === 'images' ||
    fileCat === 'media'
  ) {
    return 'media-screenshots';
  }

  // 5. Personal, Finance & Documents
  const personalKeywords = [
    'personal',
    'finance',
    'اوراق',
    'مهمه',
    'terms',
    'account_activities',
    'notes',
    'scratchpad',
    'test-users',
    '569784',
    'capital-com',
  ];
  if (
    personalKeywords.some((kw) => name.includes(kw)) ||
    fileCat === 'pdf' ||
    fileCat === 'documents' ||
    fileCat === 'spreadsheets' ||
    fileCat === 'presentations'
  ) {
    return 'personal-docs';
  }

  // 6. Archive & Misc
  return 'archive-misc';
}

export function getMimeLabelAr(file: DriveFile): string {
  if (file.mimeType === FOLDER_MIME_TYPE) return 'مجلد';
  if (file.mimeType === 'application/vnd.google-apps.document') return 'مستند Google';
  if (file.mimeType === 'application/vnd.google-apps.spreadsheet') return 'جدول Google';
  if (file.mimeType === 'application/vnd.google-apps.presentation') return 'عرض Google';
  if (file.mimeType === 'application/vnd.google-apps.form') return 'نموذج Google';
  if (file.mimeType === 'application/vnd.google-apps.drawing') return 'رسم Google';
  if (file.mimeType === 'application/pdf') return 'PDF';
  const ext = getExtension(file.name);
  if (ext) return ext.toUpperCase();
  return CATEGORY_DEFINITIONS[getFileCategory(file)].labelAr;
}

export function isFolder(file: DriveFile): boolean {
  return file.mimeType === FOLDER_MIME_TYPE;
}

export function isInRoot(file: DriveFile, rootFolderId: string): boolean {
  if (!file.parents || file.parents.length === 0) return false;
  return file.parents.includes(rootFolderId);
}

export function canMoveFile(file: DriveFile): boolean {
  if (file.capabilities && typeof file.capabilities.canMoveItemWithinDrive === 'boolean') {
    return file.capabilities.canMoveItemWithinDrive;
  }
  return file.ownedByMe !== false;
}

export function buildOrganizationPlan(params: {
  files: DriveFile[];
  rootFolderId: string;
  strategy: OrganizeStrategy;
  scope: OrganizeScope;
  includeFolders?: boolean;
  customFolderNames?: Partial<Record<FileCategoryId, string>>;
  customTopicNames?: Partial<Record<TopicCategoryId, string>>;
}): PlanFolderBucket[] {
  const {
    files,
    rootFolderId,
    strategy,
    scope,
    includeFolders = false,
    customFolderNames,
    customTopicNames,
  } = params;

  const existingRootFoldersByName = new Map<string, DriveFile>();
  for (const f of files) {
    if (isFolder(f) && isInRoot(f, rootFolderId)) {
      existingRootFoldersByName.set(f.name.trim(), f);
    }
  }

  const existingSubfoldersByKey = new Map<string, DriveFile>();
  for (const f of files) {
    if (isFolder(f) && f.parents) {
      for (const pid of f.parents) {
        existingSubfoldersByKey.set(`${pid}::${f.name.trim()}`, f);
      }
    }
  }

  // Protected master folders (never move a master folder into another folder)
  const customMasterNames = new Set(
    Object.values(customTopicNames ?? {})
      .filter((v): v is string => Boolean(v))
      .map((v) => v.trim())
  );
  const customCategoryNames = new Set(
    Object.values(customFolderNames ?? {})
      .filter((v): v is string => Boolean(v))
      .map((v) => v.trim())
  );
  const categoryDefaultNames = new Set(
    Object.values(CATEGORY_DEFINITIONS).map((d) => d.folderName.trim())
  );

  const eligibleItems = files.filter((f) => {
    const folder = isFolder(f);
    if (folder) {
      if (!includeFolders || strategy !== 'by-topic') return false;
      const trimmed = f.name.trim();
      if (
        MASTER_TOPIC_FOLDER_NAMES.has(trimmed) ||
        customMasterNames.has(trimmed)
      ) {
        return false;
      }
      // Only organize scattered root folders to avoid breaking nested folder hierarchies
      if (!isInRoot(f, rootFolderId)) return false;
    } else {
      if (scope === 'root-only' && !isInRoot(f, rootFolderId)) {
        return false;
      }
    }

    if (!canMoveFile(f)) return false;
    if (scope === 'all-owned' && f.ownedByMe === false) return false;
    return true;
  });

  const buckets = new Map<string, PlanFolderBucket>();

  for (const item of eligibleItems) {
    const categoryId = isFolder(item) ? 'other' : getFileCategory(item);
    const catDef = CATEGORY_DEFINITIONS[categoryId];
    const categoryFolderName = (
      customFolderNames?.[categoryId] || catDef.folderName
    ).trim();
    const year = item.modifiedTime
      ? String(new Date(item.modifiedTime).getFullYear())
      : 'غير مؤرخ';

    if (strategy === 'by-topic') {
      const topicId = getTopicCategory(item);
      const topicDef = TOPIC_DEFINITIONS[topicId];
      const targetFolderName = (
        customTopicNames?.[topicId] || topicDef.folderName
      ).trim();

      const existingFolder = existingRootFoldersByName.get(targetFolderName);
      if (existingFolder) {
        if (existingFolder.id === item.id) continue;
        if (item.parents?.includes(existingFolder.id)) continue;
      }

      const key = `topic::${topicId}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          targetFolderName,
          categoryId,
          topicId,
          existingFolderId: existingFolder?.id,
          files: [],
        });
      }
      buckets.get(key)!.files.push(item);
    } else if (strategy === 'by-category') {
      if (
        isFolder(item) &&
        (categoryDefaultNames.has(item.name.trim()) ||
          customCategoryNames.has(item.name.trim()))
      ) {
        continue;
      }
      const existingFolder = existingRootFoldersByName.get(categoryFolderName);
      if (existingFolder && item.parents?.includes(existingFolder.id)) {
        continue;
      }
      const key = `cat::${categoryFolderName}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          targetFolderName: categoryFolderName,
          categoryId,
          existingFolderId: existingFolder?.id,
          files: [],
        });
      }
      buckets.get(key)!.files.push(item);
    } else if (strategy === 'by-year') {
      const yearFolderName = `أرشيف ${year}`;
      const existingFolder = existingRootFoldersByName.get(yearFolderName);
      if (existingFolder && item.parents?.includes(existingFolder.id)) {
        continue;
      }
      const key = `year::${yearFolderName}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          targetFolderName: yearFolderName,
          categoryId,
          existingFolderId: existingFolder?.id,
          files: [],
        });
      }
      buckets.get(key)!.files.push(item);
    } else {
      const parentFolder = existingRootFoldersByName.get(categoryFolderName);
      const subFolder = parentFolder
        ? existingSubfoldersByKey.get(`${parentFolder.id}::${year}`)
        : undefined;

      if (subFolder && item.parents?.includes(subFolder.id)) {
        continue;
      }

      const key = `cat-year::${categoryFolderName}::${year}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          targetFolderName: year,
          parentFolderName: categoryFolderName,
          categoryId,
          existingFolderId: subFolder?.id,
          files: [],
        });
      }
      buckets.get(key)!.files.push(item);
    }
  }

  return Array.from(buckets.values()).sort((a, b) => {
    const labelA = a.parentFolderName
      ? `${a.parentFolderName}/${a.targetFolderName}`
      : a.targetFolderName;
    const labelB = b.parentFolderName
      ? `${b.parentFolderName}/${b.targetFolderName}`
      : b.targetFolderName;
    return labelA.localeCompare(labelB, 'ar');
  });
}

function stripCopySuffix(fileName: string): string {
  const trimmed = fileName.trim();
  const dotIdx = trimmed.lastIndexOf('.');
  if (dotIdx > 0) {
    const base = trimmed.slice(0, dotIdx);
    const ext = trimmed.slice(dotIdx);
    const cleanedBase = base
      .replace(/\s*\(\d+\)$/, '')
      .replace(/\s*-\s*copy$/i, '')
      .trim();
    return `${cleanedBase}${ext}`.toLowerCase();
  }
  return trimmed
    .replace(/\s*\(\d+\)$/, '')
    .replace(/\s*-\s*copy$/i, '')
    .trim()
    .toLowerCase();
}

export function findDuplicateGroups(filesInput: DriveFile[]): DuplicateGroup[] {
  const uniqueMap = new Map<string, DriveFile>();
  for (const f of filesInput) {
    if (f?.id) uniqueMap.set(f.id, f);
  }
  const files = Array.from(uniqueMap.values());

  const byMd5 = new Map<string, DriveFile[]>();
  const byNameType = new Map<string, DriveFile[]>();
  const byCopyBase = new Map<string, DriveFile[]>();
  const seenFileIdsInMd5 = new Set<string>();

  for (const f of files) {
    if (!isFolder(f) && f.md5Checksum) {
      const list = byMd5.get(f.md5Checksum) ?? [];
      list.push(f);
      byMd5.set(f.md5Checksum, list);
    }
  }

  const groups: DuplicateGroup[] = [];

  for (const [md5, list] of byMd5.entries()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(
      (a, b) =>
        new Date(b.modifiedTime || 0).getTime() -
        new Date(a.modifiedTime || 0).getTime()
    );
    for (const item of sorted) seenFileIdsInMd5.add(item.id);
    const singleSize = Number(sorted[0].size || 0);
    groups.push({
      key: `md5::${md5}`,
      reason: 'md5',
      displayName: sorted[0].name,
      totalSizeBytes: sorted.reduce((acc, item) => acc + Number(item.size || 0), 0),
      wastedSizeBytes: singleSize * (sorted.length - 1),
      files: sorted,
    });
  }

  for (const f of files) {
    if (seenFileIdsInMd5.has(f.id)) continue;
    const exactKey = `${f.name.trim().toLowerCase()}::${f.mimeType}`;
    const exactList = byNameType.get(exactKey) ?? [];
    exactList.push(f);
    byNameType.set(exactKey, exactList);
  }

  const seenInExactName = new Set<string>();
  for (const [key, list] of byNameType.entries()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(
      (a, b) =>
        new Date(b.modifiedTime || 0).getTime() -
        new Date(a.modifiedTime || 0).getTime()
    );
    for (const item of sorted) seenInExactName.add(item.id);
    groups.push({
      key: `nt::${key}`,
      reason: 'name-type',
      displayName: sorted[0].name,
      totalSizeBytes: sorted.reduce((acc, item) => acc + Number(item.size || 0), 0),
      wastedSizeBytes: 0,
      files: sorted,
    });
  }

  // Also catch numbered copy variants like "README (1).md" vs "README.md"
  for (const f of files) {
    if (seenFileIdsInMd5.has(f.id) || seenInExactName.has(f.id)) continue;
    const baseName = stripCopySuffix(f.name);
    const copyKey = `${baseName}::${f.mimeType}`;
    const list = byCopyBase.get(copyKey) ?? [];
    list.push(f);
    byCopyBase.set(copyKey, list);
  }

  for (const [key, list] of byCopyBase.entries()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(
      (a, b) =>
        new Date(b.modifiedTime || 0).getTime() -
        new Date(a.modifiedTime || 0).getTime()
    );
    const totalBytes = sorted.reduce((acc, item) => acc + Number(item.size || 0), 0);
    const newestSize = Number(sorted[0].size || 0);
    groups.push({
      key: `copy::${key}`,
      reason: 'copy-suffix',
      displayName: sorted[0].name,
      totalSizeBytes: totalBytes,
      wastedSizeBytes: Math.max(0, totalBytes - newestSize),
      files: sorted,
    });
  }

  return groups.sort(
    (a, b) => b.wastedSizeBytes - a.wastedSizeBytes || b.files.length - a.files.length
  );
}

export function findEmptyFolders(files: DriveFile[]): DriveFile[] {
  const parentCounts = new Map<string, number>();
  for (const f of files) {
    if (f.parents) {
      for (const pid of f.parents) {
        parentCounts.set(pid, (parentCounts.get(pid) ?? 0) + 1);
      }
    }
  }
  return files.filter(
    (f) => isFolder(f) && f.ownedByMe !== false && (parentCounts.get(f.id) ?? 0) === 0
  );
}

export function findLargeFiles(
  files: DriveFile[],
  minBytes = 10 * 1024 * 1024
): DriveFile[] {
  return files
    .filter((f) => !isFolder(f) && Number(f.size || 0) >= minBytes)
    .sort((a, b) => Number(b.size || 0) - Number(a.size || 0));
}

export function formatBytes(bytesInput?: string | number): string {
  const bytes = Number(bytesInput || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

export function formatDateShort(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function buildFolderPathMap(
  files: DriveFile[],
  rootFolderId: string
): Map<string, string> {
  const fileMap = new Map<string, DriveFile>();
  for (const f of files) {
    fileMap.set(f.id, f);
  }

  const cache = new Map<string, string>();
  const resolveFolderPath = (
    folderId: string,
    visited = new Set<string>()
  ): string => {
    if (folderId === rootFolderId) return 'ملفاتي';
    if (cache.has(folderId)) return cache.get(folderId)!;
    if (visited.has(folderId)) return 'مجلد';

    visited.add(folderId);
    const folder = fileMap.get(folderId);
    if (!folder) return 'مجلد مشترك';
    const parentId = folder.parents?.[0];
    const path = parentId
      ? `${resolveFolderPath(parentId, visited)} / ${folder.name}`
      : folder.name;
    cache.set(folderId, path);
    return path;
  };

  for (const f of files) {
    if (isFolder(f)) {
      resolveFolderPath(f.id);
    }
  }
  cache.set(rootFolderId, 'ملفاتي');
  return cache;
}
