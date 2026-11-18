import { useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Hash, Replace, Sparkles, X } from 'lucide-react';
import type { DriveFile } from '../types/drive';
import { isFolder } from '../lib/organizer';

export interface BatchRenameItem {
  file: DriveFile;
  newName: string;
  canRename: boolean;
  changed: boolean;
}

interface BatchRenameModalProps {
  isOpen: boolean;
  selectedFiles: DriveFile[];
  onClose: () => void;
  onSubmitBatch: (items: BatchRenameItem[]) => void;
}

type PatternMode = 'affix' | 'replace' | 'template';

function canRenameFile(file: DriveFile): boolean {
  if (file.capabilities && typeof file.capabilities.canRename === 'boolean') {
    return file.capabilities.canRename;
  }
  return file.ownedByMe !== false;
}

function splitBaseAndExt(file: DriveFile): { base: string; ext: string } {
  const name = file.name || '';
  if (isFolder(file)) {
    return { base: name, ext: '' };
  }
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === name.length - 1) {
    return { base: name, ext: '' };
  }
  return {
    base: name.slice(0, dotIdx),
    ext: name.slice(dotIdx),
  };
}

function formatIsoDateParts(iso?: string): {
  date: string;
  year: string;
  month: string;
} {
  const d = iso ? new Date(iso) : new Date();
  const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = String(safeDate.getFullYear());
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    year,
    month,
  };
}

function applyTokens(
  pattern: string,
  params: {
    base: string;
    ext: string;
    fileDate: { date: string; year: string; month: string };
    today: { date: string; year: string; month: string };
    seq: string;
  }
): string {
  return pattern
    .replace(/\{date\}/g, params.fileDate.date)
    .replace(/\{year\}/g, params.fileDate.year)
    .replace(/\{month\}/g, params.fileDate.month)
    .replace(/\{today\}/g, params.today.date)
    .replace(/\{seq\}/g, params.seq)
    .replace(/\{name\}/g, params.base)
    .replace(/\{ext\}/g, params.ext.replace(/^\./, ''));
}

const TOKEN_HINTS: Array<{ token: string; label: string }> = [
  { token: '{date}', label: 'تاريخ الملف' },
  { token: '{today}', label: 'تاريخ اليوم' },
  { token: '{year}', label: 'السنة' },
  { token: '{month}', label: 'الشهر' },
  { token: '{seq}', label: 'رقم تسلسلي' },
];

