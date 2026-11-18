import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  FolderPlus,
  Maximize2,
  Play,
  RotateCcw,
} from 'lucide-react';
import type {
  ConfirmationRequest,
  DriveFile,
  ExecutionProgress,
  FileCategoryId,
  OrganizeScope,
  OrganizeStrategy,
  TopicCategoryId,
} from '../types/drive';
import {
  buildOrganizationPlan,
  CATEGORY_DEFINITIONS,
  formatBytes,
  formatDateShort,
  getMediaPreviewType,
  isFolder,
  TOPIC_DEFINITIONS,
} from '../lib/organizer';
import { createDriveFolder, FOLDER_MIME_TYPE, moveDriveFile } from '../lib/driveApi';
import { FileTypeIcon } from './FileTypeIcon';
import { MediaLightboxModal } from './MediaLightboxModal';

interface SmartOrganizeViewProps {
  files: DriveFile[];
  rootFolderId: string;
  folderPathMap: Map<string, string>;
  getValidToken: () => Promise<string>;
  requestConfirmation: (req: ConfirmationRequest) => void;
  onSyncComplete: () => Promise<void>;
  onError: (msg: string) => void;
}

export function SmartOrganizeView({
  files,
  rootFolderId,
  folderPathMap,
  getValidToken,
  requestConfirmation,
  onSyncComplete,
  onError,
}: SmartOrganizeViewProps) {
  const [strategy, setStrategy] = useState<OrganizeStrategy>('by-topic');
  const [scope, setScope] = useState<OrganizeScope>('root-only');
  const [includeFolders, setIncludeFolders] = useState<boolean>(true);
  const [customFolderNames, setCustomFolderNames] = useState<
    Partial<Record<FileCategoryId, string>>
  >({});
  const [customTopicNames, setCustomTopicNames] = useState<
    Partial<Record<TopicCategoryId, string>>
  >({});
  const [excludedBucketKeys, setExcludedBucketKeys] = useState<Set<string>>(new Set());
  const [excludedFileIds, setExcludedFileIds] = useState<Set<string>>(new Set());
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<ExecutionProgress | null>(null);
  const [previewState, setPreviewState] = useState<{
    file: DriveFile;
    list: DriveFile[];
  } | null>(null);

  const planBuckets = useMemo(
    () =>
      buildOrganizationPlan({
        files,
        rootFolderId,
        strategy,
        scope,
        includeFolders,
        customFolderNames,
        customTopicNames,
      }),
    [
      files,
      rootFolderId,
      strategy,
      scope,
      includeFolders,
      customFolderNames,
      customTopicNames,
    ]
  );

  const activeOperations = useMemo(() => {
    const activeBuckets = planBuckets
      .filter((b) => !excludedBucketKeys.has(b.key))
      .map((b) => ({
        ...b,
        selectedFiles: b.files.filter((f) => !excludedFileIds.has(f.id)),
      }))
      .filter((b) => b.selectedFiles.length > 0);

    const totalItemsToMove = activeBuckets.reduce(
      (sum, b) => sum + b.selectedFiles.length,
      0
    );
    const totalFoldersToMove = activeBuckets.reduce(
      (sum, b) => sum + b.selectedFiles.filter((item) => isFolder(item)).length,
      0
    );
    const totalBytes = activeBuckets.reduce(
      (sum, b) =>
        sum + b.selectedFiles.reduce((acc, f) => acc + Number(f.size || 0), 0),
      0
    );

    const newFolderKeys = new Set<string>();
    for (const b of activeBuckets) {
      if (b.parentFolderName) {
        const parentExists = files.some(
          (f) =>
            f.mimeType === FOLDER_MIME_TYPE &&
            f.parents?.includes(rootFolderId) &&
            f.name.trim() === b.parentFolderName
        );
        if (!parentExists) {
          newFolderKeys.add(`root::${b.parentFolderName}`);
        }
      }
      if (!b.existingFolderId) {
        newFolderKeys.add(`leaf::${b.parentFolderName ?? ''}::${b.targetFolderName}`);
      }
    }

    return {
      activeBuckets,
      totalItemsToMove,
      totalFoldersToMove,
      totalBytes,
      foldersToCreateCount: newFolderKeys.size,
    };
  }, [planBuckets, excludedBucketKeys, excludedFileIds, files, rootFolderId]);

  const toggleBucket = (key: string) => {
    setExcludedBucketKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleFile = (fileId: string) => {
    setExcludedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const toggleExpand = (key: string) => {
    setExpandedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExecutePlan = () => {
    if (activeOperations.totalItemsToMove === 0) return;

    const previewItems = activeOperations.activeBuckets.flatMap((b) =>
      b.selectedFiles.map(
        (f) =>
          `${isFolder(f) ? '[مجلد] ' : ''}${f.name} ← ${
            b.parentFolderName
              ? `${b.parentFolderName} / ${b.targetFolderName}`
              : b.targetFolderName
          }`
      )
    );

    requestConfirmation({
      title: 'تأكيد تنفيذ خطة ترتيب Google Drive',
      description: `سيتم إنشاء ${activeOperations.foldersToCreateCount} مجلد رئيسي (عند الحاجة) ونقل ${activeOperations.totalItemsToMove} عنصر (${activeOperations.totalItemsToMove - activeOperations.totalFoldersToMove} ملف و${activeOperations.totalFoldersToMove} مجلد) إلى مجلداتها المحددة داخل Google Drive.`,
      confirmLabel: 'تأكيد وتنفيذ الترتيب',
      variant: 'primary',
      itemsPreview: previewItems,
      totalCount: activeOperations.totalItemsToMove,
      onConfirm: async () => {
        const token = await getValidToken();
        const totalSteps =
          activeOperations.foldersToCreateCount + activeOperations.totalItemsToMove;
        let completedSteps = 0;
        let succeededCount = 0;
        const failedItems: Array<{ name: string; reason: string }> = [];

        setProgress({
          isRunning: true,
          totalSteps,
          completedSteps: 0,
          currentLabel: 'جارٍ تهيئة المجلدات...',
          succeededCount: 0,
          failedItems: [],
        });

        try {
          const rootFoldersCache = new Map<string, string>();
          const subFoldersCache = new Map<string, string>();

          for (const f of files) {
            if (f.mimeType === FOLDER_MIME_TYPE) {
              if (f.parents?.includes(rootFolderId)) {
                rootFoldersCache.set(f.name.trim(), f.id);
              }
              if (f.parents) {
                for (const pid of f.parents) {
                  subFoldersCache.set(`${pid}::${f.name.trim()}`, f.id);
                }
              }
            }
          }

          for (const bucket of activeOperations.activeBuckets) {
            let targetFolderId = bucket.existingFolderId;

            if (bucket.parentFolderName) {
              let parentId = rootFoldersCache.get(bucket.parentFolderName);
              if (!parentId) {
                setProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        currentLabel: `إنشاء مجلد: ${bucket.parentFolderName}`,
                      }
                    : prev
                );
                const createdParent = await createDriveFolder(
                  token,
                  bucket.parentFolderName,
                  rootFolderId
                );
                parentId = createdParent.id;
                rootFoldersCache.set(bucket.parentFolderName, parentId);
                completedSteps += 1;
              }

              const subKey = `${parentId}::${bucket.targetFolderName}`;
              targetFolderId = subFoldersCache.get(subKey);
              if (!targetFolderId) {
                setProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        completedSteps,
                        currentLabel: `إنشاء مجلد فرعي: ${bucket.parentFolderName} / ${bucket.targetFolderName}`,
                      }
                    : prev
                );
                const createdSub = await createDriveFolder(
                  token,
                  bucket.targetFolderName,
                  parentId
                );
                targetFolderId = createdSub.id;
                subFoldersCache.set(subKey, targetFolderId);
                completedSteps += 1;
              }
            } else if (!targetFolderId) {
              targetFolderId = rootFoldersCache.get(bucket.targetFolderName);
              if (!targetFolderId) {
                setProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        completedSteps,
                        currentLabel: `إنشاء مجلد: ${bucket.targetFolderName}`,
                      }
                    : prev
                );
                const created = await createDriveFolder(
                  token,
                  bucket.targetFolderName,
                  rootFolderId
                );
                targetFolderId = created.id;
                rootFoldersCache.set(bucket.targetFolderName, targetFolderId);
                completedSteps += 1;
              }
            }

            const chunkSize = 4;
            for (let i = 0; i < bucket.selectedFiles.length; i += chunkSize) {
              const chunk = bucket.selectedFiles.slice(i, i + chunkSize);
              await Promise.all(
                chunk.map(async (item) => {
                  try {
                    if (item.id === targetFolderId) return;
                    await moveDriveFile(
                      token,
                      item.id,
                      targetFolderId!,
                      item.parents ?? []
                    );
                    succeededCount += 1;
                  } catch (err) {
                    failedItems.push({
                      name: item.name,
                      reason: err instanceof Error ? err.message : 'فشل النقل',
                    });
                  } finally {
                    completedSteps += 1;
                    setProgress((prev) =>
                      prev
                        ? {
                            ...prev,
                            completedSteps: Math.min(totalSteps, completedSteps),
                            currentLabel: `نقل: ${item.name}`,
                            succeededCount,
                            failedItems: [...failedItems],
                          }
                        : prev
                    );
                  }
                })
              );
            }
          }

          setProgress({
            isRunning: false,
            totalSteps,
            completedSteps: totalSteps,
            currentLabel: 'اكتمل تنفيذ خطة الترتيب',
            succeededCount,
            failedItems,
          });
          await onSyncComplete();
        } catch (err) {
          onError(err instanceof Error ? err.message : 'حدث خطأ أثناء تنفيذ خطة الترتيب');
          setProgress((prev) =>
            prev ? { ...prev, isRunning: false, currentLabel: 'توقف التنفيذ بسبب خطأ' } : null
          );
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            خطة الترتيب الذكية للملفات والمجلدات
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            رتّب ملفاتك ومجلداتك المبعثرة في مجموعات واضحة حسب الموضوع أو النوع أو السنة، وراجعها قبل التنفيذ.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(excludedBucketKeys.size > 0 ||
            excludedFileIds.size > 0 ||
            Object.keys(customFolderNames).length > 0 ||
            Object.keys(customTopicNames).length > 0) && (
            <button
              type="button"
              onClick={() => {
                setExcludedBucketKeys(new Set());
                setExcludedFileIds(new Set());
                setCustomFolderNames({});
                setCustomTopicNames({});
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>استعادة الافتراضي</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExecutePlan}
            disabled={activeOperations.totalItemsToMove === 0 || progress?.isRunning}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            <span>تنفيذ خطة الترتيب ({activeOperations.totalItemsToMove})</span>
          </button>
        </div>
      </div>

      {/* Strategy & Scope Controls */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              نمط التنظيم
            </div>
            <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {(
                [
                  { id: 'by-topic', label: 'حسب الموضوع والمشروع (شامل)' },
                  { id: 'by-category', label: 'حسب نوع الملف' },
                  { id: 'by-year', label: 'حسب السنة' },
                  { id: 'by-category-year', label: 'حسب النوع ثم السنة' },
                ] as Array<{ id: OrganizeStrategy; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setStrategy(opt.id);
                    setExcludedBucketKeys(new Set());
                    setExcludedFileIds(new Set());
                  }}
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    strategy === opt.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
              نطاق الملفات المشمولة
            </div>
            <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setScope('root-only')}
                className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  scope === 'root-only'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                عناصر الجذر غير المرتبة فقط (موصى به)
              </button>
              <button
                type="button"
                onClick={() => setScope('all-owned')}
                className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  scope === 'all-owned'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                كل ملفاتي في درايف
              </button>
            </div>
          </div>
        </div>

        {strategy === 'by-topic' && (
          <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
            <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeFolders}
                onChange={(e) => setIncludeFolders(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700 dark:border-slate-600 dark:bg-slate-800"
              />
              <span>
                تجميع المجلدات المبعثرة في الجذر أيضاً داخل المجلدات الرئيسية الستة (يحافظ على محتوى كل مجلد كما هو)
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Execution Progress Banner */}
      {progress && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {!progress.isRunning && progress.failedItems.length === 0 && (
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              )}
              <span>{progress.currentLabel}</span>
            </div>
            <span className="font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              {progress.completedSteps} / {progress.totalSteps}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full transition-all duration-200 ${
                progress.failedItems.length > 0 && !progress.isRunning
                  ? 'bg-amber-500'
                  : 'bg-blue-700 dark:bg-blue-500'
              }`}
              style={{
                width: `${
                  progress.totalSteps > 0
                    ? Math.round((progress.completedSteps / progress.totalSteps) * 100)
                    : 100
                }%`,
              }}
            />
          </div>
          {!progress.isRunning && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    تم نقل {progress.succeededCount} عنصر بنجاح
                  </span>
                  {progress.failedItems.length > 0 && (
                    <span className="font-medium text-red-700 dark:text-red-400">
                      تعذر نقل {progress.failedItems.length} عنصر:
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setProgress(null)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  إخفاء التقرير
                </button>
              </div>

              {progress.failedItems.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 dark:border-red-900/70 dark:bg-red-950/40">
                  <ul className="space-y-1.5 text-xs text-red-900 dark:text-red-200">
                    {progress.failedItems.map((fail, idx) => (
                      <li
                        key={`${fail.name}-${idx}`}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200/60 pb-1 last:border-none last:pb-0 dark:border-red-900/50"
                      >
                        <span className="font-semibold" dir="auto">
                          {fail.name}
                        </span>
                        <span className="text-red-700 dark:text-red-300" dir="auto">
                          {fail.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Plan Summary Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">مجلدات جديدة ستُنشأ</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {activeOperations.foldersToCreateCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">عناصر محددة للنقل</div>
          <div className="mt-1 font-mono text-xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
            {activeOperations.totalItemsToMove}
            {activeOperations.totalFoldersToMove > 0 && (
              <span className="mr-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                (منها {activeOperations.totalFoldersToMove} مجلد)
              </span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">حجم الملفات المشمولة</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatBytes(activeOperations.totalBytes)}
          </div>
        </div>
      </div>

      {/* Preview Table of Folder Buckets */}
      {planBuckets.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <FolderPlus className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <h2 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-slate-100">
            كل العناصر في هذا النطاق مرتبة بالفعل
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {scope === 'root-only'
              ? 'لا توجد ملفات أو مجلدات مبعثرة في جذر Drive حالياً. يمكنك التبديل إلى "كل ملفاتي في درايف" لإعادة التصنيف الشامل.'
              : 'جميع ملفاتك مصنفة بالفعل داخل المجلدات المستهدفة.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {planBuckets.map((bucket) => {
            const isBucketChecked = !excludedBucketKeys.has(bucket.key);
            const isExpanded = expandedBuckets.has(bucket.key);
            const selectedCount = bucket.files.filter(
              (f) => !excludedFileIds.has(f.id)
            ).length;
            const folderCount = bucket.files.filter((f) => isFolder(f)).length;
            const fileCount = bucket.files.length - folderCount;
            const bucketBytes = bucket.files.reduce(
              (acc, f) => acc + Number(f.size || 0),
              0
            );
            const displayPath = bucket.parentFolderName
              ? `${bucket.parentFolderName} / ${bucket.targetFolderName}`
              : bucket.targetFolderName;

            return (
              <div key={bucket.key} className="transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isBucketChecked}
                      onChange={() => toggleBucket(bucket.key)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700 dark:border-slate-600 dark:bg-slate-800"
                      aria-label={`تضمين مجلد ${displayPath}`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleExpand(bucket.key)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      aria-label={isExpanded ? 'طي قائمة العناصر' : 'عرض العناصر'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {strategy === 'by-topic' && bucket.topicId ? (
                          <input
                            type="text"
                            value={
                              customTopicNames[bucket.topicId] ??
                              TOPIC_DEFINITIONS[bucket.topicId].folderName
                            }
                            onChange={(e) =>
                              setCustomTopicNames((prev) => ({
                                ...prev,
                                [bucket.topicId!]: e.target.value,
                              }))
                            }
                            className="w-72 max-w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm font-semibold text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                            aria-label="تعديل اسم المجلد الرئيسي"
                          />
                        ) : strategy === 'by-category' ? (
                          <input
                            type="text"
                            value={
                              customFolderNames[bucket.categoryId] ??
                              CATEGORY_DEFINITIONS[bucket.categoryId].folderName
                            }
                            onChange={(e) =>
                              setCustomFolderNames((prev) => ({
                                ...prev,
                                [bucket.categoryId]: e.target.value,
                              }))
                            }
                            className="w-64 max-w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm font-semibold text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                            aria-label="تعديل اسم المجلد المستهدف"
                          />
                        ) : (
                          <span
                            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                            dir="auto"
                          >
                            {displayPath}
                          </span>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {bucket.existingFolderId
                            ? 'سيُضاف إلى المجلد الموجود'
                            : 'سيتم إنشاء مجلد جديد'}
                        </span>
                      </div>
                      {strategy === 'by-topic' && bucket.topicId && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {TOPIC_DEFINITIONS[bucket.topicId].descriptionAr}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                    <span className="font-mono">
                      {selectedCount} / {bucket.files.length} عنصر
                      {folderCount > 0 && fileCount > 0
                        ? ` (${folderCount} مجلد · ${fileCount} ملف)`
                        : folderCount > 0
                          ? ` (${folderCount} مجلد)`
                          : ''}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {bucketBytes > 0 ? formatBytes(bucketBytes) : '—'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                          <th className="w-8 py-2"></th>
                          <th className="py-2 font-medium">الاسم</th>
                          <th className="py-2 font-medium">النوع</th>
                          <th className="py-2 font-medium">الموقع الحالي</th>
                          <th className="py-2 text-left font-medium">آخر تعديل</th>
                          <th className="py-2 text-left font-medium">الحجم</th>
                          <th className="w-12 py-2 text-left font-medium">معاينة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                        {bucket.files.map((item) => {
                          const isItemChecked =
                            isBucketChecked && !excludedFileIds.has(item.id);
                          const currentParentId = item.parents?.[0];
                          const currentPath = currentParentId
                            ? folderPathMap.get(currentParentId) ?? 'ملفاتي'
                            : 'ملفاتي';
                          const previewType = getMediaPreviewType(item);
                          const bucketMediaList = bucket.files.filter(
                            (f) => getMediaPreviewType(f) !== null
                          );

                          return (
                            <tr key={item.id} className="hover:bg-white/80 dark:hover:bg-slate-900/70">
                              <td className="py-2">
                                <input
                                  type="checkbox"
                                  checked={isItemChecked}
                                  disabled={!isBucketChecked}
                                  onChange={() => toggleFile(item.id)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700 focus:ring-blue-700 dark:border-slate-600 dark:bg-slate-800"
                                  aria-label={`تحديد ${item.name}`}
                                />
                              </td>
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  <FileTypeIcon file={item} className="h-3.5 w-3.5" />
                                  {previewType ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewState({
                                          file: item,
                                          list: bucketMediaList,
                                        })
                                      }
                                      className="max-w-xs truncate text-right font-medium text-slate-800 hover:text-blue-700 hover:underline dark:text-slate-200 dark:hover:text-blue-400"
                                      dir="auto"
                                    >
                                      {item.name}
                                    </button>
                                  ) : (
                                    <span
                                      className="max-w-xs truncate font-medium text-slate-800 dark:text-slate-200"
                                      dir="auto"
                                    >
                                      {item.name}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 text-slate-500 dark:text-slate-400">
                                {isFolder(item) ? 'مجلد' : 'ملف'}
                              </td>
                              <td
                                className="max-w-[180px] truncate py-2 text-slate-500 dark:text-slate-400"
                                dir="auto"
                              >
                                {currentPath}
                              </td>
                              <td className="py-2 text-left font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                                {formatDateShort(item.modifiedTime)}
                              </td>
                              <td className="py-2 text-left font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                                {isFolder(item)
                                  ? '—'
                                  : item.size
                                    ? formatBytes(item.size)
                                    : '—'}
                              </td>
                              <td className="py-2 text-left">
                                {previewType ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewState({
                                        file: item,
                                        list: bucketMediaList,
                                      })
                                    }
                                    aria-label={`معاينة وتكبير ${item.name} بملء الشاشة`}
                                    title="معاينة وتكبير بملء الشاشة"
                                    className="inline-flex rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/60 dark:hover:text-blue-300"
                                  >
                                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-700">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fullscreen Zoomable Image & Video Lightbox */}
      <MediaLightboxModal
        file={previewState?.file ?? null}
        mediaList={previewState?.list ?? []}
        getValidToken={getValidToken}
        onSelectFile={(nextFile) =>
          setPreviewState((prev) => (prev ? { ...prev, file: nextFile } : null))
        }
        onClose={() => setPreviewState(null)}
      />
    </div>
  );
}
