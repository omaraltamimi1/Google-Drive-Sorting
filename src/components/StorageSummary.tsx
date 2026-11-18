import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DriveFile, DriveQuota, FileCategoryId } from '../types/drive';
import {
  CATEGORY_DEFINITIONS,
  formatBytes,
  getFileCategory,
  isFolder,
} from '../lib/organizer';

type ChartMetricMode = 'bytes' | 'count';

interface StorageSummaryProps {
  files: DriveFile[];
  quota: DriveQuota;
  isDark: boolean;
}

interface ChartCategoryDatum {
  id: FileCategoryId;
  name: string;
  fullName: string;
  bytes: number;
  count: number;
  bytesPercent: number;
  countPercent: number;
  color: string;
}

const SHORT_CATEGORY_LABELS: Record<FileCategoryId, string> = {
  documents: 'المستندات',
  pdf: 'ملفات PDF',
  spreadsheets: 'الجداول',
  presentations: 'العروض',
  images: 'الصور',
  media: 'الفيديو والصوت',
  archives: 'المضغوطة',
  code: 'البرمجة',
  forms: 'النماذج',
  other: 'أخرى',
};

const CATEGORY_COLORS_LIGHT: Record<FileCategoryId, string> = {
  media: '#2563eb',
  images: '#0891b2',
  archives: '#d97706',
  documents: '#4f46e5',
  pdf: '#dc2626',
  code: '#0d9488',
  spreadsheets: '#16a34a',
  presentations: '#ea580c',
  forms: '#7c3aed',
  other: '#64748b',
};

const CATEGORY_COLORS_DARK: Record<FileCategoryId, string> = {
  media: '#3b82f6',
  images: '#22d3ee',
  archives: '#fbbf24',
  documents: '#818cf8',
  pdf: '#f87171',
  code: '#2dd4bf',
  spreadsheets: '#4ade80',
  presentations: '#fb923c',
  forms: '#a78bfa',
  other: '#94a3b8',
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartCategoryDatum }>;
  metricMode: ChartMetricMode;
}

