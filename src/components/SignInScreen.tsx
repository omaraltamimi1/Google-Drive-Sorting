import {
  CopyCheck,
  FolderTree,
  Layers,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react';

interface SignInScreenProps {
  onSignIn: () => void;
  isSigningIn: boolean;
  error: string | null;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function SignInScreen({
  onSignIn,
  isSigningIn,
  error,
  isDark,
  onToggleTheme,
}: SignInScreenProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
            مُنظِّم درايف
          </span>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
            <span className="whitespace-nowrap shrink-0">الترتيب الذكي</span>
            <span className="whitespace-nowrap shrink-0">مستعرض الملفات</span>
            <span className="whitespace-nowrap shrink-0">كشف التكرارات</span>
          </nav>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
              )}
              <span>{isDark ? 'النهاري' : 'الليلي'}</span>
            </button>
            <button
              type="button"
              onClick={onSignIn}
              disabled={isSigningIn}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500 whitespace-nowrap shrink-0"
            >
              {isSigningIn ? 'جارٍ الاتصال...' : 'ربط Google Drive'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-12">
        <div className="grid w-full grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
          <section className="flex flex-col justify-center lg:col-span-7">
            <p className="mb-3 text-sm font-medium text-blue-700 dark:text-blue-400">
              إدارة وتنظيم مساحتك السحابية
            </p>
            <h1 className="font-display text-3xl font-bold leading-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
              رتّب كل ملفات Google Drive في مجلدات منظمة خلال دقائق
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
              يقوم مُنظِّم درايف بفحص فهرس ملفاتك بالكامل وتصنيفها تلقائياً حسب النوع أو السنة،
              مع كشف النسخ المكررة والمجلدات الفارغة، ولا ينفّذ أي نقل أو حذف إلا بعد مراجعتك
              وتأكيدك الصريح.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onSignIn}
                disabled={isSigningIn}
                className="gsi-material-button"
              >
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isSigningIn ? 'جارٍ تسجيل الدخول...' : 'Sign in with Google'}
                  </span>
                </div>
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                اتصال مباشر وآمن بحسابك دون حفظ أي كلمات مرور
              </span>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-200"
              >
                {error}
              </div>
            )}
          </section>

          <section className="lg:col-span-5">
            <div className="h-full rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                آلية العمل داخل حسابك
              </h2>
              <div className="mt-5 divide-y divide-slate-200 dark:divide-slate-800">
                <div className="flex items-start gap-3.5 pb-4">
                  <Layers
                    className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-400"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      01. تصنيف ذكي تلقائي
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      فرز المستندات وملفات PDF والجداول والصور والفيديو والبرمجة في مجلدات مرقّمة وواضحة.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 py-4">
                  <CopyCheck
                    className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-400"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      02. كشف التكرارات والمجلدات الفارغة
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      اكتشاف الملفات المتطابقة عبر بصمة المحتوى MD5 أو الاسم لتوفير المساحة بسهولة.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 py-4">
                  <FolderTree
                    className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-400"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      03. تحكم جماعي كامل بالمجلدات
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      تصفح الهيكل الشجري الكامل ونقل أو إعادة تسمية عدة ملفات دفعة واحدة.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 pt-4">
                  <ShieldCheck
                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      04. معاينة وتأكيد قبل كل تعديل
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      تظهر نافذة تأكيد واضحة قبل إنشاء أي مجلد أو نقل أو إرسال ملف إلى سلة المهملات.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
