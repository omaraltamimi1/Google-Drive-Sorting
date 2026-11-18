import { FirebaseError, initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/drive'];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'consent',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

function mapFirebaseAuthError(err: unknown): Error {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/internal-error':
        return new Error(
          'حدث خطأ داخلي في مصادقة Firebase (auth/internal-error).\n' +
            'يحدث هذا غالباً بعد تعديل أو إلغاء مفتاح Google API في Google Cloud Console:\n' +
            '• إذا ألغيت المفتاح القديم، يجب تحديث apiKey في firebase-applet-config.json بالمفتاح الجديد.\n' +
            '• إذا قيّدت المفتاح، تأكد من السماح بـ Identity Toolkit API و Token Service API وإضافة نطاق https://' +
            firebaseConfig.authDomain +
            '/* ونطاق التطبيق الحالي ضمن HTTP referrers.'
        );
      case 'auth/api-key-not-valid':
      case 'auth/invalid-api-key':
        return new Error(
          'مفتاح Firebase API غير صالح أو تم إلغاؤه. حدّث apiKey في firebase-applet-config.json بمفتاح صالح من المشروع نفسه.'
        );
      case 'auth/unauthorized-domain':
        return new Error(
          'النطاق الحالي غير مصرح به في إعدادات Firebase Authentication (Authorized domains).'
        );
      case 'auth/popup-blocked':
        return new Error(
          'قام المتصفح بحظر نافذة تسجيل الدخول المنبثقة. يرجى السماح للنوافذ المنبثقة ثم المحاولة مجدداً.'
        );
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return new Error('تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.');
      case 'auth/network-request-failed':
        return new Error('تعذر الاتصال بخوادم المصادقة. تحقق من اتصال الإنترنت وحاول مجدداً.');
      default:
        return new Error(`تعذر إتمام تسجيل الدخول (${err.code}).`);
    }
  }
  return err instanceof Error
    ? err
    : new Error('فشل تسجيل الدخول عبر Google. يرجى المحاولة مجدداً.');
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('تعذر الحصول على رمز الوصول من Google.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
    throw mapFirebaseAuthError(err);
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  cachedAccessToken = null;
  await auth.signOut();
};