export function BatchRenameModal({
  isOpen,
  selectedFiles,
  onClose,
  onSubmitBatch,
}: BatchRenameModalProps) {
  const [mode, setMode] = useState<PatternMode>('affix');
  const [prefix, setPrefix] = useState('{date}_');
  const [suffix, setSuffix] = useState('');
  const [activeAffixField, setActiveAffixField] = useState<'prefix' | 'suffix'>(
    'prefix'
  );

  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  const [template, setTemplate] = useState('{date}_{name}_{seq}');
  const [preserveExt, setPreserveExt] = useState(true);

  const [seqStart, setSeqStart] = useState(1);
  const [seqPad, setSeqPad] = useState(2);

  const { previewItems, regexError, changedCount } = useMemo(() => {
    const today = formatIsoDateParts();
    let compiledRegex: RegExp | null = null;
    let rxError: string | null = null;

    if (mode === 'replace' && useRegex && findText.length > 0) {
      try {
        compiledRegex = new RegExp(findText, caseSensitive ? 'g' : 'gi');
      } catch (err) {
        rxError =
          err instanceof Error ? err.message : 'تعبير نمطي (Regex) غير صالح';
      }
    }

    const items: BatchRenameItem[] = selectedFiles.map((file, idx) => {
      const renamable = canRenameFile(file);
      const { base, ext } = splitBaseAndExt(file);
      const fileDate = formatIsoDateParts(file.modifiedTime);
      const seqNum = seqStart + idx;
      const seqStr = String(Math.max(0, seqNum)).padStart(
        Math.max(1, seqPad),
        '0'
      );

      let nextBase = base;
      let nextExt = ext;

      if (mode === 'affix') {
        const resolvedPrefix = applyTokens(prefix, {
          base,
          ext,
          fileDate,
          today,
          seq: seqStr,
        });
        const resolvedSuffix = applyTokens(suffix, {
          base,
          ext,
          fileDate,
          today,
          seq: seqStr,
        });
        nextBase = `${resolvedPrefix}${base}${resolvedSuffix}`;
      } else if (mode === 'replace') {
        if (findText.length > 0 && !rxError) {
          if (compiledRegex) {
            nextBase = base.replace(compiledRegex, replaceText);
          } else if (caseSensitive) {
            nextBase = base.split(findText).join(replaceText);
          } else {
            const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            nextBase = base.replace(new RegExp(escaped, 'gi'), replaceText);
          }
        }
      } else {
        const resolved = applyTokens(template, {
          base,
          ext,
          fileDate,
          today,
          seq: seqStr,
        });
        nextBase = resolved;
        nextExt = preserveExt ? ext : '';
      }

      const candidateName = `${nextBase}${nextExt}`.trim();
      const validName = candidateName.length > 0 ? candidateName : file.name;
      const changed = renamable && validName !== file.name;

      return {
        file,
        newName: renamable ? validName : file.name,
        canRename: renamable,
        changed,
      };
    });

    return {
      previewItems: items,
      regexError: rxError,
      changedCount: items.filter((item) => item.changed).length,
    };
  }, [
    selectedFiles,
    mode,
    prefix,
    suffix,
    findText,
    replaceText,
    caseSensitive,
    useRegex,
    template,
    preserveExt,
    seqStart,
    seqPad,
  ]);

  if (!isOpen) return null;

  const insertToken = (token: string) => {
    if (mode === 'affix') {
      if (activeAffixField === 'prefix') {
        setPrefix((prev) => `${prev}${token}`);
      } else {
        setSuffix((prev) => `${prev}${token}`);
      }
    } else if (mode === 'template') {
      setTemplate((prev) => `${prev}${token}`);
    }
  };

  const usesSequence =
    (mode === 'affix' && (prefix.includes('{seq}') || suffix.includes('{seq}'))) ||
    (mode === 'template' && template.includes('{seq}'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (regexError || changedCount === 0) return;
    onSubmitBatch(previewItems.filter((item) => item.changed));
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 dark:bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-rename-title"
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2
              id="batch-rename-title"
              className="font-display text-base font-bold text-slate-900 dark:text-slate-100"
            >
              إعادة التسمية الجماعية بالأنماط
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              تطبيق نمط موحّد على {selectedFiles.length.toLocaleString('en-US')} عنصر محدد مع معاينة فورية قبل الحفظ.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Pattern Mode Selector */}
          <div
            role="group"
            aria-label="نوع نمط التسمية"
            className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => setMode('affix')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mode === 'affix'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>بادئة / لاحقة (تاريخ وترقيم)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('replace')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mode === 'replace'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Replace className="h-3.5 w-3.5" aria-hidden="true" />
              <span>بحث واستبدال</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('template')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mode === 'template'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>قالب مخصص</span>
            </button>
          </div>

          {/* Mode-Specific Controls */}
          {mode === 'affix' && (
            <div className="space-y-4">
              {/* Quick Presets */}
              <div>
                <div className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  أنماط جاهزة سريعة
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      label: 'تاريخ التعديل قبل الاسم',
                      p: '{date}_',
                      s: '',
                    },
                    {
                      label: 'تاريخ اليوم قبل الاسم',
                      p: '{today}_',
                      s: '',
                    },
                    {
                      label: 'السنة والشهر قبل الاسم',
                      p: '{year}-{month}_',
                      s: '',
                    },
                    {
                      label: 'ترقيم تسلسلي قبل الاسم',
                      p: '{seq}_',
                      s: '',
                    },
                    {
                      label: 'تاريخ + ترقيم تسلسلي',
                      p: '{date}_',
                      s: '_{seq}',
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setPrefix(preset.p);
                        setSuffix(preset.s);
                      }}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-400"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  بادئة (تُضاف قبل الاسم)
                  <input
                    type="text"
                    dir="auto"
                    value={prefix}
                    onFocus={() => setActiveAffixField('prefix')}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="مثال: {date}_"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  />
                </label>

                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  لاحقة (تُضاف قبل الامتداد)
                  <input
                    type="text"
                    dir="auto"
                    value={suffix}
                    onFocus={() => setActiveAffixField('suffix')}
                    onChange={(e) => setSuffix(e.target.value)}
                    placeholder="مثال: _{seq} أو _final"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  />
                </label>
              </div>
            </div>
          )}

          {mode === 'replace' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  النص المطلوب استبداله
                  <input
                    type="text"
                    dir="auto"
                    value={findText}
                    onChange={(e) => setFindText(e.target.value)}
                    placeholder="مثال: IMG_ أو (1)"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  الاستبدال بـ
                  <input
                    type="text"
                    dir="auto"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="اتركه فارغاً للحذف"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-5 text-xs text-slate-700 dark:text-slate-300">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={caseSensitive}
                    onChange={(e) => setCaseSensitive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <span>تطابق حالة الأحرف (Case sensitive)</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useRegex}
                    onChange={(e) => setUseRegex(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <span>استخدام تعبير نمطي (Regex)</span>
                </label>
              </div>

              {regexError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
                >
                  {regexError}
                </div>
              )}
            </div>
          )}

          {mode === 'template' && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                صيغة القالب الجديد
                <input
                  type="text"
                  dir="auto"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder="{date}_{name}_{seq}"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                />
              </label>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={preserveExt}
                  onChange={(e) => setPreserveExt(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700 dark:border-slate-600 dark:bg-slate-800"
                />
                <span>الاحتفاظ بامتداد الملف الأصلي تلقائياً (مثل .pdf و .jpg)</span>
              </label>
            </div>
          )}

          {/* Insertable Dynamic Tokens + Sequence Options */}
          {(mode === 'affix' || mode === 'template') && (
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  إدراج متغير ديناميكي:
                </span>
                {TOKEN_HINTS.map((item) => (
                  <button
                    key={item.token}
                    type="button"
                    onClick={() => insertToken(item.token)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:text-blue-400"
                  >
                    <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                      {item.token}
                    </span>
                    <span>{item.label}</span>
                  </button>
                ))}
                {mode === 'template' && (
                  <button
                    type="button"
                    onClick={() => insertToken('{name}')}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:text-blue-400"
                  >
                    <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                      {'{name}'}
                    </span>
                    <span>الاسم الأصلي</span>
                  </button>
                )}
              </div>

              {usesSequence && (
                <div className="flex flex-wrap items-center gap-4 border-t border-slate-200/80 pt-2.5 text-xs dark:border-slate-800">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Hash className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>إعدادات الترقيم {'{seq}'}:</span>
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span>يبدأ من</span>
                    <input
                      type="number"
                      min={0}
                      max={99999}
                      value={seqStart}
                      onChange={(e) =>
                        setSeqStart(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-16 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 tabular-nums"
                    />
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span>عدد الخانات</span>
                    <select
                      value={seqPad}
                      onChange={(e) => setSeqPad(Number(e.target.value))}
                      className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value={1}>1 (1, 2)</option>
                      <option value={2}>2 (01, 02)</option>
                      <option value={3}>3 (001, 002)</option>
                      <option value={4}>4 (0001, 0002)</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Live Preview Table */}
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                معاينة الأسماء الجديدة
              </span>
              <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                سيتم تعديل {changedCount} من أصل {selectedFiles.length} عنصر
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">الاسم الحالي</th>
                    <th className="w-6 px-1 py-2"></th>
                    <th className="px-3 py-2 font-medium">الاسم الجديد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {previewItems.map((item) => (
                    <tr
                      key={item.file.id}
                      className={
                        item.changed
                          ? 'bg-blue-50/30 dark:bg-blue-950/20'
                          : 'opacity-70'
                      }
                    >
                      <td
                        className="max-w-[220px] truncate px-3 py-2 text-slate-600 dark:text-slate-400"
                        dir="auto"
                      >
                        {item.file.name}
                      </td>
                      <td className="px-1 py-2 text-center text-slate-400 dark:text-slate-500">
                        <ArrowLeft className="inline h-3.5 w-3.5" aria-hidden="true" />
                      </td>
                      <td
                        className={`max-w-[240px] truncate px-3 py-2 font-medium ${
                          !item.canRename
                            ? 'text-red-600 dark:text-red-400'
                            : item.changed
                              ? 'text-blue-700 dark:text-blue-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                        dir="auto"
                      >
                        {item.canRename
                          ? item.newName
                          : `${item.file.name} (للقراءة فقط)`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={Boolean(regexError) || changedCount === 0}
            className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            متابعة ({changedCount} عنصر)
          </button>
        </div>
      </form>
    </div>
  );
}
