import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ExternalLink,
  FolderInput,
  FolderPlus,
  Maximize2,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { ConfirmationRequest, DriveFile, FileCategoryId } from '../types/drive';
import {
  canMoveFile,
  CATEGORY_DEFINITIONS,
  formatBytes,
  formatDateShort,
  getFileCategory,
  getMediaPreviewType,
  getMimeLabelAr,
  isFolder,
} from '../lib/organizer';
import {
  createDriveFolder,
  moveDriveFile,
  renameDriveFile,
  trashDriveFile,
} from '../lib/driveApi';
import { FileTypeIcon } from './FileTypeIcon';
import { MediaLightboxModal } from './MediaLightboxModal';

interface FileExplorerViewProps {
  files: DriveFile[];
  rootFolderId: string;
  getValidToken: () => Promise<string>;
  requestConfirmation: (req: ConfirmationRequest) => void;
  onSyncComplete: () => Promise<void>;
  onError: (msg: string) => void;
}

type TypeFilter = 'all' | 'folders' | FileCategoryId;
type SortField = 'name' | 'modifiedTime' | 'size';
type SearchScope = 'all' | 'current';

export function FileExplorerView({
  files,
  rootFolderId,
  getValidToken,
  requestConfirmation,
  onSyncComplete,
  onError,
}: FileExplorerViewProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string>(rootFolderId);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals for user input (Create Folder, Rename, Move Destination, Media Lightbox)
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<DriveFile | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState(rootFolderId);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);

  const fileMap = useMemo(() => {
    const map = new Map<string, DriveFile>();
    for (const f of files) map.set(f.id, f);
    return map;
  }, [files]);

  const allFolders = useMemo(
    () =>
      files
        .filter((f) => isFolder(f) && f.ownedByMe !== false)
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [files]
  );

  const breadcrumbs = useMemo(() => {
    const trail: Array<{ id: string; name: string }> = [];
    let cursor: string | undefined = currentFolderId;
    const visited = new Set<string>();

    while (cursor && cursor !== rootFolderId && !visited.has(cursor)) {
      visited.add(cursor);
      const folder = fileMap.get(cursor);
      if (!folder) break;
      trail.unshift({ id: folder.id, name: folder.name });
      cursor = folder.parents?.[0];
    }
    trail.unshift({ id: rootFolderId, name: 'ملفاتي' });
    return trail;
  }, [currentFolderId, rootFolderId, fileMap]);

  const getParentFolderLabel = (file: DriveFile): string => {
    const parentId = file.parents?.[0];
    if (!parentId) return 'غير محدد';
    if (parentId === rootFolderId) return 'ملفاتي';
    return fileMap.get(parentId)?.name ?? 'مجلد مشترك';
  };

  const renderHighlightedName = (name: string, query: string) => {
    const q = query.trim();
    if (!q) return name;
    const lowerName = name.toLowerCase();
    const lowerQ = q.toLowerCase();
    const idx = lowerName.indexOf(lowerQ);
    if (idx === -1) return name;
    const before = name.slice(0, idx);
    const match = name.slice(idx, idx + q.length);
    const after = name.slice(idx + q.length);
    return (
      <>
        {before}
        <mark className="rounded-xs bg-amber-200/80 px-0.5 text-slate-900 dark:bg-amber-500/30 dark:text-amber-200">
          {match}
        </mark>
        {after}
      </>
    );
  };

  const visibleFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = files.filter((f) => {
      if (q) {
        if (!f.name.toLowerCase().includes(q)) return false;
        if (searchScope === 'current' && !f.parents?.includes(currentFolderId)) {
          return false;
        }
      } else {
        if (!f.parents?.includes(currentFolderId)) return false;
      }

      if (typeFilter === 'folders') return isFolder(f);
      if (typeFilter !== 'all') {
        if (isFolder(f)) return false;
        return getFileCategory(f) === typeFilter;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      // Folders always first when not filtering exclusively
      if (isFolder(a) !== isFolder(b)) {
        return isFolder(a) ? -1 : 1;
      }
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name, 'ar');
      } else if (sortField === 'size') {
        cmp = Number(a.size || 0) - Number(b.size || 0);
      } else {
        cmp =
          new Date(a.modifiedTime || 0).getTime() -
          new Date(b.modifiedTime || 0).getTime();
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [
    files,
    searchQuery,
    searchScope,
    currentFolderId,
    typeFilter,
    sortField,
    sortAsc,
  ]);

  const selectedFiles = useMemo(
    () => files.filter((f) => selectedIds.has(f.id)),
    [files, selectedIds]
  );

  const toggleSelectAll = () => {
    if (visibleFiles.length === 0) return;
    const allSelected = visibleFiles.every((f) => selectedIds.has(f.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleFiles.map((f) => f.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(field === 'name');
    }
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    setNewFolderModalOpen(false);
    requestConfirmation({
      title: 'تأكيد إنشاء مجلد جديد',
      description: `سيتم إنشاء المجلد "${trimmed}" داخل "${breadcrumbs[breadcrumbs.length - 1]?.name ?? 'ملفاتي'}".`,
      confirmLabel: 'إنشاء المجلد',
      variant: 'primary',
      itemsPreview: [trimmed],
      totalCount: 1,
      onConfirm: async () => {
        try {
          const token = await getValidToken();
          await createDriveFolder(token, trimmed, currentFolderId);
          setNewFolderName('');
          await onSyncComplete();
        } catch (err) {
          onError(err instanceof Error ? err.message : 'تعذر إنشاء المجلد');
        }
      },
    });
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    const target = renameTarget;
    setRenameTarget(null);
    requestConfirmation({
      title: 'تأكيد إعادة التسمية',
      description: `هل تريد تغيير اسم "${target.name}" إلى "${trimmed}"؟`,
      confirmLabel: 'حفظ الاسم الجديد',
      variant: 'primary',
      itemsPreview: [`${target.name} ← ${trimmed}`],
      totalCount: 1,
      onConfirm: async () => {
        try {
          const token = await getValidToken();
          await renameDriveFile(token, target.id, trimmed);
          await onSyncComplete();
        } catch (err) {
          onError(err instanceof Error ? err.message : 'تعذر إعادة التسمية');
        }
      },
    });
  };

  const handleMoveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const movable = selectedFiles.filter(
      (f) => canMoveFile(f) && f.id !== moveTargetFolderId
    );
    if (movable.length === 0) {
      setMoveModalOpen(false);
      return;
    }
    const destName =
      moveTargetFolderId === rootFolderId
        ? 'ملفاتي (الجذر)'
        : fileMap.get(moveTargetFolderId)?.name ?? 'المجلد المحدد';
    setMoveModalOpen(false);

    requestConfirmation({
      title: 'تأكيد نقل العناصر المحددة',
      description: `سيتم نقل ${movable.length} عنصر إلى "${destName}".`,
      confirmLabel: 'نقل العناصر',
      variant: 'primary',
      itemsPreview: movable.map((f) => f.name),
      totalCount: movable.length,
      onConfirm: async () => {
        try {
          const token = await getValidToken();
          for (const item of movable) {
            await moveDriveFile(
              token,
              item.id,
              moveTargetFolderId,
              item.parents ?? []
            );
          }
          setSelectedIds(new Set());
          await onSyncComplete();
        } catch (err) {
          onError(err instanceof Error ? err.message : 'تعذر نقل بعض العناصر');
        }
      },
    });
  };

  const handleBulkTrash = () => {
    const trashable = selectedFiles.filter((f) => f.ownedByMe !== false);
    if (trashable.length === 0) return;

    requestConfirmation({
      title: 'نقل العناصر المحددة إلى سلة المهملات',
      description: `سيتم نقل ${trashable.length} عنصر إلى سلة المهملات في Google Drive. يمكنك استعادتها لاحقاً من السلة في Drive.`,
      confirmLabel: 'نقل إلى السلة',
      variant: 'danger',
      itemsPreview: trashable.map((f) => f.name),
      totalCount: trashable.length,
      onConfirm: async () => {
        try {
          const token = await getValidToken();
          for (const item of trashable) {
            await trashDriveFile(token, item.id);
          }
          setSelectedIds(new Set());
          await onSyncComplete();
        } catch (err) {
          onError(err instanceof Error ? err.message : 'تعذر نقل بعض الملفات للسلة');
        }
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            مستعرض الملفات والمجلدات
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            تصفح المجلدات أو ابحث عبر جميع ملفات Drive لإدارتها ونقلها جماعياً.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewFolderName('');
            setNewFolderModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
        >
          <FolderPlus className="h-4 w-4 text-blue-700 dark:text-blue-400" aria-hidden="true" />
          <span>مجلد جديد</span>
        </button>
      </div>

      {/* Search + Breadcrumbs + Filter Toolbar */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {/* Instant Search Bar Row */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="البحث عن ملف أو مجلد بالاسم"
              placeholder="ابحث عن ملف أو مجلد بالاسم لتصفية النتائج فورياً..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pr-9 pl-9 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="مسح نص البحث"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="نطاق البحث"
            className="inline-flex items-center gap-1 self-start rounded-lg bg-slate-100 p-1 dark:bg-slate-800 sm:self-auto"
          >
            <button
              type="button"
              onClick={() => setSearchScope('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                searchScope === 'all'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              في كل Drive
            </button>
            <button
              type="button"
              onClick={() => setSearchScope('current')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                searchScope === 'current'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              المجلد الحالي
            </button>
          </div>
        </div>

        {/* Breadcrumbs + Result Count */}
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="مسار المجلد" className="flex flex-wrap items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <div key={crumb.id} className="flex items-center gap-1">
                  {idx > 0 && (
                    <ChevronLeft className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentFolderId(crumb.id);
                      setSelectedIds(new Set());
                    }}
                    className={`rounded px-2 py-1 transition-colors ${
                      isLast
                        ? 'font-bold text-slate-900 dark:text-slate-100'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </div>
              );
            })}
          </nav>

          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap shrink-0">
            {searchQuery.trim()
              ? `${visibleFiles.length.toLocaleString('en-US')} نتيجة مطابقة (${
                  searchScope === 'all' ? 'في كل Drive' : 'المجلد الحالي'
                })`
              : `${visibleFiles.length.toLocaleString('en-US')} عنصر في هذا المجلد`}
          </div>
        </div>

        {/* Type Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
          {(
            [
              { id: 'all', label: 'الكل' },
              { id: 'folders', label: 'المجلدات' },
              { id: 'documents', label: 'المستندات' },
              { id: 'pdf', label: 'PDF' },
              { id: 'spreadsheets', label: 'الجداول' },
              { id: 'presentations', label: 'العروض' },
              { id: 'images', label: 'الصور' },
              { id: 'media', label: 'الفيديو والصوت' },
            ] as Array<{ id: TypeFilter; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === tab.id
                  ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contextual Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-5 py-3 dark:border-blue-900/70 dark:bg-blue-950/40">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            تم تحديد {selectedIds.size} عنصر
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setMoveTargetFolderId(rootFolderId);
                setMoveModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
            >
              <FolderInput className="h-3.5 w-3.5" aria-hidden="true" />
              <span>نقل إلى مجلد</span>
            </button>

            {selectedFiles.length === 1 && (
              <button
                type="button"
                onClick={() => {
                  const single = selectedFiles[0];
                  setRenameTarget(single);
                  setRenameValue(single.name);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                <span>إعادة تسمية</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleBulkTrash}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/70 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/50 whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>نقل للسلة</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* High-Density Data Grid */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {visibleFiles.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {searchQuery.trim()
                ? `لم يتم العثور على ملفات أو مجلدات تطابق "${searchQuery.trim()}".`
                : 'هذا المجلد فارغ أو لا توجد ملفات مطابقة للتصفية الحالية.'}
            </p>
            {(searchQuery.trim() || typeFilter !== 'all') && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    مسح البحث
                  </button>
                )}
                {searchQuery.trim() && searchScope === 'current' && (
                  <button
                    type="button"
                    onClick={() => setSearchScope('all')}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-950"
                  >
                    البحث في كل Drive
                  </button>
                )}
                {typeFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setTypeFilter('all')}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    إلغاء تصفية النوع
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        visibleFiles.length > 0 &&
                        visibleFiles.every((f) => selectedIds.has(f.id))
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700 dark:border-slate-600 dark:bg-slate-800"
                      aria-label="تحديد الكل"
                    />
                  </th>
                  <th className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="font-semibold hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      الاسم {sortField === 'name' ? (sortAsc ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-3 py-3">النوع</th>
                  <th className="px-3 py-3 text-left">
                    <button
                      type="button"
                      onClick={() => handleSort('modifiedTime')}
                      className="font-semibold hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      آخر تعديل{' '}
                      {sortField === 'modifiedTime' ? (sortAsc ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left">
                    <button
                      type="button"
                      onClick={() => handleSort('size')}
                      className="font-semibold hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      الحجم {sortField === 'size' ? (sortAsc ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="w-24 px-4 py-3 text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {visibleFiles.map((file) => {
                  const folder = isFolder(file);
                  const previewType = getMediaPreviewType(file);
                  return (
                    <tr
                      key={file.id}
                      className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                        selectedIds.has(file.id) ? 'bg-blue-50/40 dark:bg-blue-950/30' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(file.id)}
                          onChange={() => toggleSelect(file.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700 dark:border-slate-600 dark:bg-slate-800"
                          aria-label={`تحديد ${file.name}`}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <FileTypeIcon file={file} className="h-4 w-4 shrink-0" />
                          <div className="min-w-0">
                            {folder ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchQuery('');
                                  setCurrentFolderId(file.id);
                                  setSelectedIds(new Set());
                                }}
                                className="block max-w-md truncate font-semibold text-slate-900 hover:text-blue-700 hover:underline text-right dark:text-slate-100 dark:hover:text-blue-400"
                                dir="auto"
                              >
                                {renderHighlightedName(file.name, searchQuery)}
                              </button>
                            ) : previewType ? (
                              <button
                                type="button"
                                onClick={() => setPreviewFile(file)}
                                className="block max-w-md truncate font-medium text-slate-900 hover:text-blue-700 hover:underline text-right dark:text-slate-100 dark:hover:text-blue-400"
                                dir="auto"
                              >
                                {renderHighlightedName(file.name, searchQuery)}
                              </button>
                            ) : (
                              <span
                                className="block max-w-md truncate font-medium text-slate-900 dark:text-slate-100"
                                dir="auto"
                              >
                                {renderHighlightedName(file.name, searchQuery)}
                              </span>
                            )}
                            {searchQuery.trim() && searchScope === 'all' && (
                              <div className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                                في: {getParentFolderLabel(file)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {folder ? 'مجلد' : CATEGORY_DEFINITIONS[getFileCategory(file)].labelAr}
                        {!folder && (
                          <>
                            <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                            <span>{getMimeLabelAr(file)}</span>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-left font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {formatDateShort(file.modifiedTime)}
                      </td>
                      <td className="px-3 py-2.5 text-left font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        {folder ? '—' : file.size ? formatBytes(file.size) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-left">
                        <div className="inline-flex items-center justify-end gap-1">
                          {previewType && (
                            <button
                              type="button"
                              onClick={() => setPreviewFile(file)}
                              className="inline-flex rounded p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/60 dark:hover:text-blue-300"
                              aria-label={`معاينة وتكبير ${file.name} بملء الشاشة`}
                              title="معاينة وتكبير بملء الشاشة"
                            >
                              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              aria-label={`فتح ${file.name} في Google Drive`}
                              title="فتح في Google Drive"
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Folder Input Dialog */}
      {newFolderModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/65"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreateFolderSubmit}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                إنشاء مجلد جديد
              </h2>
              <button
                type="button"
                onClick={() => setNewFolderModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">
              اسم المجلد
              <input
                type="text"
                required
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="مثال: العقود والفواتير"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewFolderModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                متابعة
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Input Dialog */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/65"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleRenameSubmit}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                إعادة تسمية العنصر
              </h2>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">
              الاسم الجديد
              <input
                type="text"
                required
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                متابعة
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Move Destination Dialog */}
      {moveModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/65"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleMoveSubmit}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                اختر المجلد الوجهة
              </h2>
              <button
                type="button"
                onClick={() => setMoveModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">
              المجلد المستهدف
              <select
                value={moveTargetFolderId}
                onChange={(e) => setMoveTargetFolderId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
              >
                <option value={rootFolderId}>ملفاتي (المجلد الرئيسي)</option>
                {allFolders
                  .filter((folder) => !selectedIds.has(folder.id))
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                متابعة للنقل
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Fullscreen Zoomable Image & Video Lightbox */}
      <MediaLightboxModal
        file={previewFile}
        mediaList={visibleFiles.filter((f) => getMediaPreviewType(f) !== null)}
        getValidToken={getValidToken}
        onSelectFile={setPreviewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}
