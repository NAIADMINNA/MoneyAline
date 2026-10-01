import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// Storage keys for persistent locking of Google connection
const STORAGE_KEY_TOKEN = 'foreign_worker_sheets_token';
const STORAGE_KEY_USER = 'foreign_worker_sheets_user';

// In-memory token management
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const getSavedAccessToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (token) {
      cachedAccessToken = token;
      return token;
    }
  } catch (e) {
    console.error('Error reading saved token', e);
  }
  return null;
};

export const getSavedUser = (): any | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading saved user', e);
  }
  return null;
};

export const createGoogleProvider = (forceConsent = false) => {
  const provider = new GoogleAuthProvider();
  // Google Sheets Scope
  provider.addScope('https://www.googleapis.com/auth/spreadsheets');
  
  if (forceConsent) {
    provider.setCustomParameters({
      prompt: 'consent',
      access_type: 'offline',
    });
  } else {
    // Fast 1-click select account without repeating permission checkboxes
    provider.setCustomParameters({
      prompt: 'select_account',
    });
  }
  return provider;
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check if we already have a locked/saved token in localStorage
  const savedToken = getSavedAccessToken();
  const savedUser = getSavedUser();

  if (savedToken && savedUser && onAuthSuccess) {
    onAuthSuccess(savedUser as User, savedToken);
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = getSavedAccessToken();
      if (token) {
        cachedAccessToken = token;
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      // If Firebase user state is initializing, check if we still have the persistent token
      const token = getSavedAccessToken();
      if (!token) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (forceConsent = false): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = createGoogleProvider(forceConsent);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่สามารถรับ Access Token จาก Google ได้');
    }

    cachedAccessToken = credential.accessToken;
    try {
      localStorage.setItem(STORAGE_KEY_TOKEN, credential.accessToken);
      if (result.user) {
        const userInfo = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
        };
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userInfo));
      }
    } catch (e) {
      console.error('Error persisting token to storage', e);
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errorCode = error?.code || '';
    const errorMsg = error?.message || '';

    // Gracefully handle user closing or cancelling the popup window
    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorMsg.includes('popup-closed-by-user') ||
      errorMsg.includes('cancelled-popup-request')
    ) {
      // User closed the popup window voluntarily; not a runtime failure
      return null;
    }

    if (errorCode === 'auth/popup-blocked' || errorMsg.includes('popup-blocked')) {
      throw new Error('เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ กรุณาอนุญาตป๊อปอัป (Allow Popups) ในแถบที่อยู่ของเบราว์เซอร์แล้วลองใหม่อีกครั้ง');
    }

    console.error('Google Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return getSavedAccessToken();
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  }
};

export const logoutGoogle = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.error('Sign out error', e);
  }
  cachedAccessToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
  } catch (e) {
    console.error('Error clearing storage', e);
  }
};
