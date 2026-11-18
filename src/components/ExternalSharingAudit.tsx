import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  ScanSearch,
  ShieldAlert,
  UserX,
} from 'lucide-react';
import type {
  ConfirmationRequest,
  DriveFile,
  DrivePermission,
} from '../types/drive';
import { deleteDrivePermission, fetchFilePermissions } from '../lib/driveApi';
import { formatDateShort, isFolder } from '../lib/organizer';
import { FileTypeIcon } from './FileTypeIcon';

interface ExternalSharingAuditProps {
  files: DriveFile[];
  userEmail: string;
  getValidToken: () => Promise<string>;
  requestConfirmation: (req: ConfirmationRequest) => void;
  onSyncComplete: () => Promise<void>;
  onError: (msg: string) => void;
}

type RiskLevel = 'critical' | 'high' | 'medium';

interface AuditedFileResult {
  file: DriveFile;
  score: number;
  riskLevel: RiskLevel;
  riskLabelAr: string;
  hasPublicLink: boolean;
  hasSensitiveName: boolean;
  externalPermissions: DrivePermission[];
  summaryText: string;
}

const SENSITIVE_NAME_KEYWORDS = [
  'secret',
  'credential',
  'password',
  'pass',
  'token',
  'api-key',
  'apikey',
  'backup-codes',
  '.env',
  '.pem',
  '.key',
  '.crt',
  'finance',
  'salary',
  'invoice',
  'contract',
  'passport',
  'اوراق',
  'مهمه',
  'سري',
  'عقد',
  'فاتورة',
  'راتب',
  'poc',
  'evidence',
  'report',
];

const CONSUMER_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
]);

function roleLabelAr(role: DrivePermission['role']): string {
  switch (role) {
    case 'owner':
      return 'مالك';
    case 'organizer':
    case 'fileOrganizer':
      return 'منظم';
    case 'writer':
      return 'محرر';
    case 'commenter':
      return 'معلق';
    default:
      return 'عارض';
  }
}

function isExternalPermission(
  perm: DrivePermission,
  userEmailLower: string,
  userDomain: string
): boolean {
  if (perm.deleted) return false;
  if (perm.role === 'owner') return false;
  if (perm.type === 'anyone') return true;

  const permDomain = (perm.domain || '').trim().toLowerCase();
  const permEmail = (perm.emailAddress || '').trim().toLowerCase();

  if (perm.type === 'domain') {
    if (!userDomain || CONSUMER_DOMAINS.has(userDomain)) return true;
    return permDomain !== userDomain;
  }

  if (permEmail) {
    if (userEmailLower && permEmail === userEmailLower) return false;
    if (
      userDomain &&
      !CONSUMER_DOMAINS.has(userDomain) &&
      permEmail.endsWith(`@${userDomain}`)
    ) {
      return false;
    }
    return true;
  }

  return perm.type === 'user' || perm.type === 'group';
}

function formatPermissionTarget(perm: DrivePermission): string {
  if (perm.type === 'anyone') {
    return `أي شخص لديه الرابط (${roleLabelAr(perm.role)})`;
  }
  if (perm.type === 'domain') {
    return `نطاق ${perm.domain || 'خارجي'} (${roleLabelAr(perm.role)})`;
  }
  const identity = perm.emailAddress || perm.displayName || 'مستخدم خارجي';
  return `${identity} (${roleLabelAr(perm.role)})`;
}

