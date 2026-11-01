import React, { useState, useEffect } from 'react';
import { 
  FileEdit, 
  BarChart3, 
  Building2, 
  CheckCircle,
  HelpCircle,
  Download,
  Settings2,
  RefreshCw,
  Users,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { DepositRecord } from './types/deposit';
import { INITIAL_RECORDS, normalizeAlienCategory } from './data/initialData';
import { DepositForm } from './components/DepositForm';
import { DepositReceiptModal } from './components/DepositReceiptModal';
import { DepositLedger } from './components/DepositLedger';
import { DepositStats } from './components/DepositStats';
import { GoogleSheetsBar } from './components/GoogleSheetsBar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { WebhookPasswordModal } from './components/WebhookPasswordModal';
import { RobotHelpWidget } from './components/RobotHelpWidget';
import { initAuth, googleSignIn, logoutGoogle, getSavedAccessToken, getSavedUser } from './services/googleAuth';
import { 
  appendRecordToSheet, 
  batchAppendRecordsToSheet, 
  getAppsScriptUrl, 
  appendRecordViaAppsScript,
  batchAppendViaAppsScript,
  fetchRecordsFromSheet
} from './services/googleSheets';
import { User } from 'firebase/auth';
import { VersionUpdateBanner } from './components/VersionUpdateBanner';
import { useVersionAutoUpdate } from './utils/versionCheck';
import {
  recordPageVisit,
  getVisitorCount,
  getExportCount,
  USAGE_STATS_UPDATED_EVENT,
  UsageStatsData,
} from './utils/usageStats';

const STORAGE_KEY = 'doe_foreign_worker_deposits_v2';

export default function App() {
  const [activeTab, setActiveTab] = useState<'form' | 'ledger' | 'stats'>('form');
  const [records, setRecords] = useState<DepositRecord[]>(() => {
    try {
      const sanitizeRecords = (list: DepositRecord[]): DepositRecord[] =>
        list
          .filter(
            r => r.id !== 'rec-001' && r.id !== 'rec-002' && r.id !== 'rec-003' && r.requestNumber !== '69-09-0006'
          )
          .map(r => ({
            ...r,
            alienCategory: normalizeAlienCategory(r.alienCategory),
            workers: (r.workers || []).map(w => ({
              ...w,
              category: normalizeAlienCategory(w.category || r.alienCategory),
            })),
          }));

      // 1. Try modern storage key
      const savedV2 = localStorage.getItem(STORAGE_KEY);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed)) {
          const cleaned = sanitizeRecords(parsed);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
          return cleaned;
        }
      }

      // 2. Migrate legacy storage key if present, stripping obsolete demo mock items
      const savedV1 = localStorage.getItem('doe_foreign_worker_deposits_v1');
      if (savedV1) {
        const parsed = JSON.parse(savedV1);
        if (Array.isArray(parsed)) {
          const cleaned = sanitizeRecords(parsed);
          localStorage.removeItem('doe_foreign_worker_deposits_v1');
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
          return cleaned;
        }
      }
    } catch (e) {
      console.error('Failed to load records from storage', e);
    }
    return [];
  });

  const [selectedReceipt, setSelectedReceipt] = useState<DepositRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Google Auth & Sheets Access Token (Persistently locked)
  const [user, setUser] = useState<User | null>(() => getSavedUser());
  const [accessToken, setAccessToken] = useState<string | null>(() => getSavedAccessToken());
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem('doe_admin_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);

  // ระบบตรวจสอบและแจ้งเตือนเวอร์ชันอัปเดตอัตโนมัติสำหรับผู้ใช้งานทุกคน
  const {
    hasNewVersion,
    newVersionInfo,
    applyUpdate,
    dismiss: dismissUpdate,
    checkNow: checkVersionNow,
    isChecking: isCheckingVersion,
    currentVersion,
  } = useVersionAutoUpdate();

  // มุมมองการแสดงผลเต็มหน้าจอ (Full Width View)
  const [isFullWidth, setIsFullWidth] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('doe_full_width');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const toggleFullWidth = () => {
    setIsFullWidth(prev => {
      const next = !prev;
      try {
        localStorage.setItem('doe_full_width', String(next));
      } catch {}
      return next;
    });
  };

  const layoutContainerClass = isFullWidth 
    ? 'w-full max-w-[98%] mx-auto transition-all duration-300' 
    : 'w-full max-w-[1600px] 2xl:max-w-[1720px] mx-auto transition-all duration-300';

  // Counter tracking: ผู้เข้าใช้งานสะสม & ผู้กดส่งออกไฟล์สะสม (นับสะสมต่อเนื่องถาวร และเพิ่มขึ้นทันทีทุกครั้งที่เปิดระบบหรือกดส่งออก)
  const [visitorCount, setVisitorCount] = useState<number>(() => recordPageVisit());
  const [exportClickCount, setExportClickCount] = useState<number>(() => getExportCount());

  useEffect(() => {
    // ตรวจสอบการนับผู้เข้าใช้งานและอัปเดตตัวเลขทันทีที่มีการส่งออกไฟล์หรือเปิดแท็บใหม่
    const ensuredVisit = recordPageVisit();
    setVisitorCount(ensuredVisit);
    setExportClickCount(getExportCount());

    const handleStatsEvent = (e: Event) => {
      const customEvent = e as CustomEvent<UsageStatsData>;
      if (customEvent.detail) {
        setVisitorCount(customEvent.detail.visitorCount);
        setExportClickCount(customEvent.detail.exportCount);
      } else {
        setVisitorCount(getVisitorCount());
        setExportClickCount(getExportCount());
      }
    };

    const handleStorageChange = () => {
      setVisitorCount(getVisitorCount());
      setExportClickCount(getExportCount());
    };

    window.addEventListener(USAGE_STATS_UPDATED_EVENT, handleStatsEvent);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(USAGE_STATS_UPDATED_EVENT, handleStatsEvent);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleExportSuccess = () => {
    setExportClickCount(getExportCount());
  };

  const handlePasswordSuccess = () => {
    try {
      sessionStorage.setItem('doe_admin_unlocked', 'true');
    } catch {}
    setIsAdminUnlocked(true);
    setShowPasswordModal(false);
    setShowWebhookModal(true);
    showToast('รหัสผ่านถูกต้อง ปลดล็อกการจัดการ Webhook และแสดงหัวข้อที่ซ่อนเรียบร้อยแล้ว');
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
      },
      () => {
        if (!getSavedAccessToken()) {
          setUser(null);
          setAccessToken(null);
        }
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async (forceConsent = false) => {
    try {
      const result = await googleSignIn(forceConsent);
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        showToast(`ล็อคการเชื่อมต่อ Google สำเร็จ (${result.user.displayName || result.user.email}) ระบบจะจำการเชื่อมต่อนี้ไว้ตลอด`);
      }
    } catch (err: any) {
      const errorCode = err?.code || '';
      const errorMsg = err?.message || '';
      if (
        errorCode === 'auth/popup-closed-by-user' ||
        errorCode === 'auth/cancelled-popup-request' ||
        errorMsg.includes('popup-closed-by-user') ||
        errorMsg.includes('cancelled-popup-request')
      ) {
        return;
      }
      console.error('Google Sign in error:', err);
      showToast(`เข้าสู่ระบบไม่สำเร็จ: ${err.message || 'โปรดลองใหม่อีกครั้ง'}`);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logoutGoogle();
      setUser(null);
      setAccessToken(null);
      showToast('ตัดการเชื่อมต่อ Google เรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
    }
  };

  // Sync with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save records', e);
    }
  }, [records]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleSaveRecord = async (record: DepositRecord, printImmediately: boolean) => {
    let savedRecord = { ...record };

    if (printImmediately) {
      setSelectedReceipt(savedRecord);
    }

    // Auto-sync to Google Sheet:
    const webhookUrl = getAppsScriptUrl();
    const workerCount = record.workers?.length || record.alienCount || 1;

    if (webhookUrl) {
      showToast(`บันทึกคำขอเลขที่ ${record.requestNumber} แล้ว กำลังส่งลง Google Sheet (${workerCount} คน)...`);
      try {
        await appendRecordViaAppsScript(webhookUrl, record);
        savedRecord.syncedToSheet = true;
        showToast(`บันทึกและส่งข้อมูลแรงงาน ${workerCount} คนลง Google Sheet เรียบร้อยแล้ว (ผ่าน Webhook)`);
      } catch (err: any) {
        console.error('Webhook append error:', err);
        showToast(`บันทึกในระบบแล้ว แต่ส่งเข้า Sheet ไม่สำเร็จ: ${err.message || 'โปรดลองใหม่'}`);
      }
    } else if (accessToken) {
      showToast(`บันทึกคำขอเลขที่ ${record.requestNumber} แล้ว กำลังส่งลง Google Sheet (${workerCount} คน)...`);
      try {
        const result = await appendRecordToSheet(accessToken, record);
        savedRecord.syncedToSheet = true;
        savedRecord.sheetRow = result.sequenceNumber;
        showToast(`บันทึกและส่งข้อมูลแรงงาน ${workerCount} คนลง Google Sheet เรียบร้อยแล้ว (ลำดับที่ ${result.sequenceNumber})`);
      } catch (err: any) {
        console.error('Sheet append error:', err);
        const errMsg = err.message || '';
        if (errMsg.includes('สิทธิ์การเข้าถึง') || errMsg.toLowerCase().includes('insufficient')) {
          setAccessToken(null);
          showToast('สิทธิ์การเข้าถึงไม่เพียงพอ กรุณากด "เชื่อมต่อ Google Sheets" ด้านบนเพื่ออนุญาตสิทธิ์');
        } else {
          showToast(`บันทึกในระบบแล้ว แต่ส่งเข้า Sheet ไม่สำเร็จ: ${errMsg || 'โปรดซิงค์ใหม่'}`);
        }
      }
    } else {
      showToast(`⚠️ บันทึกในระบบเรียบร้อย (ยังไม่ได้ส่งเข้า Sheet เนื่องจากยังไม่ได้เชื่อมต่อ Google)`);
    }

    setRecords(prev => [savedRecord, ...prev]);

    // AUTO: ตรวจสอบและดึงข้อมูลอัปเดตสถิติภาพรวมหลังจากบันทึกรายการใหม่
    // ใช้ Smart Merge เพื่อป้องกันไม่ให้ข้อมูลในเครื่องที่เพิ่งบันทึกถูกเขียนทับด้วยข้อมูลชีตที่ยังแคชอยู่
    setTimeout(() => {
      fetchRecordsFromSheet(accessToken).then((pulled) => {
        if (pulled && pulled.length > 0) {
          setRecords(prev => {
            // สร้าง Map ของรายการในเครื่องเพื่อคงจำนวนแรงงานที่ถูกต้อง
            const prevMap = new Map(prev.map(r => [r.requestNumber, r]));
            const merged = pulled.map(p => {
              const local = prevMap.get(p.requestNumber);
              if (local && (local.workers?.length || 0) > (p.workers?.length || 0)) {
                // หากข้อมูลในเครื่องมีรายชื่อแรงงานครบถ้วนกว่า ให้คงข้อมูลแรงงานในเครื่องไว้
                return { 
                  ...p, 
                  workers: local.workers, 
                  alienCount: local.alienCount, 
                  totalAmount: local.totalAmount,
                  thaiBahtText: local.thaiBahtText,
                };
              }
              return p;
            });
            // รักษารายการที่อาจยังไม่อยู่ใน pulled
            const pulledKeys = new Set(pulled.map(p => p.requestNumber));
            const missingLocals = prev.filter(r => r.requestNumber && !pulledKeys.has(r.requestNumber));
            return [...missingLocals, ...merged];
          });
          setLastSyncTime(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      }).catch(() => {});
    }, 4000);
  };

  const handleSyncSingleRecord = async (record: DepositRecord) => {
    const webhookUrl = getAppsScriptUrl();
    if (webhookUrl) {
      showToast(`กำลังส่งคำขอเลขที่ ${record.requestNumber} ลง Google Sheet...`);
      try {
        await appendRecordViaAppsScript(webhookUrl, record);
        setRecords(prev => prev.map(r => r.id === record.id ? { ...r, syncedToSheet: true } : r));
        showToast(`ส่งคำขอเลขที่ ${record.requestNumber} ลง Google Sheet เรียบร้อยแล้ว`);
      } catch (err: any) {
        showToast(`ส่งเข้า Sheet ไม่สำเร็จ: ${err.message || 'โปรดลองใหม่'}`);
      }
      return;
    }

    if (!accessToken) {
      showToast('กรุณากดปุ่มเชื่อมต่อ Google Sheets ด้านบนก่อนส่งข้อมูล');
      await handleGoogleLogin();
      return;
    }

    showToast(`กำลังส่งคำขอเลขที่ ${record.requestNumber} ลง Google Sheet...`);
    try {
      const result = await appendRecordToSheet(accessToken, record);
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, syncedToSheet: true, sheetRow: result.sequenceNumber } : r));
      showToast(`ส่งคำขอเลขที่ ${record.requestNumber} ลง Google Sheet สำเร็จ (ลำดับที่ ${result.sequenceNumber})`);
    } catch (err: any) {
      showToast(`ส่งเข้า Sheet ไม่สำเร็จ: ${err.message || 'โปรดลองใหม่'}`);
    }
  };

  const handleSyncAllUnsyncedRecords = async () => {
    const unsynced = records.filter(r => !r.syncedToSheet);
    if (unsynced.length === 0) {
      showToast('ข้อมูลทั้งหมดถูกส่งลง Google Sheet เรียบร้อยแล้ว');
      return;
    }

    const webhookUrl = getAppsScriptUrl();
    if (webhookUrl) {
      showToast(`กำลังส่งข้อมูล ${unsynced.length} รายการลง Google Sheet ผ่าน Webhook...`);
      try {
        const count = await batchAppendViaAppsScript(webhookUrl, unsynced);
        setRecords(prev => prev.map(r => ({ ...r, syncedToSheet: true })));
        showToast(`ส่งข้อมูลทั้งหมด ${count} รายการลง Google Sheet เรียบร้อยแล้ว!`);
      } catch (err: any) {
        showToast(`เกิดข้อผิดพลาดในการส่งข้อมูล: ${err.message || 'โปรดลองใหม่'}`);
      }
      return;
    }

    if (!accessToken) {
      showToast('กรุณากดเชื่อมต่อ Google Sheets ด้านบนก่อนส่งข้อมูล');
      await handleGoogleLogin();
      return;
    }

    showToast(`กำลังส่งข้อมูล ${unsynced.length} รายการลง Google Sheet...`);
    try {
      if (accessToken) {
        const result = await batchAppendRecordsToSheet(accessToken, unsynced);
        setRecords(prev => prev.map(r => ({ ...r, syncedToSheet: true })));
        showToast(`ส่งข้อมูลทั้งหมด ${result.count} รายการลง Google Sheet เรียบร้อยแล้ว`);
      }
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาดในการส่งข้อมูล: ${err.message || 'โปรดลองใหม่'}`);
    }
  };

  const [isRefreshingSheet, setIsRefreshingSheet] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => 
    new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [syncCountdown, setSyncCountdown] = useState<number>(20);
  const [isAutoSyncing, setIsAutoSyncing] = useState<boolean>(false);

  // 100% AUTO ENGINE: ตรวจสอบและดึงข้อมูลล่าสุดอัตโนมัติทุก 20 วินาที อย่างแม่นยำ
  useEffect(() => {
    let isMounted = true;

    const performSync = async (isBackground = false) => {
      if (isBackground && isMounted) setIsAutoSyncing(true);
      try {
        const pulled = await fetchRecordsFromSheet(accessToken);
        if (isMounted && Array.isArray(pulled)) {
          if (pulled.length > 0) {
            setRecords(pulled);
          } else if (accessToken) {
            setRecords([]);
          }
          setLastSyncTime(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      } catch (e) {
        // Fallback gracefully
      } finally {
        if (isMounted) {
          setIsAutoSyncing(false);
          setSyncCountdown(20);
        }
      }
    };

    // 1. ตรวจสอบทันทีเมื่อเปิดระบบหรือสลับหน้า
    performSync(false);

    // 2. ตรวจสอบอัตโนมัติทุก 20 วินาทีแบบนับถอยหลัง
    const timer = setInterval(() => {
      setSyncCountdown((prev) => {
        if (prev <= 1) {
          performSync(true);
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [accessToken, activeTab]);

  const handleRefreshSheet = async () => {
    setIsRefreshingSheet(true);
    try {
      // Step 1: Try fetching directly (Supports Apps Script Webhook or Public Link without login)
      let pulled = await fetchRecordsFromSheet(accessToken);

      // Step 2: If no data returned and not logged in, prompt Google Login
      if (pulled.length === 0 && !accessToken) {
        try {
          const result = await googleSignIn(false);
          if (result) {
            setUser(result.user);
            setAccessToken(result.accessToken);
            pulled = await fetchRecordsFromSheet(result.accessToken);
          }
        } catch {
          // user cancelled popup or closed
        }
      }

      setRecords(pulled);
      if (pulled.length > 0) {
        showToast(`ดึงข้อมูลจาก Google Sheet สำเร็จ: ปรับปรุงตรงกับฐานข้อมูล (${pulled.length} รายการ) เรียบร้อยแล้ว`);
      } else {
        showToast('ซิงค์กับ Google Sheet สำเร็จ: ขณะนี้ไม่มีข้อมูลในสเปรดชีต (0 รายการ) ตัวเลขสถิติจึงถูกรีเซ็ตเป็น 0');
      }
    } catch (err: any) {
      showToast(`ดึงข้อมูลไม่สำเร็จ: ${err.message || 'โปรดลองใหม่'}`);
    } finally {
      setIsRefreshingSheet(false);
    }
  };

  const handleClearAllRecords = () => {
    if (window.confirm('คุณต้องการรีเซ็ตข้อมูลสถิติในระบบให้เป็น 0 หรือไม่?\n\n(ระบบจะล้างข้อมูลที่ค้างอยู่ในเบราว์เซอร์เพื่อให้ตัวเลขสถิติเป็น 0 ทันที โดยไม่กระทบต่อไฟล์บน Google Sheet)')) {
      setRecords([]);
      showToast('รีเซ็ตข้อมูลในระบบเรียบร้อยแล้ว (ตัวเลขสถิติเป็น 0)');
    }
  };

  // Auto-sync when user returns to this browser tab from Google Sheets
  useEffect(() => {
    const handleWindowFocus = () => {
      if (accessToken) {
        fetchRecordsFromSheet(accessToken)
          .then((pulled) => {
            setRecords(pulled);
          })
          .catch(() => {});
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [accessToken]);

  // Auto-sync when switching to the stats tab
  useEffect(() => {
    if (activeTab === 'stats' && accessToken) {
      fetchRecordsFromSheet(accessToken)
        .then((pulled) => {
          setRecords(pulled);
        })
        .catch(() => {});
    }
  }, [activeTab, accessToken]);

  const handleDeleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    showToast('ลบรายการบันทึกเรียบร้อยแล้ว');
  };

  const handlePullFromSheet = (sheetRecords: DepositRecord[]) => {
    const safeRecords = sheetRecords || [];
    setRecords(safeRecords);
    if (safeRecords.length > 0) {
      showToast(`ดึงข้อมูลจาก Google Sheet สำเร็จ: ปรับปรุงตรงกับฐานข้อมูล (${safeRecords.length} รายการ) เรียบร้อยแล้ว`);
    } else {
      showToast('ซิงค์กับ Google Sheet สำเร็จ: ขณะนี้ไม่มีข้อมูลในสเปรดชีต (0 รายการ) ตัวเลขสถิติจึงถูกรีเซ็ตเป็น 0');
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-black flex flex-col font-sans relative selection:bg-[#FFE500] selection:text-black">
      
      {/* Top Bar Contract (Single row, 3 zones) with Neo-Brutalist Aesthetics */}
      <header className="bg-white border-b-3 border-black sticky top-0 z-30 shadow-[0px_4px_0px_0px_#000000]">
        <div className={`${layoutContainerClass} px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4`}>
          
          {/* Zone 1: Wordmark / Brand with Emblem */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-[#FFE500] text-black flex items-center justify-center font-black border-2 border-black shadow-[3px_3px_0px_0px_#000000] shrink-0">
              <Building2 className="w-6 h-6 text-black stroke-[2.5]" />
            </div>
            <div>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); setActiveTab('form'); }} 
                className="text-base sm:text-lg font-extrabold tracking-tight text-black hover:underline decoration-2 transition block leading-tight"
              >
                ระบบบันทึกเงินหลักประกันคนต่างด้าว
              </a>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-bold text-neutral-700">
                <span className="w-2 h-2 bg-[#22C55E] border border-black" />
                <span>กรมการจัดหางาน กระทรวงแรงงาน</span>
                <span className="hidden md:inline text-black font-black">|</span>
                <span className="hidden md:inline bg-[#BFDBFE] text-black px-1.5 py-0.2 border border-black font-extrabold">ระบบงานวางหลักประกัน</span>
              </div>
            </div>
          </div>

          {/* Zone 2: Navigation Links / Tabs with Neo-Brutalist Segmented Look */}
          <nav className="flex items-center gap-2 p-1.5 bg-[#F3F4F6] rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000000]">
            <button
              onClick={() => setActiveTab('form')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-extrabold rounded-lg border-2 transition-all duration-150 cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-[#FFE500] text-black border-black shadow-[2px_2px_0px_0px_#000000] -translate-x-0.5 -translate-y-0.5'
                  : 'bg-white text-neutral-800 border-transparent hover:border-black hover:bg-neutral-100 active:translate-x-[1px] active:translate-y-[1px]'
              }`}
            >
              <FileEdit className="w-4 h-4 text-black stroke-[2.5]" />
              <span>แบบฟอร์มบันทึก</span>
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-extrabold rounded-lg border-2 transition-all duration-150 cursor-pointer ${
                activeTab === 'stats'
                  ? 'bg-[#6EE7B7] text-black border-black shadow-[2px_2px_0px_0px_#000000] -translate-x-0.5 -translate-y-0.5'
                  : 'bg-white text-neutral-800 border-transparent hover:border-black hover:bg-neutral-100 active:translate-x-[1px] active:translate-y-[1px]'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-black stroke-[2.5]" />
              <span>สถิติ & รายงาน</span>
            </button>
          </nav>

          {/* Zone 3: Live Status & Manage Webhook Button */}
          <div className="flex items-center gap-2.5">
            {/* Toggle Full Width Screen Button */}
            <button
              type="button"
              onClick={toggleFullWidth}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black text-xs font-extrabold transition-all duration-150 cursor-pointer shadow-[3px_3px_0px_0px_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                isFullWidth
                  ? 'bg-[#60A5FA] text-black'
                  : 'bg-white hover:bg-[#FEF08A] text-black'
              }`}
              title={isFullWidth ? 'คลิกเพื่อสลับกลับเป็นมุมมองขนาดมาตรฐาน' : 'คลิกเพื่อขยายหน้าจอแสดงผลเต็มพื้นที่ 100%'}
            >
              {isFullWidth ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span className="hidden sm:inline">ย่อขนาด</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                  <span className="hidden sm:inline">ขยายเต็มจอ</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (isAdminUnlocked) {
                  setShowWebhookModal(true);
                } else {
                  setShowPasswordModal(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-[#E9D5FF] hover:bg-[#D8B4FE] text-black text-xs font-extrabold transition-all duration-150 shadow-[3px_3px_0px_0px_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
              title="เปิดหน้าต่างตั้งค่า จัดการ Webhook (ต้องใช้รหัสผ่าน)"
            >
              <Settings2 className="w-3.5 h-3.5 text-black stroke-[2.5]" />
              <span>จัดการ Webhook</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs bg-[#FDE68A] border-2 border-black px-3.5 py-1.5 rounded-lg shadow-[3px_3px_0px_0px_#000000]">
              <span className="w-2.5 h-2.5 bg-[#22C55E] border border-black" />
              <span className="font-extrabold text-black">ปีงบประมาณ พ.ศ. ๒๕๖๙</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-6 px-4 sm:px-6">
        {/* Google Sheets Connection & Sync Bar (Hidden by default, unlocked with password) */}
        <GoogleSheetsBar
          user={user}
          accessToken={accessToken}
          records={records}
          onLogin={handleGoogleLogin}
          onLogout={handleGoogleLogout}
          onNotify={showToast}
          onPullFromSheet={handlePullFromSheet}
          showWebhookModal={showWebhookModal}
          onCloseWebhookModal={() => setShowWebhookModal(false)}
          onOpenWebhookModal={() => {
            if (isAdminUnlocked) {
              setShowWebhookModal(true);
            } else {
              setShowPasswordModal(true);
            }
          }}
          isAdminUnlocked={isAdminUnlocked}
          onLockAdmin={() => {
            try {
              sessionStorage.removeItem('doe_admin_unlocked');
            } catch {}
            setIsAdminUnlocked(false);
            setShowWebhookModal(false);
            showToast('ซ่อนหัวข้อการเชื่อมต่อเรียบร้อยแล้ว');
          }}
          lastSyncTime={lastSyncTime}
          syncCountdown={syncCountdown}
          isAutoSyncing={isAutoSyncing}
          onClearAllRecords={handleClearAllRecords}
        />

        {activeTab === 'form' && (
          <div className="animate-in fade-in duration-200">
            <DepositForm
              onSave={handleSaveRecord}
              isGoogleConnected={!!accessToken}
              onConnectGoogle={() => handleGoogleLogin(false)}
              hasWebhook={!!getAppsScriptUrl()}
            />
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="animate-in fade-in duration-200">
            <div className={`${layoutContainerClass} mb-4 flex items-center justify-between bg-[#FFE500] border-2 border-black p-4 rounded-xl shadow-[4px_4px_0px_0px_#000000]`}>
              <div>
                <h2 className="text-xl font-black text-black">
                  ทะเบียนประวัติการวางหลักประกัน
                </h2>
                <p className="text-xs font-bold text-neutral-800 mt-0.5">
                  รายการคำขอและใบเสร็จรับเงินค่าวางหลักประกันทั้งหมดในระบบ
                </p>
              </div>
            </div>
            <DepositLedger
              records={records}
              onViewReceipt={(rec) => setSelectedReceipt(rec)}
              onDeleteRecord={handleDeleteRecord}
              onSyncSingleRecord={handleSyncSingleRecord}
              onSyncAllRecords={handleSyncAllUnsyncedRecords}
            />
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="animate-in fade-in duration-200">
            <div className={`${layoutContainerClass} mb-5 flex items-center justify-between bg-[#FFE500] border-3 border-black p-4 sm:p-5 rounded-xl shadow-[5px_5px_0px_0px_#000000]`}>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-black">
                  รายงานสรุปและสถิติภาพรวม
                </h2>
                <p className="text-xs font-bold text-neutral-800 mt-0.5">
                  ภาพรวมการจัดเก็บเงินหลักประกันคนต่างด้าวตามพระราชกำหนด
                </p>
              </div>
            </div>
            <DepositStats 
              records={records} 
              onNotify={showToast} 
              accessToken={accessToken}
              onRefreshFromSheet={handleRefreshSheet}
              isRefreshing={isRefreshingSheet}
              onClearAllRecords={handleClearAllRecords}
              lastSyncTime={lastSyncTime}
              syncCountdown={syncCountdown}
              isAutoSyncing={isAutoSyncing}
              onExportSuccess={handleExportSuccess}
            />
          </div>
        )}
      </main>

      {/* Official Receipt Modal */}
      {selectedReceipt && (
        <DepositReceiptModal
          record={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#FFE500] text-black px-4 py-3 rounded-xl border-3 border-black shadow-[5px_5px_0px_0px_#000000] flex items-center gap-2.5 text-xs sm:text-sm font-extrabold animate-in slide-in-from-bottom duration-200 print:hidden">
          <CheckCircle className="w-5 h-5 text-black shrink-0 stroke-[2.5]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Version Update Notification Banner */}
      <VersionUpdateBanner
        hasNewVersion={hasNewVersion}
        newVersionInfo={newVersionInfo}
        onUpdate={applyUpdate}
        onDismiss={dismissUpdate}
      />

      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Robot Notification Mascot */}
      <RobotHelpWidget onNotify={showToast} />

      {/* Webhook Admin Password Modal */}
      <WebhookPasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={handlePasswordSuccess}
      />

      {/* Footer with Counters on the Right Hand Side */}
      <footer className="bg-white border-t-3 border-black py-4 px-4 sm:px-6">
        <div className={`${layoutContainerClass} flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-black`}>
          <div className="text-center md:text-left font-extrabold">
            ระบบบันทึกการชำระเงินค่าวางหลักประกันแรงงานต่างด้าว · กรมการจัดหางาน กระทรวงแรงงาน
          </div>

          {/* ด้านขวามือ: การนับจำนวนคนเข้าใช้งาน และ คนกดเลือกส่งออกไฟล์ */}
          <div className="flex items-center gap-3 flex-wrap justify-center md:justify-end text-xs">
            {/* 1. จำนวนคนเข้าใช้งานสะสม */}
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#BFDBFE] border-2 border-black text-black shadow-[3px_3px_0px_0px_#000000]"
              title="ยอดผู้เข้าใช้งานระบบสะสมทั้งหมด (นับสะสมต่อเนื่องถาวร ไม่มีการรีเซ็ตหรือลบข้อมูลในแต่ละวัน)"
            >
              <Users className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
              <span className="text-black font-extrabold text-[11px]">ผู้เข้าใช้งานสะสม:</span>
              <strong className="font-mono font-black text-black bg-white px-2 py-0.5 rounded border-2 border-black">
                {visitorCount.toLocaleString('th-TH')}
              </strong>
              <span className="text-black font-bold text-[11px]">คน</span>
            </div>

            {/* 2. คนกดเลือกส่งออกไฟล์สะสม */}
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6EE7B7] border-2 border-black text-black shadow-[3px_3px_0px_0px_#000000]"
              title="ยอดการกดส่งออกไฟล์สะสมทั้งหมด (นับสะสมต่อเนื่องถาวร ไม่มีการรีเซ็ตหรือลบข้อมูลในแต่ละวัน)"
            >
              <Download className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
              <span className="text-black font-extrabold text-[11px]">ส่งออกไฟล์สะสม:</span>
              <strong className="font-mono font-black text-black bg-white px-2 py-0.5 rounded border-2 border-black">
                {exportClickCount.toLocaleString('th-TH')}
              </strong>
              <span className="text-black font-bold text-[11px]">ครั้ง</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
