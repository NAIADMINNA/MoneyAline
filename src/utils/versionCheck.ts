import { useState, useEffect, useCallback } from 'react';

export const CURRENT_APP_VERSION = '1.2.0';
export const CURRENT_BUILD_TIME = '2026-10-15T22:15:00Z';

export interface VersionInfo {
  version: string;
  buildTime: string;
  description?: string;
}

/**
 * ดึงข้อมูลเวอร์ชันล่าสุดจากเซิร์ฟเวอร์ โดยไม่ดึงจากแคชของเบราว์เซอร์
 */
export async function checkServerVersion(): Promise<{
  hasUpdate: boolean;
  serverVersion: string;
  buildTime?: string;
  description?: string;
}> {
  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });

    if (!res.ok) {
      return { hasUpdate: false, serverVersion: CURRENT_APP_VERSION };
    }

    const data: VersionInfo = await res.json();
    const serverVer = data.version || CURRENT_APP_VERSION;
    const hasUpdate = serverVer !== CURRENT_APP_VERSION;

    return {
      hasUpdate,
      serverVersion: serverVer,
      buildTime: data.buildTime,
      description: data.description,
    };
  } catch (error) {
    // กรณีออฟไลน์หรือไม่สามารถติดต่อเซิร์ฟเวอร์ได้
    return { hasUpdate: false, serverVersion: CURRENT_APP_VERSION };
  }
}

/**
 * ดำเนินการรีเฟรชอัปเดตระบบไปยังเวอร์ชันใหม่ทันที พร้อมล้างแคช Service Worker
 */
export async function forceUpdateApp(): Promise<void> {
  try {
    // 1. ส่งข้อความให้ Service Worker ใหม่อัปเดตข้ามการรอ (skipWaiting)
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        await reg.update().catch(() => {});
      }
    }

    // 2. ล้าง Cache Storage ของเบราว์เซอร์สำหรับโค้ดเก่า
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
  } catch (e) {
    console.error('Error clearing caches during update', e);
  } finally {
    // 3. รีโหลดหน้าเว็บแบบ Hard Reload
    window.location.reload();
  }
}

/**
 * Custom Hook สำหรับตรวจจับการอัปเดตเวอร์ชันอัตโนมัติ
 * - ตรวจสอบทุก 60 วินาที
 * - ตรวจสอบเมื่อสลับหน้าต่างกลับมาที่แท็บระบบ (window focus)
 * - ตรวจสอบเมื่อระบบกลับมาต่ออินเทอร์เน็ตได้ (online)
 */
export function useVersionAutoUpdate() {
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [newVersionInfo, setNewVersionInfo] = useState<VersionInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const performCheck = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await checkServerVersion();
      if (result.hasUpdate) {
        setHasNewVersion(true);
        setNewVersionInfo({
          version: result.serverVersion,
          buildTime: result.buildTime || '',
          description: result.description,
        });
      }
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    // 1. ตรวจสอบทันทีหลังจากโหลดระบบ
    const initialTimer = setTimeout(() => {
      performCheck();
    }, 3000);

    // 2. ตรวจสอบซ้ำเป็นระยะทุก 60 วินาที
    const intervalTimer = setInterval(() => {
      performCheck();
    }, 60000);

    // 3. ตรวจสอบเมื่อผู้ใช้สลับหน้าต่างกลับมาที่แท็บของระบบ
    const handleFocus = () => {
      performCheck();
    };
    window.addEventListener('focus', handleFocus);

    // 4. ตรวจสอบเมื่ออุปกรณ์กลับมาออนไลน์
    const handleOnline = () => {
      performCheck();
    };
    window.addEventListener('online', handleOnline);

    // 5. ดักจับ Service Worker อัปเดตเสร็จ
    const handleControllerChange = () => {
      setHasNewVersion(true);
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }

    // 6. ดักจับ BroadcastChannel ข้ามแท็บในเบราว์เซอร์เดียวกัน
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel('doe_version_broadcast_channel');
        broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'FORCE_UPDATE' || event.data?.type === 'NEW_VERSION') {
            setHasNewVersion(true);
            if (event.data.versionInfo) {
              setNewVersionInfo(event.data.versionInfo);
            }
          }
        };
      }
    } catch {}

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, [performCheck]);

  const applyUpdate = () => {
    forceUpdateApp();
  };

  const dismiss = () => {
    setDismissed(true);
  };

  return {
    hasNewVersion: hasNewVersion && !dismissed,
    newVersionInfo,
    isChecking,
    checkNow: performCheck,
    applyUpdate,
    dismiss,
    currentVersion: CURRENT_APP_VERSION,
  };
}

/**
 * ส่งสัญญาณแจ้งเตือนอัปเดตไปยังทุกแท็บที่เปิดอยู่ในเบราว์เซอร์
 */
export function broadcastAppUpdate(versionInfo?: VersionInfo) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('doe_version_broadcast_channel');
      channel.postMessage({ type: 'NEW_VERSION', versionInfo });
      channel.close();
    }
  } catch (e) {
    console.error('Broadcast failed', e);
  }
}