export function ExternalSharingAudit({
  files,
  userEmail,
  getValidToken,
  requestConfirmation,
  onSyncComplete,
  onError,
}: ExternalSharingAuditProps) {
  const [extraPermissionsMap, setExtraPermissionsMap] = useState<
    Record<string, DrivePermission[]>
  >({});
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [hasCompletedLiveScan, setHasCompletedLiveScan] = useState(false);

  const userEmailLower = userEmail.trim().toLowerCase();
  const userDomain = userEmailLower.split('@')[1] ?? '';

  const {
    sharedCandidatesCount,
    externalSharedCount,
    publicLinkCount,
    topSensitiveFiles,
    missingPermissionsCount,
  } = useMemo(() => {
    const sharedOwnedOrShared = files.filter(
      (f) => f.shared || (f.permissions && f.permissions.length > 0)
    );

    let missingCount = 0;
    let publicLinks = 0;
    const audited: AuditedFileResult[] = [];

    for (const file of sharedOwnedOrShared) {
      const perms = extraPermissionsMap[file.id] ?? file.permissions;
      if (!perms) {
        if (file.ownedByMe !== false) missingCount += 1;
        continue;
      }

      const externalPerms = perms.filter((p) =>
        isExternalPermission(p, userEmailLower, userDomain)
      );
      if (externalPerms.length === 0) continue;

      let score = 0;
      let hasAnyone = false;
      let hasAnyoneWrite = false;
      let hasExternalWrite = false;

      for (const perm of externalPerms) {
        const isWrite =
          perm.role === 'writer' ||
          perm.role === 'organizer' ||
          perm.role === 'fileOrganizer';
        const isComment = perm.role === 'commenter';

        if (perm.type === 'anyone') {
          hasAnyone = true;
          if (isWrite) {
            hasAnyoneWrite = true;
            score += 120;
          } else if (isComment) {
            score += 90;
          } else {
            score += 75;
          }
        } else if (perm.type === 'domain') {
          score += isWrite ? 65 : isComment ? 45 : 35;
          if (isWrite) hasExternalWrite = true;
        } else {
          if (isWrite) {
            hasExternalWrite = true;
            score += 45;
          } else if (isComment) {
            score += 22;
          } else {
            score += 12;
          }
        }
      }

      if (hasAnyone) publicLinks += 1;

      const lowerName = (file.name || '').toLowerCase();
      const hasSensitiveName = SENSITIVE_NAME_KEYWORDS.some((kw) =>
        lowerName.includes(kw)
      );
      if (hasSensitiveName) {
        score += 20;
      }

      if (!isFolder(file)) {
        score += 2;
      }

      let riskLevel: RiskLevel = 'medium';
      let riskLabelAr = 'متوسط (عرض خارجي)';
      if (hasAnyoneWrite || (hasAnyone && hasSensitiveName)) {
        riskLevel = 'critical';
        riskLabelAr = hasAnyoneWrite
          ? 'حرج · رابط عام للتعديل'
          : 'حرج · ملف حساس برابط عام';
      } else if (hasAnyone) {
        riskLevel = 'high';
        riskLabelAr = 'مرتفع · رابط عام للقراءة';
      } else if (hasExternalWrite) {
        riskLevel = 'high';
        riskLabelAr = 'مرتفع · محرر خارجي';
      }

      const sortedPerms = [...externalPerms].sort((a, b) => {
        if (a.type === 'anyone' && b.type !== 'anyone') return -1;
        if (b.type === 'anyone' && a.type !== 'anyone') return 1;
        return 0;
      });

      const firstTargets = sortedPerms
        .slice(0, 2)
        .map(formatPermissionTarget)
        .join(' · ');
      const extraCount = sortedPerms.length - 2;
      const summaryText =
        extraCount > 0 ? `${firstTargets} (+${extraCount} آخرين)` : firstTargets;

      audited.push({
        file,
        score,
        riskLevel,
        riskLabelAr,
        hasPublicLink: hasAnyone,
        hasSensitiveName,
        externalPermissions: sortedPerms,
        summaryText,
      });
    }

    audited.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.externalPermissions.length !== a.externalPermissions.length) {
        return b.externalPermissions.length - a.externalPermissions.length;
      }
      return (
        new Date(b.file.modifiedTime || 0).getTime() -
        new Date(a.file.modifiedTime || 0).getTime()
      );
    });

    return {
      sharedCandidatesCount: sharedOwnedOrShared.length,
      externalSharedCount: audited.length,
      publicLinkCount: publicLinks,
      topSensitiveFiles: audited.slice(0, 5),
      missingPermissionsCount: missingCount,
    };
  }, [files, extraPermissionsMap, userEmailLower, userDomain]);

  const handleQuickScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress(null);

    try {
      const token = await getValidToken();
      const targets = files
        .filter((f) => f.shared && f.ownedByMe !== false)
        .slice(0, 60);

      if (targets.length === 0) {
        setHasCompletedLiveScan(true);
        return;
      }

      setScanProgress({ done: 0, total: targets.length });
      const updates: Record<string, DrivePermission[]> = {};
      const chunkSize = 5;

      for (let i = 0; i < targets.length; i += chunkSize) {
        const chunk = targets.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (target) => {
            try {
              const perms = await fetchFilePermissions(token, target.id);
              updates[target.id] = perms;
            } catch {
              // Keep existing inline permissions if individual fetch fails
            }
          })
        );
        setScanProgress({
          done: Math.min(targets.length, i + chunk.length),
          total: targets.length,
        });
      }

      setExtraPermissionsMap((prev) => ({ ...prev, ...updates }));
      setHasCompletedLiveScan(true);
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : 'تعذر إجراء المسح السريع لصلاحيات المشاركة.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleRevokeExternalAccess = (item: AuditedFileResult) => {
    if (item.file.ownedByMe === false || item.externalPermissions.length === 0) {
      return;
    }

    requestConfirmation({
      title: 'تأكيد سحب صلاحيات المشاركة الخارجية',
      description: `سيتم إزالة ${item.externalPermissions.length} صلاحية خارجية/عامة من "${item.file.name}" مع الإبقاء على وصولك كمالك.`,
      confirmLabel: 'سحب الصلاحيات الخارجية',
      variant: 'danger',
      itemsPreview: item.externalPermissions.map(formatPermissionTarget),
      totalCount: item.externalPermissions.length,
      onConfirm: async () => {
        try {
          const token = await getValidToken();
          for (const perm of item.externalPermissions) {
            await deleteDrivePermission(token, item.file.id, perm.id);
          }
          setExtraPermissionsMap((prev) => {
            const next = { ...prev };
            delete next[item.file.id];
            return next;
          });
          await onSyncComplete();
        } catch (err) {
          onError(
            err instanceof Error
              ? err.message
              : `تعذر سحب الصلاحيات من "${item.file.name}".`
          );
        }
      },
    });
  };

  return (
    <section
      aria-labelledby="external-sharing-audit-heading"
      className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Header Row */}
      <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert
              className="h-4.5 w-4.5 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <h2
              id="external-sharing-audit-heading"
              className="font-display text-base font-bold text-slate-900 dark:text-slate-100"
            >
              أكثر 5 ملفات حساسة مشتركة خارجياً
            </h2>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span>
              ملفات مشتركة مفحوصة: {sharedCandidatesCount.toLocaleString('en-US')}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              مشتركة خارجياً: {externalSharedCount.toLocaleString('en-US')}
            </span>
            <span aria-hidden="true">·</span>
            <span>روابط عامة: {publicLinkCount.toLocaleString('en-US')}</span>
            {missingPermissionsCount > 0 && !hasCompletedLiveScan && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-700 dark:text-amber-400">
                  {missingPermissionsCount} ملف يحتاج فحصاً مباشراً للصلاحيات
                </span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleQuickScan()}
          disabled={isScanning}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
        >
          <ScanSearch className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
          <span>
            {isScanning && scanProgress
              ? `جارٍ المسح (${scanProgress.done}/${scanProgress.total})...`
              : 'مسح سريع للصلاحيات'}
          </span>
        </button>
      </div>

      {/* Results List */}
      {topSensitiveFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <CheckCircle2
            className="h-7 w-7 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
            {sharedCandidatesCount === 0
              ? 'لا توجد ملفات مشتركة في حسابك حالياً.'
              : 'لم يتم رصد ملفات مشتركة مع أشخاص خارجيين أو بروابط عامة.'}
          </p>
          {missingPermissionsCount > 0 && !hasCompletedLiveScan && (
            <button
              type="button"
              onClick={() => void handleQuickScan()}
              className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              إجراء فحص مباشر للملفات المشتركة ({missingPermissionsCount})
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {topSensitiveFiles.map((item, idx) => {
            const riskTextClass =
              item.riskLevel === 'critical'
                ? 'text-red-700 dark:text-red-400'
                : item.riskLevel === 'high'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-slate-700 dark:text-slate-300';

            return (
              <div
                key={item.file.id}
                className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 font-mono text-xs font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                    0{idx + 1}
                  </span>
                  <FileTypeIcon file={item.file} className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="max-w-md truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
                        dir="auto"
                      >
                        {item.file.name}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className={`text-xs font-semibold ${riskTextClass}`}>
                        {item.riskLabelAr}
                      </span>
                      {item.hasSensitiveName && (
                        <>
                          <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs font-medium text-red-600 dark:text-red-400">
                            اسم ملف حساس
                          </span>
                        </>
                      )}
                    </div>

                    <div
                      className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400 tabular-nums"
                      dir="auto"
                    >
                      <span>{item.summaryText}</span>
                      {item.file.modifiedTime && (
                        <>
                          <span className="mx-1.5 text-slate-300 dark:text-slate-600" aria-hidden="true">
                            ·
                          </span>
                          <span>آخر تعديل {formatDateShort(item.file.modifiedTime)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {item.file.ownedByMe !== false && (
                    <button
                      type="button"
                      onClick={() => handleRevokeExternalAccess(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/70 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/50 whitespace-nowrap shrink-0"
                    >
                      <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>سحب الوصول الخارجي</span>
                    </button>
                  )}
                  {item.file.webViewLink && (
                    <a
                      href={item.file.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>فتح</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
