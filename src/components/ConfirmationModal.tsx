import { useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { ConfirmationRequest } from '../types/drive';

interface ConfirmationModalProps {
  request: ConfirmationRequest | null;
  onClose: () => void;
}

export function ConfirmationModal({ request, onClose }: ConfirmationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!request) return null;

  const isDanger = request.variant === 'danger';
  const maxPreview = 8;
  const visibleItems = request.itemsPreview.slice(0, maxPreview);
  const remainingCount = Math.max(0, request.totalCount - visibleItems.length);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await request.onConfirm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px] dark:bg-black/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {isDanger ? (
              <AlertTriangle
                className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-blue-700 dark:text-blue-400"
                aria-hidden="true"
              />
            )}
            <h2
              id="confirm-modal-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              {request.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {request.description}
          </p>

          {visibleItems.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>العناصر المتأثرة</span>
                <span className="font-mono tabular-nums">{request.totalCount} عنصر</span>
              </div>
              <ul className="max-h-44 space-y-1.5 overflow-y-auto text-xs text-slate-700 dark:text-slate-300">
                {visibleItems.map((item, idx) => (
                  <li
                    key={`${item}-${idx}`}
                    className="truncate border-b border-slate-200/70 pb-1 last:border-none last:pb-0 dark:border-slate-800"
                    dir="auto"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              {remainingCount > 0 && (
                <p className="mt-2 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  و {remainingCount} عنصر آخر...
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-slate-200 bg-slate-50/60 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-950/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 whitespace-nowrap shrink-0 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600'
                : 'bg-blue-700 hover:bg-blue-800 focus-visible:outline-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500'
            }`}
          >
            {isSubmitting ? 'جارٍ التنفيذ...' : request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
