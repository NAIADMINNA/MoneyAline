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
  Users
} from 'lucide-react';
import { DepositRecord } from './types/deposit';
import { INITIAL_RECORDS } from './data/initialData';
import { DepositForm } from './components/DepositForm';
import { DepositReceiptModal } from './components/DepositReceiptModal';
import { DepositLedger } from './components/DepositLedger';
import { DepositStats } from './components/DepositStats';
import { GoogleSheetsBar } from './components/GoogleSheetsBar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { WebhookPasswordModal } from './components/WebhookPasswordModal';
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

const STORAGE_KEY = 'doe_foreign_worker_deposits_v2';

export default function App() {
  const [activeTab, setActiveTab] = useState<'form' | 'ledger' | 'stats'>('form');
  const [records, setRecords] = useState<DepositRecord[]>(() => {
    try {
      // 1. Try modern storage key
      const savedV2 = localStorage.getItem(STORAGE_KEY);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed)) {
          // Filter out obsolete demo items (rec-001, rec-002, rec-003)
          const cleaned = parsed.filter(
            r => r.id !== 'rec-001' && r.id !== 'rec-002' && r.id !== 'rec-003' && r.requestNumber !== '69-09-0006'
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
          }
          return cleaned;
        }
      }

      // 2. Migrate legacy storage key if present, stripping obsolete demo mock items
      const savedV1 = localStorage.getItem('doe_foreign_worker_deposits_v1');
      if (savedV1) {
        const parsed = JSON.parse(savedV1);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            r => r.id !== 'rec-001' && r.id !== 'rec-002' && r.id !== 'rec-003' && r.requestNumber !== '69-09-0006'
          );
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

  // Counter tracking: ผู้เข้าใช้งาน & ผู้กดส่งออกไฟล์ (เริ่มต้นที่ 0 แท้จริง ไม่มีการจำลองตัวเลข)
  const [visitorCount, setVisitorCount] = useState<number>(() => {
    try {
      localStorage.removeItem('doe_visitor_count'); // ล้างค่าตัวเลขจำลองเดิมออก
      const saved = localStorage.getItem('doe_real_visitor_count');
      if (saved !== null) {
        const val = parseInt(saved, 10);
        return isNaN(val) ? 0 : val;
      }
      return 0;
    } catch {
      return 0;
    }
  });

  const [exportClickCount, setExportClickCount] = useState<number>(() => {
    try {
      localStorage.removeItem('doe_export_count'); // ล้างค่าตัวเลขจำลองเดิมออก
      const saved = localStorage.getItem('doe_real_export_count');
      if (saved !== null) {
        const val = parseInt(saved, 10);
        return isNaN(val) ? 0 : val;
      }
      return 0;
    } catch {
      return 0;
    }
  });

  // นับจำนวนคนเข้าใช้งานจริง เริ่มต้นนับจาก 0
  useEffect(() => {
    try {
      const recorded = sessionStorage.getItem('doe_real_visit_session');
      if (!recorded) {
        sessionStorage.setItem('doe_real_visit_session', 'true');
        setVisitorCount(prev => {
          const next = prev + 1;
          try { localStorage.setItem('doe_real_visitor_count', String(next)); } catch {}
          return next;
        });
      }
    } catch {}
  }, []);

  const handleExportSuccess = () => {
    setExportClickCount(prev => {
      const next = prev + 1;
      try { localStorage.setItem('doe_real_export_count', String(next)); } catch {}
      return next;
    });
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
    if (webhookUrl) {
      showToast(`บันทึกคำขอเลขที่ ${record.requestNumber} แล้ว กำลังส่งลง Google Sheet...`);
      try {
        await appendRecordViaAppsScript(webhookUrl, record);
        savedRecord.syncedToSheet = true;
        showToast(`บันทึกและส่งลง Google Sheet เรียบร้อยแล้ว (ผ่าน Webhook)`);
      } catch (err: any) {
        console.error('Webhook append error:', err);
        showToast(`บันทึกในระบบแล้ว แต่ส่งเข้า Sheet ไม่สำเร็จ: ${err.message || 'โปรดลองใหม่'}`);
      }
    } else if (accessToken) {
      showToast(`บันทึกคำขอเลขที่ ${record.requestNumber} แล้ว กำลังส่งลง Google Sheet...`);
      try {
        const result = await appendRecordToSheet(accessToken, record);
        savedRecord.syncedToSheet = true;
        savedRecord.sheetRow = result.sequenceNumber;
        showToast(`บันทึกและส่งลง Google Sheet เรียบร้อยแล้ว (ลำดับที่ ${result.sequenceNumber})`);
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

    // AUTO: ตรวจสอบและดึงข้อมูลอัปเดตสถิติภาพรวมทันทีหลังจากบันทึกรายการใหม่
    setTimeout(() => {
      fetchRecordsFromSheet(accessToken).then((pulled) => {
        if (pulled && pulled.length > 0) {
          setRecords(pulled);
          setLastSyncTime(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      }).catch(() => {});
    }, 1500);
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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans relative selection:bg-blue-600 selection:text-white">
      {/* Decorative ambient lighting in background */}
      <div className="absolute top-0 inset-x-0 h-80 bg-gradient-to-b from-blue-100/60 via-indigo-50/30 to-transparent pointer-events-none -z-10" />
      <div className="absolute top-20 right-10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 left-10 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none -z-10" />
      
      {/* Top Bar Contract (Single row, 3 zones) with rich government aesthetics */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          
          {/* Zone 1: Wordmark / Brand with Emblem */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 via-indigo-600 to-sky-500 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/25 ring-2 ring-blue-100">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); setActiveTab('form'); }} 
                className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 hover:text-blue-700 transition block leading-tight"
              >
                ระบบบันทึกเงินหลักประกันคนต่างด้าว
              </a>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-medium text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>กรมการจัดหางาน กระทรวงแรงงาน</span>
                <span className="hidden md:inline text-slate-300">|</span>
                <span className="hidden md:inline text-blue-700 font-semibold">ระบบงานวางหลักประกัน</span>
              </div>
            </div>
          </div>

          {/* Zone 2: Navigation Links / Tabs with Vibrant Segmented Look */}
          <nav className="flex items-center p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-inner">
            <button
              onClick={() => setActiveTab('form')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <FileEdit className={`w-4 h-4 ${activeTab === 'form' ? 'text-white' : 'text-blue-600'}`} />
              <span>แบบฟอร์มบันทึก</span>
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                activeTab === 'stats'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <BarChart3 className={`w-4 h-4 ${activeTab === 'stats' ? 'text-white' : 'text-indigo-600'}`} />
              <span>สถิติ & รายงาน</span>
            </button>
          </nav>

          {/* Zone 3: Live Status & Manage Webhook Button */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (isAdminUnlocked) {
                  setShowWebhookModal(true);
                } else {
                  setShowPasswordModal(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              title="เปิดหน้าต่างตั้งค่า จัดการ Webhook (ต้องใช้รหัสผ่าน)"
            >
              <Settings2 className="w-3.5 h-3.5 text-purple-600" />
              <span>จัดการ Webhook</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 px-3.5 py-1.5 rounded-xl shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
              <span className="font-semibold text-blue-950">ปีงบประมาณ พ.ศ. ๒๕๖๙</span>
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
            <div className="max-w-[1360px] mx-auto mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  ทะเบียนประวัติการวางหลักประกัน
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
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
            <div className="max-w-[1360px] mx-auto mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  รายงานสรุปและสถิติภาพรวม
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
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
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm animate-in slide-in-from-bottom duration-200 border border-slate-700">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Webhook Admin Password Modal */}
      <WebhookPasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={handlePasswordSuccess}
      />

      {/* Footer with Counters on the Right Hand Side */}
      <footer className="bg-white border-t border-slate-200/90 py-3.5 px-4 sm:px-6">
        <div className="max-w-[1360px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="text-center md:text-left font-medium">
            ระบบบันทึกการชำระเงินค่าวางหลักประกันแรงงานต่างด้าว · กรมการจัดหางาน กระทรวงแรงงาน
          </div>

          {/* ด้านขวามือ: การนับจำนวนคนเข้าใช้งาน และ คนกดเลือกส่งออกไฟล์ */}
          <div className="flex items-center gap-2.5 flex-wrap justify-center md:justify-end text-xs">
            {/* 1. จำนวนคนเข้าใช้งาน */}
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-950 shadow-2xs hover:bg-blue-100/70 transition"
              title="จำนวนครั้งที่มีผู้เข้าใช้งานระบบ"
            >
              <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-slate-600 font-medium text-[11px]">ผู้เข้าใช้งาน:</span>
              <strong className="font-mono font-bold text-blue-700 bg-white px-1.5 py-0.5 rounded-md border border-blue-100 shadow-2xs">
                {visitorCount.toLocaleString('th-TH')}
              </strong>
              <span className="text-slate-500 text-[11px]">คน</span>
            </div>

            {/* 2. คนกดเลือกส่งออกไฟล์ */}
            <div 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 shadow-2xs hover:bg-emerald-100/70 transition"
              title="จำนวนครั้งที่มีการกดส่งออกไฟล์ฐานข้อมูล CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-slate-600 font-medium text-[11px]">ส่งออกไฟล์:</span>
              <strong className="font-mono font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded-md border border-emerald-100 shadow-2xs">
                {exportClickCount.toLocaleString('th-TH')}
              </strong>
              <span className="text-slate-500 text-[11px]">ครั้ง</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
