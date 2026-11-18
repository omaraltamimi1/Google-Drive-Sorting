import {
  ArrowUpLeft,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Layers,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  ConfirmationRequest,
  DriveFile,
  DriveQuota,
  FileCategoryId,
} from '../types/drive';
import {
  CATEGORY_DEFINITIONS,
  findDuplicateGroups,
  findEmptyFolders,
  formatBytes,
  getFileCategory,
  isFolder,
  isInRoot,
} from '../lib/organizer';
import { emptyDriveTrash } from '../lib/driveApi';

import { StorageSummary } from './StorageSummary';
import { ExternalSharingAudit } from './ExternalSharingAudit';

interface OverviewViewProps {
  files: DriveFile[];
  trashedFiles: DriveFile[];
  quota: DriveQuota;
  rootFolderId: string;
  userEmail: string;
  isDark: boolean;
  getValidToken: () => Promise<string>;
  requestConfirmation: (req: ConfirmationRequest) => void;
  onSyncComplete: () => Promise<void>;
  onError: (msg: string) => void;
  onNavigate: (tab: 'organize' | 'explorer' | 'cleanup') => void;
}

export function OverviewView({
  files,
  trashedFiles,
  quota,
  rootFolderId,
  userEmail,
  isDark,
  getValidToken,
  requestConfirmation,
  onSyncComplete,
  onError,
  onNavigate,
}: OverviewViewProps) {
  const nonFolders = files.filter((f) => !isFolder(f));
  const folders = files.filter((f) => isFolder(f));
  const unorganizedRootFiles = nonFolders.filter((f) => isInRoot(f, rootFolderId));
  const duplicateGroups = findDuplicateGroups(files);
  const emptyFolders = findEmptyFolders(files);

  const usedBytes = Number(quota.usage || 0);
  const limitBytes = Number(quota.limit || 0);
  const usedPercent = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;

  const categoryStats = new Map<
    FileCategoryId,
    { count: number; totalBytes: number; rootCount: number }
  >();

  for (const catKey of Object.keys(CATEGORY_DEFINITIONS) as FileCategoryId[]) {
    categoryStats.set(catKey, { count: 0, totalBytes: 0, rootCount: 0 });
  }

  let totalMeasuredFileBytes = 0;
  for (const f of nonFolders) {
    const cat = getFileCategory(f);
    const size = Number(f.size || 0);
    totalMeasuredFileBytes += size;
    const entry = categoryStats.get(cat)!;
    entry.count += 1;
    entry.totalBytes += size;
    if (isInRoot(f, rootFolderId)) {
      entry.rootCount += 1;
    }
  }

  const sortedCategories = (Object.keys(CATEGORY_DEFINITIONS) as FileCategoryId[])
    .map((id) => ({
      def: CATEGORY_DEFINITIONS[id],
      ...categoryStats.get(id)!,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const duplicateExtraFiles = duplicateGroups.reduce(
    (sum, g) => sum + (g.files.length - 1),
    0
  );

  const quotaTrashBytes = Number(quota.usageInDriveTrash || 0);
  const measuredTrashBytes = trashedFiles.reduce(
    (sum, f) => sum + Number(f.size || 0),
    0
  );
  const trashBytes = Math.max(quotaTrashBytes, measuredTrashBytes);
  const trashPercent =
    limitBytes > 0 ? Math.min(100, (trashBytes / limitBytes) * 100) : 0;
  const hasTrashItems = trashBytes > 0 || trashedFiles.length > 0;

  const handleEmptyTrash = () => {
    if (!hasTrashItems) return;
    requestConfirmation({
      title: 'تأكيد إفراغ سلة مهملات Google Drive نهائياً',
      description: `سيتم حذف جميع العناصر الموجودة في سلة المهملات (${trashedFiles.length.toLocaleString('en-US')} عنصر بمساحة ${formatBytes(trashBytes)}) بشكل نهائي لتحرير المساحة، ولا يمكن استعادتها بعد التنفيذ.`,
      confirmLabel: `إفراغ السلة نهائياً (${formatBytes(trashBytes)})`,
      variant: 'danger',
      itemsPreview:
        trashedFiles.length > 0
          ? trashedFiles.map((f) => f.name)
          : [`إجمالي المساحة في السلة: ${formatBytes(trashBytes)}`],
      totalCount: trashedFiles.length > 0 ? trashedFiles.length : 1,
      onConfirm: async () => {
        try {
          const token = await getValidToken();
          await emptyDriveTrash(token);
          await onSyncComplete();
        } catch (err) {
          onError(
            err instanceof Error
              ? err.message
              : 'تعذر إفراغ سلة مهملات Google Drive.'
          );
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            نظرة عامة على Google Drive
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            تحليل فوري لبنية الملفات والمساحة المستخدمة والملفات التي تحتاج إلى ترتيب.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('organize')}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>بدء ترتيب الملفات</span>
        </button>
      </div>

      {/* Key Metric Grid (Single-Elevation, Hairline Borders, Tabular Numerals) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            إجمالي الملفات والمجلدات
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {nonFolders.length.toLocaleString('en-US')}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            مع {folders.length.toLocaleString('en-US')} مجلد في الحساب
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            ملفات الجذر غير المرتبة
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {unorganizedRootFiles.length.toLocaleString('en-US')}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            موجودة خارج المجلدات في الصفحة الرئيسية
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            نسخ مكررة ومجلدات فارغة
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {(duplicateExtraFiles + emptyFolders.length).toLocaleString('en-US')}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {duplicateExtraFiles} نسخة مكررة · {emptyFolders.length} مجلد فارغ
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>المساحة المستخدمة</span>
            <HardDrive className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatBytes(usedBytes)}
          </div>
          {limitBytes > 0 ? (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full bg-blue-700 transition-all dark:bg-blue-500"
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                من أصل {formatBytes(limitBytes)} ({usedPercent.toFixed(1)}%)
              </div>
            </div>
          ) : (
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              مساحة تخزين غير محدودة
            </div>
          )}
        </div>
      </div>

      {/* Storage Summary Charts (Recharts) */}
      <StorageSummary files={files} quota={quota} isDark={isDark} />

      {/* Quick Action Strips */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => onNavigate('organize')}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 text-right transition-colors hover:border-blue-300 hover:bg-blue-50/30 focus-visible:outline-2 focus-visible:outline-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
        >
          <div className="flex items-start gap-3.5">
            <Layers
              className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-400"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                خطة الترتيب الذكية للملفات
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                تصنيف {unorganizedRootFiles.length} ملف في الجذر أو جميع ملفاتك تلقائياً إلى مجلدات مرتبة.
              </p>
            </div>
          </div>
          <ArrowUpLeft className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('cleanup')}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 text-right transition-colors hover:border-blue-300 hover:bg-blue-50/30 focus-visible:outline-2 focus-visible:outline-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
        >
          <div className="flex items-start gap-3.5">
            <FolderOpen
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                مراجعة التكرارات والمجلدات الفارغة
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {duplicateGroups.length} مجموعة مكررة و{emptyFolders.length} مجلد فارغ جاهز للمراجعة والتنظيف.
              </p>
            </div>
          </div>
          <ArrowUpLeft className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        </button>
      </div>

      {/* Google Drive Trash Size & Quick Empty Suggestion */}
      <section
        aria-labelledby="drive-trash-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            {hasTrashItems ? (
              <Trash2
                className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="drive-trash-heading"
                  className="font-display text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  سلة مهملات Google Drive
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {hasTrashItems ? (
                    <>
                      <span aria-hidden="true">·</span>{' '}
                      <span className="font-mono font-semibold text-red-700 dark:text-red-400">
                        {formatBytes(trashBytes)}
                      </span>{' '}
                      <span aria-hidden="true">·</span>{' '}
                      <span>
                        {trashedFiles.length.toLocaleString('en-US')} عنصر في السلة
                      </span>
                      {limitBytes > 0 && trashBytes > 0 && (
                        <>
                          {' '}
                          <span aria-hidden="true">·</span>{' '}
                          <span>{trashPercent.toFixed(1)}% من السعة الكلية</span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">·</span> فارغة (0 B)
                    </>
                  )}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {hasTrashItems
                  ? `اقتراح لتوفير المساحة: إفراغ سلة المهملات الآن سيحرّر ${formatBytes(trashBytes)} من مساحة التخزين فوراً.`
                  : 'سلة المهملات فارغة حالياً ولا تستهلك أي مساحة من حصتك في Google Drive.'}
              </p>
            </div>
          </div>

          {hasTrashItems && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <a
                href="https://drive.google.com/drive/trash"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>مراجعة السلة في Drive</span>
              </a>
              <button
                type="button"
                onClick={handleEmptyTrash}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-600 dark:bg-red-600 dark:hover:bg-red-500 whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>إفراغ السلة وتوفير {formatBytes(trashBytes)}</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* External Sharing Quick Audit (Top 5 Sensitive Files) */}
      <ExternalSharingAudit
        files={files}
        userEmail={userEmail}
        getValidToken={getValidToken}
        requestConfirmation={requestConfirmation}
        onSyncComplete={onSyncComplete}
        onError={onError}
      />

      {/* Category Distribution Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
            توزيع الملفات حسب التصنيف
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {sortedCategories.length} تصنيفات نشطة
          </span>
        </div>

        {sortedCategories.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            لا توجد ملفات مصنفة بعد في Google Drive.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="px-6 py-3">التصنيف</th>
                  <th className="px-4 py-3">اسم المجلد المقترح</th>
                  <th className="px-4 py-3 text-left">عدد الملفات</th>
                  <th className="px-4 py-3 text-left">في الجذر</th>
                  <th className="px-6 py-3 text-left">الحجم الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sortedCategories.map((row) => {
                  const pct =
                    totalMeasuredFileBytes > 0
                      ? ((row.totalBytes / totalMeasuredFileBytes) * 100).toFixed(1)
                      : '0.0';
                  return (
                    <tr
                      key={row.def.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <div>{row.def.labelAr}</div>
                        <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          {row.def.descriptionAr}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300" dir="auto">
                        {row.def.folderName}
                      </td>
                      <td className="px-4 py-3 text-left font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                        {row.count.toLocaleString('en-US')}
                      </td>
                      <td className="px-4 py-3 text-left font-mono text-amber-700 dark:text-amber-400 tabular-nums">
                        {row.rootCount.toLocaleString('en-US')}
                      </td>
                      <td className="px-6 py-3 text-left font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                        {row.totalBytes > 0 ? `${formatBytes(row.totalBytes)} (${pct}%)` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
