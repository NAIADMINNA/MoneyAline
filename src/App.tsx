import React, { useState, useEffect } from 'react';
import { 
  FileEdit, 
  TableProperties, 
  BarChart3, 
  Plus, 
  Building2, 
  CheckCircle,
  HelpCircle,
  Download
} from 'lucide-react';
import { DepositRecord } from './types/deposit';
import { INITIAL_RECORDS } from './data/initialData';
import { DepositForm } from './components/DepositForm';
import { DepositReceiptModal } from './components/DepositReceiptModal';
import { DepositLedger } from './components/DepositLedger';
import { DepositStats } from './components/DepositStats';
import { GoogleSheetsBar } from './components/GoogleSheetsBar';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { initAuth, googleSignIn, logoutGoogle, getSavedAccessToken, getSavedUser } from './services/googleAuth';
import { 
  appendRecordToSheet, 
  batchAppendRecordsToSheet, 
  getAppsScriptUrl, 
  appendRecordViaAppsScript,
  batchAppendViaAppsScript
} from './services/googleSheets';
import { User } from 'firebase/auth';

const STORAGE_KEY = 'doe_foreign_worker_deposits_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<'form' | 'ledger' | 'stats'>('form');
  const [records, setRecords] = useState<DepositRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load records from storage', e);
    }
    return INITIAL_RECORDS;
  });

  const [selectedReceipt, setSelectedReceipt] = useState<DepositRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Google Auth & Sheets Access Token (Persistently locked)
  const [user, setUser] = useState<User | null>(() => getSavedUser());
  const [accessToken, setAccessToken] = useState<string | null>(() => getSavedAccessToken());

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

  const handleDeleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    showToast('ลบรายการบันทึกเรียบร้อยแล้ว');
  };

  const handlePullFromSheet = (sheetRecords: DepositRecord[]) => {
    setRecords((prev) => {
      const existingReqNums = new Set(prev.map((r) => r.requestNumber));
      const newItems = sheetRecords.filter((r) => !existingReqNums.has(r.requestNumber));
      if (newItems.length === 0) {
        showToast('ข้อมูลในเครื่องเป็นปัจจุบันแล้ว');
        return prev;
      }
      showToast(`เพิ่มข้อมูลใหม่จาก Google Sheet เข้ามา ${newItems.length} รายการ`);
      return [...newItems, ...prev];
    });
  };

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-800 flex flex-col font-sans">
      
      {/* Top Bar Contract (Single row, 3 zones) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Zone 1: Wordmark / Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold shadow-xs">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); setActiveTab('form'); }} 
              className="text-base sm:text-lg font-bold tracking-tight text-slate-900 hover:text-blue-700 transition"
            >
              ระบบบันทึกเงินหลักประกันคนต่างด้าว
            </a>
          </div>

          {/* Zone 2: Navigation Links / Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('form')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FileEdit className="w-4 h-4" />
              <span>แบบฟอร์มบันทึก</span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <TableProperties className="w-4 h-4" />
              <span>ทะเบียนข้อมูล</span>
              <span className="ml-1 text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700">
                {records.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition cursor-pointer ${
                activeTab === 'stats'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>สถิติ & รายงาน</span>
            </button>
          </nav>

          {/* Zone 3: Actions */}
          <div className="flex items-center gap-2">
            <PWAInstallButton />

            <button
              onClick={() => setActiveTab('form')}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">สร้างรายการใหม่</span>
              <span className="sm:hidden">บันทึก</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-6 px-4 sm:px-6">
        {/* Google Sheets Connection & Sync Bar */}
        <GoogleSheetsBar
          user={user}
          accessToken={accessToken}
          records={records}
          onLogin={handleGoogleLogin}
          onLogout={handleGoogleLogout}
          onNotify={showToast}
          onPullFromSheet={handlePullFromSheet}
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
            <DepositStats records={records} />
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500">
        ระบบบันทึกการชำระเงินค่าวางหลักประกันแรงงานต่างด้าว · กรมการจัดหางาน กระทรวงแรงงาน
      </footer>

    </div>
  );
}