function StorageChartTooltip({ active, payload, metricMode }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  const pct =
    metricMode === 'bytes' ? datum.bytesPercent : datum.countPercent;

  return (
    <div
      dir="rtl"
      className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-right shadow-md dark:border-slate-700 dark:bg-slate-950"
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-xs"
          style={{ backgroundColor: datum.color }}
          aria-hidden="true"
        />
        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
          {datum.fullName}
        </span>
      </div>
      <div className="mt-1.5 space-y-0.5 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span>المساحة:</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
            {datum.bytes > 0 ? formatBytes(datum.bytes) : '0 B'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>عدد الملفات:</span>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
            {datum.count.toLocaleString('en-US')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>النسبة:</span>
          <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function StorageSummary({ files, quota, isDark }: StorageSummaryProps) {
  const [metricMode, setMetricMode] = useState<ChartMetricMode>('bytes');
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<FileCategoryId | null>(null);

  const {
    chartData,
    totalMeasuredBytes,
    totalFileCount,
    quotaLimitBytes,
    quotaUsedBytes,
    quotaTrashBytes,
  } = useMemo(() => {
    const nonFolders = files.filter((f) => !isFolder(f));
    const stats = new Map<FileCategoryId, { bytes: number; count: number }>();

    for (const id of Object.keys(CATEGORY_DEFINITIONS) as FileCategoryId[]) {
      stats.set(id, { bytes: 0, count: 0 });
    }

    let measuredBytes = 0;
    for (const file of nonFolders) {
      const catId = getFileCategory(file);
      const size = Number(file.size || 0);
      measuredBytes += Number.isFinite(size) ? size : 0;
      const entry = stats.get(catId)!;
      entry.bytes += Number.isFinite(size) ? size : 0;
      entry.count += 1;
    }

    const palette = isDark ? CATEGORY_COLORS_DARK : CATEGORY_COLORS_LIGHT;
    const totalCount = nonFolders.length;

    const items: ChartCategoryDatum[] = (
      Object.keys(CATEGORY_DEFINITIONS) as FileCategoryId[]
    )
      .map((id) => {
        const entry = stats.get(id)!;
        return {
          id,
          name: SHORT_CATEGORY_LABELS[id],
          fullName: CATEGORY_DEFINITIONS[id].labelAr,
          bytes: entry.bytes,
          count: entry.count,
          bytesPercent: measuredBytes > 0 ? (entry.bytes / measuredBytes) * 100 : 0,
          countPercent: totalCount > 0 ? (entry.count / totalCount) * 100 : 0,
          color: palette[id],
        };
      })
      .filter((item) => item.count > 0 || item.bytes > 0);

    return {
      chartData: items,
      totalMeasuredBytes: measuredBytes,
      totalFileCount: totalCount,
      quotaLimitBytes: Number(quota.limit || 0),
      quotaUsedBytes: Number(quota.usage || 0),
      quotaTrashBytes: Number(quota.usageInDriveTrash || 0),
    };
  }, [files, quota, isDark]);

  const activeData = useMemo(() => {
    const filtered =
      metricMode === 'bytes'
        ? chartData.filter((d) => d.bytes > 0)
        : chartData.filter((d) => d.count > 0);
    return [...filtered].sort((a, b) =>
      metricMode === 'bytes' ? b.bytes - a.bytes : b.count - a.count
    );
  }, [chartData, metricMode]);

  const selectedItem = useMemo(
    () => activeData.find((d) => d.id === selectedCategoryId) ?? null,
    [activeData, selectedCategoryId]
  );

  const axisTickColor = isDark ? '#94a3b8' : '#475569';
  const gridStrokeColor = isDark ? '#1e293b' : '#e2e8f0';
  const pieStrokeColor = isDark ? '#0f172a' : '#ffffff';

  const remainingBytes =
    quotaLimitBytes > 0 ? Math.max(0, quotaLimitBytes - quotaUsedBytes) : 0;

  return (
    <section
      aria-labelledby="storage-summary-heading"
      className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Header Row */}
      <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="storage-summary-heading"
            className="font-display text-base font-bold text-slate-900 dark:text-slate-100"
          >
            ملخص التخزين
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span>حجم الملفات المقاس: {formatBytes(totalMeasuredBytes)}</span>
            {quotaTrashBytes > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>المهملات: {formatBytes(quotaTrashBytes)}</span>
              </>
            )}
            {quotaLimitBytes > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>المساحة المتاحة: {formatBytes(remainingBytes)}</span>
              </>
            )}
          </div>
        </div>

        {/* Interactive Metric Segmented Switch */}
        <div
          role="group"
          aria-label="معيار الرسم البياني"
          className="inline-flex items-center gap-1 self-start rounded-lg bg-slate-100 p-1 dark:bg-slate-800 sm:self-auto"
        >
          <button
            type="button"
            onClick={() => {
              setMetricMode('bytes');
              setSelectedCategoryId(null);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              metricMode === 'bytes'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            حسب المساحة
          </button>
          <button
            type="button"
            onClick={() => {
              setMetricMode('count');
              setSelectedCategoryId(null);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              metricMode === 'count'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            حسب عدد الملفات
          </button>
        </div>
      </div>

      {/* Empty States */}
      {totalFileCount === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
          لا توجد ملفات في Google Drive لعرض ملخص التخزين بعد.
        </div>
      ) : activeData.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            لا تستهلك ملفاتك الحالية مساحة تخزين مقاسة بالبايت (مثل مستندات وجداول Google السحابية).
          </p>
          <button
            type="button"
            onClick={() => setMetricMode('count')}
            className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            عرض التوزيع حسب عدد الملفات
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 divide-y divide-slate-200 dark:divide-slate-800 lg:grid-cols-12 lg:divide-x lg:divide-x-reverse lg:divide-y-0">
          {/* Chart 1: Donut Distribution & Interactive Category Breakdown */}
          <div className="p-6 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                نسبة التوزيع بين الأنواع
              </h3>
              {selectedItem && (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(null)}
                  className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                >
                  عرض الكل
                </button>
              )}
            </div>

            <div className="relative mt-3 h-56 w-full min-w-0" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeData}
                    dataKey={metricMode === 'bytes' ? 'bytes' : 'count'}
                    nameKey="fullName"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={86}
                    paddingAngle={2}
                    stroke={pieStrokeColor}
                    strokeWidth={2}
                  >
                    {activeData.map((entry) => {
                      const dimmed =
                        selectedCategoryId !== null &&
                        selectedCategoryId !== entry.id;
                      return (
                        <Cell
                          key={entry.id}
                          fill={entry.color}
                          fillOpacity={dimmed ? 0.25 : 1}
                          className="cursor-pointer transition-opacity"
                          onClick={() =>
                            setSelectedCategoryId((prev) =>
                              prev === entry.id ? null : entry.id
                            )
                          }
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    content={(props) => (
                      <StorageChartTooltip
                        active={props.active}
                        payload={
                          props.payload as ReadonlyArray<{
                            payload?: ChartCategoryDatum;
                          }>
                        }
                        metricMode={metricMode}
                      />
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Metric Summary inside Donut */}
              <div
                dir="rtl"
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center"
              >
                <span className="max-w-[100px] truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {selectedItem
                    ? selectedItem.name
                    : metricMode === 'bytes'
                      ? 'إجمالي المقاس'
                      : 'إجمالي الملفات'}
                </span>
                <span className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {selectedItem
                    ? metricMode === 'bytes'
                      ? formatBytes(selectedItem.bytes)
                      : selectedItem.count.toLocaleString('en-US')
                    : metricMode === 'bytes'
                      ? formatBytes(totalMeasuredBytes)
                      : totalFileCount.toLocaleString('en-US')}
                </span>
              </div>
            </div>

            {/* Clean Interactive Legend List */}
            <div className="mt-4 space-y-1.5">
              {activeData.map((item) => {
                const isSelected = selectedCategoryId === item.id;
                const pct =
                  metricMode === 'bytes'
                    ? item.bytesPercent
                    : item.countPercent;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategoryId((prev) =>
                        prev === item.id ? null : item.id
                      )
                    }
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-right text-xs transition-colors ${
                      isSelected
                        ? 'bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.fullName}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 font-mono tabular-nums">
                      <span className="text-slate-500 dark:text-slate-400">
                        {pct.toFixed(1)}%
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {metricMode === 'bytes'
                          ? formatBytes(item.bytes)
                          : `${item.count.toLocaleString('en-US')} ملف`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chart 2: Horizontal Bar Comparison */}
          <div className="flex flex-col p-6 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {metricMode === 'bytes'
                  ? 'مقارنة استهلاك المساحة حسب نوع الملف'
                  : 'مقارنة عدد الملفات حسب النوع'}
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {activeData.length} تصنيفات
              </span>
            </div>

            <div
              className="mt-4 w-full min-w-0 flex-1"
              style={{ height: Math.max(260, activeData.length * 40 + 44) }}
              dir="ltr"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activeData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke={gridStrokeColor}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: axisTickColor, fontSize: 11 }}
                    axisLine={{ stroke: gridStrokeColor }}
                    tickLine={false}
                    tickFormatter={(val: number) =>
                      metricMode === 'bytes'
                        ? formatBytes(val)
                        : val.toLocaleString('en-US')
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={96}
                    tick={{ fill: axisTickColor, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{
                      fill: isDark
                        ? 'rgba(148, 163, 184, 0.08)'
                        : 'rgba(15, 23, 42, 0.04)',
                    }}
                    content={(props) => (
                      <StorageChartTooltip
                        active={props.active}
                        payload={
                          props.payload as ReadonlyArray<{
                            payload?: ChartCategoryDatum;
                          }>
                        }
                        metricMode={metricMode}
                      />
                    )}
                  />
                  <Bar
                    dataKey={metricMode === 'bytes' ? 'bytes' : 'count'}
                    radius={[0, 6, 6, 0]}
                    barSize={22}
                  >
                    {activeData.map((entry) => {
                      const dimmed =
                        selectedCategoryId !== null &&
                        selectedCategoryId !== entry.id;
                      return (
                        <Cell
                          key={entry.id}
                          fill={entry.color}
                          fillOpacity={dimmed ? 0.25 : 1}
                          className="cursor-pointer transition-opacity"
                          onClick={() =>
                            setSelectedCategoryId((prev) =>
                              prev === entry.id ? null : entry.id
                            )
                          }
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
