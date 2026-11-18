import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CopyCheck,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
} from 'lucide-react';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './lib/firebaseAuth';
import {
  DriveAuthExpiredError,
  fetchDriveAccountAndFiles,
} from './lib/driveApi';
import { buildFolderPathMap } from './lib/organizer';
import type {
  ConfirmationRequest,
  DriveFile,
  DriveQuota,
  DriveUser,
} from './types/drive';
import { SignInScreen } from './components/SignInScreen';
import { OverviewView } from './components/OverviewView';
import { SmartOrganizeView } from './components/SmartOrganizeView';
import { FileExplorerView } from './components/FileExplorerView';
import { CleanupView } from './components/CleanupView';
import { ConfirmationModal } from './components/ConfirmationModal';

type AppTab = 'overview' | 'organize' | 'explorer' | 'cleanup';

const THEME_STORAGE_KEY = 'drive-organizer-theme';

const NAV_ITEMS: Array<{ id: AppTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
  { id: 'organize', label: 'خطة الترتيب الذكية', icon: Sparkles },
  { id: 'explorer', label: 'مستعرض الملفات', icon: FolderTree },
  { id: 'cleanup', label: 'التكرارات والتنظيف', icon: CopyCheck },
];

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage failures
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  const [needsAuth, setNeedsAuth] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AppTab>('organize');
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [loadedProgressCount, setLoadedProgressCount] = useState(0);
  const [driveError, setDriveError] = useState<string | null>(null);

  const [driveUser, setDriveUser] = useState<DriveUser>({});
  const [quota, setQuota] = useState<DriveQuota>({});
  const [rootFolderId, setRootFolderId] = useState<string>('root');
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [trashedFiles, setTrashedFiles] = useState<DriveFile[]>([]);

  const [confirmationRequest, setConfirmationRequest] =
    useState<ConfirmationRequest | null>(null);

  const loadDriveData = useCallback(async (explicitToken?: string) => {
    const token = explicitToken ?? (await getAccessToken());
    if (!token) {
      setNeedsAuth(true);
      return;
    }

    setIsLoadingDrive(true);
    setDriveError(null);
    setLoadedProgressCount(0);

    try {
      const data = await fetchDriveAccountAndFiles(token, (count) => {
        setLoadedProgressCount(count);
      });
      setDriveUser(data.user);
      setQuota(data.quota);
      setRootFolderId(data.rootFolderId);
      setFiles(data.files);
      setTrashedFiles(data.trashedFiles);
    } catch (err) {
      if (err instanceof DriveAuthExpiredError) {
        setNeedsAuth(true);
        setAuthError(err.message);
      } else {
        setDriveError(
          err instanceof Error ? err.message : 'تعذر تحميل ملفات Google Drive.'
        );
      }
    } finally {
      setIsLoadingDrive(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setAuthUser(user);
        setNeedsAuth(false);
        void loadDriveData(token);
      },
      () => {
        setAuthUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, [loadDriveData]);

  const handleLogin = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      setAuthUser(result.user);
      setNeedsAuth(false);
      await loadDriveData(result.accessToken);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'فشل تسجيل الدخول عبر Google. يرجى المحاولة مجدداً.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setFiles([]);
    setTrashedFiles([]);
    setDriveUser({});
    setQuota({});
    setNeedsAuth(true);
  };

  const getValidToken = useCallback(async (): Promise<string> => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      throw new DriveAuthExpiredError();
    }
    return token;
  }, []);

  const folderPathMap = useMemo(
    () => buildFolderPathMap(files, rootFolderId),
    [files, rootFolderId]
  );

  if (needsAuth) {
    return (
      <SignInScreen
        onSignIn={handleLogin}
        isSigningIn={isSigningIn}
        error={authError}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />
    );
  }

  const displayName =
    driveUser.displayName || authUser?.displayName || 'مستخدم Google Drive';
  const displayEmail =
    driveUser.emailAddress || authUser?.email || '';
  const avatarUrl = driveUser.photoLink || authUser?.photoURL || '';
  const activeNavLabel =
    NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? '';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col lg:flex-row transition-colors">
      {/* Sidebar Navigation (260px on Desktop) */}
      <aside className="w-full shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex lg:w-64 lg:flex-col lg:border-b-0 lg:border-l">
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6 dark:border-slate-800">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
            مُنظِّم درايف
          </span>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 lg:hidden whitespace-nowrap shrink-0"
          >
            {isDark ? (
              <Sun className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
            )}
            <span>{isDark ? 'النهاري' : 'الليلي'}</span>
          </button>
        </div>

        <nav
          className="flex flex-row gap-1 overflow-x-auto p-3 lg:flex-col lg:p-4"
          aria-label="التنقل الرئيسي"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/60 dark:text-blue-400'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive
                      ? 'text-blue-700 dark:text-blue-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Theme Switch + Account Summary Footer inside Sidebar */}
        <div className="hidden border-t border-slate-200 p-4 dark:border-slate-800 lg:mt-auto lg:block lg:space-y-3">
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            onClick={toggleTheme}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2">
              {isDark ? (
                <Moon className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
              ) : (
                <Sun className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
              )}
              <span>الوضع الليلي</span>
            </span>
            <span
              aria-hidden="true"
              className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                isDark ? 'bg-blue-600 justify-start' : 'bg-slate-300 justify-end'
              }`}
            >
              <span className="h-4 w-4 rounded-full bg-white shadow-xs transition-transform" />
            </span>
          </button>

          <div className="flex items-center gap-3 pt-1">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-full border border-slate-200 object-cover dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200 shrink-0">
                {displayName.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                {displayName}
              </div>
              {displayEmail && (
                <div className="truncate text-[11px] text-slate-500 dark:text-slate-400" dir="ltr">
                  {displayEmail}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar Contract: Breadcrumb on right (RTL start), single primary refresh action on left */}
        <header className="flex h-16 items-center justify-between gap-6 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap truncate">
            <span>Google Drive</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {activeNavLabel}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void loadDriveData()}
              disabled={isLoadingDrive}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingDrive ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isLoadingDrive ? 'جارٍ التحديث...' : 'تحديث الملفات'}</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden whitespace-nowrap shrink-0"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-6">
          {driveError && (
            <div
              role="alert"
              className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-200"
            >
              <span>{driveError}</span>
              <button
                type="button"
                onClick={() => setDriveError(null)}
                className="text-xs font-semibold underline"
              >
                إغلاق
              </button>
            </div>
          )}

          {isLoadingDrive && files.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  جارٍ فهرسة ملفات Google Drive...
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  تم تحميل {loadedProgressCount.toLocaleString('en-US')} عنصر حتى الآن
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                  />
                ))}
              </div>
              <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewView
                  files={files}
                  trashedFiles={trashedFiles}
                  quota={quota}
                  rootFolderId={rootFolderId}
                  userEmail={displayEmail}
                  isDark={isDark}
                  getValidToken={getValidToken}
                  requestConfirmation={(req) => setConfirmationRequest(req)}
                  onSyncComplete={() => loadDriveData()}
                  onError={(msg) => setDriveError(msg)}
                  onNavigate={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'organize' && (
                <SmartOrganizeView
                  files={files}
                  rootFolderId={rootFolderId}
                  folderPathMap={folderPathMap}
                  getValidToken={getValidToken}
                  requestConfirmation={(req) => setConfirmationRequest(req)}
                  onSyncComplete={() => loadDriveData()}
                  onError={(msg) => setDriveError(msg)}
                />
              )}

              {activeTab === 'explorer' && (
                <FileExplorerView
                  files={files}
                  rootFolderId={rootFolderId}
                  getValidToken={getValidToken}
                  requestConfirmation={(req) => setConfirmationRequest(req)}
                  onSyncComplete={() => loadDriveData()}
                  onError={(msg) => setDriveError(msg)}
                />
              )}

              {activeTab === 'cleanup' && (
                <CleanupView
                  files={files}
                  folderPathMap={folderPathMap}
                  getValidToken={getValidToken}
                  requestConfirmation={(req) => setConfirmationRequest(req)}
                  onSyncComplete={() => loadDriveData()}
                  onError={(msg) => setDriveError(msg)}
                />
              )}
            </>
          )}
        </main>
      </div>

      <ConfirmationModal
        request={confirmationRequest}
        onClose={() => setConfirmationRequest(null)}
      />
    </div>
  );
}
