import { useMemo, useState } from 'react';
import {
  CheckSquare,
  ExternalLink,
  FolderX,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { ConfirmationRequest, DriveFile } from '../types/drive';
import {
  findDuplicateGroups,
  findEmptyFolders,
  findLargeFiles,
  formatBytes,
  formatDateShort,
  isFolder,
} from '../lib/organizer';
import {
  checkFolderEmptyStatus,
  trashDriveFile,
  type FolderEmptyCheckStatus,
} from '../lib/driveApi';
import { FileTypeIcon } from './FileTypeIcon';

interface CleanupViewProps {
  files: DriveFile[];
  folderPathMap: Map<string, string>;
  getValidToken: () => Promise<string>;
  requestConfirmation: (req: ConfirmationRequest) => void;
  onSyncComplete: () => Promise<void>;
  onError: (msg: string) => void;
}

type CleanupTab = 'duplicates' | 'empty-folders' | 'large-files';

export function CleanupView({
  files,
  folderPathMap,
  getValidToken,
  requestConfirmation,
  onSyncComplete,
  onError,
}: CleanupViewProps) {
  const [activeTab, setActiveTab] = useState<CleanupTab>('duplicates');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [verificationMap, setVerificationMap] = useState<
    Record<string, { status: FolderEmptyCheckStatus; sampleChildName?: string }>
  >({});
  const [isVerifyingFolders, setIsVerifyingFolders] = useState(false);
  const [verifiedProgress, setVerifiedProgress] = useState(0);

  const duplicateGroups = useMemo(() => findDuplicateGroups(files), [files]);
  const emptyFolders = useMemo(() => findEmptyFolders(files), [files]);
  const largeFiles = useMemo(() => findLargeFiles(files), [files]);

  const totalWastedBytes = useMemo(
    () => duplicateGroups.reduce((acc, g) => acc + g.wastedSizeBytes, 0),
    [duplicateGroups]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAutoSelectOlderDuplicates = () => {
    const olderIds = new Set<string>();
    for (const group of duplicateGroups) {
      for (let i = 1; i < group.files.length; i++) {
        if (group.files[i].ownedByMe !== false) {
          olderIds.add(group.files[i].id);
        }
      }
    }
    setSelectedIds(olderIds);
  };

  const handleSelectAllEmptyFolders = () => {
    setSelectedIds(
      new Set(
        emptyFolders
          .filter((f) => verificationMap[f.id]?.status !== 'not-empty')
          .map((f) => f.id)
      )
    );
  };

  const handleVerifyEmptyFolders = async () => {
    if (emptyFolders.length === 0 || isVerifyingFolders) return;
    setIsVerifyingFolders(true);
    setVerifiedProgress(0);
    try {
      const token = await getValidToken();
      const nextMap: Record<
        string,
        { status: FolderEmptyCheckStatus; sampleChildName?: string }
      > = {};
      for (let i = 0; i < emptyFolders.length; i++) {
        const folder = emptyFolders[i];
        const res = await checkFolderEmptyStatus(token, folder.id);
        nextMap[folder.id] = res;
        setVerifiedProgress(i + 1);
      }
      setVerificationMap(nextMap);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const [id, info] of Object.entries(nextMap)) {
          if (info.status === 'not-empty') {
            next.delete(id);
          }
        }
        return next;
      });
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : 'تعذر التحقق المباشر من محتوى المجلدات في Google Drive.'
      );
    } finally {
      setIsVerifyingFolders(false);
    }
  };

  const handleTrashSelected = () => {
    const selectedFiles = files.filter(
      (f) => selectedIds.has(f.id) && f.ownedByMe !== false
    );
    if (selectedFiles.length === 0) return;

    const hasFolders = selectedFiles.some((f) => isFolder(f));
    const description = hasFolders
      ? `سيتم التحقق المباشر من خلو كل مجلد محدد عبر Google Drive قبل نقله، ولن يُنقل أي مجلد يحتوي على ملفات نشطة. سيتم نقل ${selectedFiles.length} عنصر إلى سلة المهملات.`
      : `سيتم نقل ${selectedFiles.length} عنصر إلى سلة المهملات في Google Drive. يمكنك استعادتها من سلة المهملات في أي وقت قبل حذفها نهائياً.`;

    requestConfirmation({
      title: 'تأكيد نقل العناصر المحددة إلى السلة',
      description,
      confirmLabel: 'نقل إلى سلة المهملات',
      variant: 'danger',
      itemsPreview: selectedFiles.map((f) => f.name),
      totalCount: selectedFiles.length,
      onConfirm: async () => {
        try {
          const token = await getValidToken();
          const skippedNonEmpty: string[] = [];

          for (const item of selectedFiles) {
            if (isFolder(item)) {
              const check = await checkFolderEmptyStatus(token, item.id);
              setVerificationMap((prev) => ({ ...prev, [item.id]: check }));
              if (check.status === 'not-empty') {
                skippedNonEmpty.push(item.name);
                continue;
              }
            }
            await trashDriveFile(token, item.id);
          }

          setSelectedIds(new Set());
          await onSyncComplete();

          if (skippedNonEmpty.length > 0) {
            onError(
              `تم حماية ${skippedNonEmpty.length} مجلد من الحذف لأنها ليست فارغة فعلياً في Drive: ${skippedNonEmpty.join('، ')}`
            );
          }
        } catch (err) {
          onError(err instanceof Error ? err.message : 'تعذر نقل بعض العناصر للسلة');
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            التكرارات وتنظيف المساحة
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            راجع الملفات المكررة والمجلدات الفارغة والملفات الضخمة لنقل غير الضروري منها إلى السلة.
          </p>
        </div>

        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={handleTrashSelected}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>نقل المحدد للسلة ({selectedIds.size})</span>
          </button>
        )}
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveTab('duplicates');
              setSelectedIds(new Set());
            }}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'duplicates'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            الملفات المكررة ({duplicateGroups.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('empty-folders');
              setSelectedIds(new Set());
            }}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'empty-folders'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            المجلدات الفارغة ({emptyFolders.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('large-files');
              setSelectedIds(new Set());
            }}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'large-files'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            ملفات أكبر من 10 MB ({largeFiles.length})
          </button>
        </div>

        {activeTab === 'duplicates' && duplicateGroups.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              مساحة قابلة للتوفير: {formatBytes(totalWastedBytes)}
            </span>
            <button
              type="button"
              onClick={handleAutoSelectOlderDuplicates}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              <CheckSquare className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
              <span>تحديد النسخ الأقدم والإبقاء على الأحدث</span>
            </button>
          </div>
        )}

        {activeTab === 'empty-folders' && emptyFolders.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleVerifyEmptyFolders()}
              disabled={isVerifyingFolders}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-950 whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {isVerifyingFolders
                  ? `جارٍ التحقق المباشر (${verifiedProgress}/${emptyFolders.length})...`
                  : 'تحقق مباشر من Drive (100%)'}
              </span>
            </button>
            <button
              type="button"
              onClick={handleSelectAllEmptyFolders}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              <CheckSquare className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
              <span>تحديد المجلدات الفارغة</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'duplicates' && (
        <>
          {duplicateGroups.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              لم يتم العثور على ملفات مكررة في حسابك.
            </div>
          ) : (
            <div className="space-y-4">
              {duplicateGroups.map((group) => (
                <div
                  key={group.key}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="min-w-0">
                      <span
                        className="text-sm font-bold text-slate-900 dark:text-slate-100"
                        dir="auto"
                      >
                        {group.displayName}
                      </span>
                      <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {group.reason === 'md5'
                          ? 'تطابق تام في المحتوى (MD5)'
                          : group.reason === 'copy-suffix'
                            ? 'نسخة مكررة بالترقيم مثل (1) / (2)'
                            : 'تطابق في الاسم والنوع'}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                      {group.files.length} نسخ
                      {group.wastedSizeBytes > 0
                        ? ` · توفير ${formatBytes(group.wastedSizeBytes)}`
                        : ''}
                    </div>
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {group.files.map((file, idx) => {
                      const parentPath = file.parents?.[0]
                        ? folderPathMap.get(file.parents[0]) ?? 'ملفاتي'
                        : 'ملفاتي';
                      const canTrash = file.ownedByMe !== false;

                      return (
                        <div
                          key={`${group.key}::${file.id}`}
                          className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <input
                              type="checkbox"
                              disabled={!canTrash}
                              checked={selectedIds.has(file.id)}
                              onChange={() => toggleSelect(file.id)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
                              aria-label={`تحديد نسخة ${file.name}`}
                            />
                            <FileTypeIcon file={file} className="h-4 w-4" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="truncate font-medium text-slate-900 dark:text-slate-100"
                                  dir="auto"
                                >
                                  {file.name}
                                </span>
                                {idx === 0 && (
                                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                    الأحدث
                                  </span>
                                )}
                              </div>
                              <div
                                className="truncate text-xs text-slate-500 dark:text-slate-400"
                                dir="auto"
                              >
                                {parentPath}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            <span className="font-mono">
                              {formatDateShort(file.modifiedTime)}
                            </span>
                            <span className="font-mono">
                              {file.size ? formatBytes(file.size) : '—'}
                            </span>
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                aria-label="فتح في Google Drive"
                              >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'empty-folders' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {emptyFolders.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              <FolderX className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              <p className="mt-2">لا توجد مجلدات فارغة في حسابك.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                    <th className="w-10 px-4 py-3"></th>
                    <th className="px-3 py-3">اسم المجلد</th>
                    <th className="px-3 py-3">المسار</th>
                    <th className="px-3 py-3">التحقق المباشر</th>
                    <th className="px-3 py-3 text-left">آخر تعديل</th>
                    <th className="w-14 px-4 py-3 text-left">فتح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {emptyFolders.map((folder) => {
                    const parentPath = folder.parents?.[0]
                      ? folderPathMap.get(folder.parents[0]) ?? 'ملفاتي'
                      : 'ملفاتي';
                    const checkInfo = verificationMap[folder.id];
                    const isNotEmpty = checkInfo?.status === 'not-empty';

                    return (
                      <tr
                        key={folder.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            disabled={isNotEmpty}
                            checked={selectedIds.has(folder.id)}
                            onChange={() => toggleSelect(folder.id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
                            aria-label={`تحديد ${folder.name}`}
                          />
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <FileTypeIcon file={folder} className="h-4 w-4" />
                            <span dir="auto">{folder.name}</span>
                          </div>
                        </td>
                        <td
                          className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400"
                          dir="auto"
                        >
                          {parentPath}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {!checkInfo && (
                            <span className="text-slate-500 dark:text-slate-400">
                              فحص مبدئي (اضغط تحقق مباشر)
                            </span>
                          )}
                          {checkInfo?.status === 'empty' && (
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                              فارغ 100% (مؤكد من Drive)
                            </span>
                          )}
                          {checkInfo?.status === 'has-trashed' && (
                            <span className="font-medium text-amber-700 dark:text-amber-400">
                              فارغ حالياً (يحتوي عناصر في السلة مثل: {checkInfo.sampleChildName})
                            </span>
                          )}
                          {checkInfo?.status === 'not-empty' && (
                            <span className="font-semibold text-red-700 dark:text-red-400">
                              غير فارغ — يحتوي على: {checkInfo.sampleChildName}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-left font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {formatDateShort(folder.modifiedTime)}
                        </td>
                        <td className="px-4 py-3 text-left">
                          {folder.webViewLink && (
                            <a
                              href={folder.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              aria-label={`فتح ${folder.name} في Google Drive`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
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
      )}

      {activeTab === 'large-files' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {largeFiles.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              لا توجد ملفات أكبر من 10 ميجابايت في حسابك.
            </div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                  <th className="w-10 px-4 py-3"></th>
                  <th className="px-3 py-3">اسم الملف</th>
                  <th className="px-3 py-3">الموقع</th>
                  <th className="px-3 py-3 text-left">آخر تعديل</th>
                  <th className="px-6 py-3 text-left">الحجم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {largeFiles.map((file) => {
                  const parentPath = file.parents?.[0]
                    ? folderPathMap.get(file.parents[0]) ?? 'ملفاتي'
                    : 'ملفاتي';
                  const canTrash = file.ownedByMe !== false;
                  return (
                    <tr
                      key={file.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          disabled={!canTrash}
                          checked={selectedIds.has(file.id)}
                          onChange={() => toggleSelect(file.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
                          aria-label={`تحديد ${file.name}`}
                        />
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <FileTypeIcon file={file} className="h-4 w-4" />
                          <span className="max-w-md truncate" dir="auto">
                            {file.name}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate"
                        dir="auto"
                      >
                        {parentPath}
                      </td>
                      <td className="px-3 py-3 text-left font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatDateShort(file.modifiedTime)}
                      </td>
                      <td className="px-6 py-3 text-left font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatBytes(file.size)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
