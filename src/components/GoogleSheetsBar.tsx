import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  UserCheck,
  ShieldCheck,
  ArrowRight,
  Download,
  Settings2,
  Copy,
  Check,
  X,
  Globe,
  EyeOff
} from 'lucide-react';
import { User } from 'firebase/auth';
import { 
  SPREADSHEET_ID, 
  batchAppendRecordsToSheet, 
  fetchRecordsFromSheet,
  getAppsScriptUrl,
  setAppsScriptUrl,
  batchAppendViaAppsScript,
  forceUpdateSheetHeaders
} from '../services/googleSheets';
import { DepositRecord } from '../types/deposit';

interface GoogleSheetsBarProps {
  user: User | null;
  accessToken: string | null;
  records: DepositRecord[];
  onLogin: () => void;
  onLogout: () => void;
  onNotify: (msg: string) => void;
  onPullFromSheet?: (records: DepositRecord[]) => void;
  onWebhookChange?: (url: string | null) => void;
  showWebhookModal?: boolean;
  onCloseWebhookModal?: () => void;
  onOpenWebhookModal?: () => void;
  isAdminUnlocked?: boolean;
  onLockAdmin?: () => void;
}

export const GoogleSheetsBar: React.FC<GoogleSheetsBarProps> = ({
  user,
  accessToken,
  records,
  onLogin,
  onLogout,
  onNotify,
  onPullFromSheet,
  onWebhookChange,
  showWebhookModal: showWebhookModalProp,
  onCloseWebhookModal,
  onOpenWebhookModal,
  isAdminUnlocked = false,
  onLockAdmin,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [showConfirmSync, setShowConfirmSync] = useState(false);
  const [syncResult, setSyncResult] = useState<{ count: number; sheetTitle: string } | null>(null);

  // Webhook state (Default false until password unlocked)
  const [internalShowWebhookModal, setInternalShowWebhookModal] = useState(false);
  const showWebhookModal = showWebhookModalProp !== undefined ? showWebhookModalProp : internalShowWebhookModal;
  const setShowWebhookModal = (open: boolean) => {
    if (!open && onCloseWebhookModal) onCloseWebhookModal();
    if (open && onOpenWebhookModal) onOpenWebhookModal();
    setInternalShowWebhookModal(open);
  };

  const [inputUrl, setInputUrl] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [webhookUrl, setWebhookState] = useState<string | null>(() => getAppsScriptUrl());

  useEffect(() => {
    setInputUrl(webhookUrl || '');
  }, [webhookUrl]);

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;

  const appsScriptSnippet = `function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var data = sheet.getDataRange().getValues();
    // ตัดแถวหัวตารางออก
    var rows = data.length > 1 ? data.slice(1) : [];
    return ContentService.createTextOutput(JSON.stringify({ status: "success", values: rows }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    // ตรวจสอบหัวตารางถ้าเพิ่งสร้างใหม่
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'ลำดับที่', 'วันที่ชำระเงิน', 'เลขที่คำขอ', 'เล่มที่ใบเสร็จ', 'เลขที่ใบเสร็จ',
        'ประเภทนายจ้าง', 'เลขประจำตัวผู้เสียภาษี/บัตรประชาชน',
        'ชื่อนายจ้าง/สถานประกอบการ', 'เบอร์โทรศัพท์',
        'ประเภทคนต่างด้าว', 'จำนวนแรงงาน (คน)', 'อัตราต่อคน (บาท)', 'จำนวนเงินรวม (บาท)',
        'จำนวนเงินตัวอักษร', 'เลขประจำตัวคนต่างด้าว (13 หลัก)', 'ชื่อ-นามสกุลคนต่างด้าว', 'สัญชาติ',
        'สำนักงานจัดหางานที่รับคำขอ', 'เจ้าหน้าที่ผู้รับเงิน', 'ตำแหน่งเจ้าหน้าที่', 'หมายเหตุ', 'Timestamp'
      ]);
    }
    
    var lastRow = sheet.getLastRow();
    var row = data.row || [];
    if (row.length > 0) {
      row[0] = lastRow; // ลำดับที่รันอัตโนมัติตามแถว
    }
    
    sheet.appendRow(row);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", row: lastRow }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const [isUpdatingHeaders, setIsUpdatingHeaders] = useState(false);

  const handleUpdateHeaders = async () => {
    if (!accessToken) {
      onLogin();
      return;
    }
    setIsUpdatingHeaders(true);
    try {
      await forceUpdateSheetHeaders(accessToken, SPREADSHEET_ID);
      onNotify('อัปเดตหัวตารางใน Google Sheet เป็น 22 คอลัมน์ (มี "ประเภทนายจ้าง" และลบ "ช่องทางการชำระเงิน" / "ที่ตั้งสถานที่ทำงาน" ออกแล้ว) เรียบร้อยครับ!');
    } catch (err: any) {
      onNotify('เกิดข้อผิดพลาดในการอัปเดตหัวตาราง: ' + (err.message || 'โปรดลองใหม่อีกครั้ง'));
    } finally {
      setIsUpdatingHeaders(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(appsScriptSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
    onNotify('คัดลอกโค้ด Google Apps Script แล้ว นำไปวางในสเปรดชีตได้เลย');
  };

  const handleSaveWebhook = () => {
    const trimmed = inputUrl.trim();
    setAppsScriptUrl(trimmed || null);
    setWebhookState(trimmed || null);
    if (onWebhookChange) onWebhookChange(trimmed || null);
    setShowWebhookModal(false);
    if (trimmed) {
      onNotify('เปิดใช้งานโหมด Webhook แล้ว! ตอนนี้ผู้ใช้งานทุกคนสามารถบันทึกเข้า Sheet ได้ทันทีโดยไม่ต้องล็อกอิน Google');
    } else {
      onNotify('ยกเลิกโหมด Webhook แล้ว (กลับมาใช้โหมด Google Login ปกติ)');
    }
  };

  const handlePullRecords = async () => {
    if (!accessToken) {
      onLogin();
      return;
    }
    setIsPulling(true);
    try {
      const sheetRecords = await fetchRecordsFromSheet(accessToken, SPREADSHEET_ID);
      if (sheetRecords.length > 0 && onPullFromSheet) {
        onPullFromSheet(sheetRecords);
        onNotify(`ดึงข้อมูลจาก Google Sheet สำเร็จ (${sheetRecords.length} รายการ)`);
      } else {
        onNotify('ไม่พบรายการข้อมูลใน Google Sheet หรือตารางว่าง');
      }
    } catch (err: any) {
      onNotify(`ดึงข้อมูลไม่สำเร็จ: ${err.message || 'โปรดลองใหม่'}`);
    } finally {
      setIsPulling(false);
    }
  };

  const handleSyncAll = async () => {
    if (records.length === 0) {
      onNotify('ไม่มีรายการข้อมูลที่จะส่งลง Google Sheet');
      return;
    }

    setShowConfirmSync(false);
    setIsSyncing(true);
    try {
      if (webhookUrl) {
        const count = await batchAppendViaAppsScript(webhookUrl, records);
        onNotify(`ส่งข้อมูลทั้งหมด ${count} รายการลง Google Sheet ผ่าน Webhook เรียบร้อยแล้ว`);
      } else if (accessToken) {
        const result = await batchAppendRecordsToSheet(accessToken, records, SPREADSHEET_ID);
        setSyncResult(result);
        onNotify(`ส่งข้อมูลทั้งหมด ${result.count} รายการลง Google Sheet เรียบร้อยแล้ว`);
        setTimeout(() => setSyncResult(null), 5000);
      } else {
        onLogin();
      }
    } catch (err: any) {
      console.error('Sync failed:', err);
      const errMsg = err.message || '';
      if (errMsg.includes('สิทธิ์การเข้าถึง') || errMsg.toLowerCase().includes('insufficient')) {
        onNotify('สิทธิ์การเข้าถึง Google Sheets ไม่เพียงพอ กรุณากดปุ่มเชื่อมต่อ Google Sheets ใหม่อีกครั้งเพื่ออนุญาตสิทธิ์');
        onLogout();
      } else {
        onNotify(`เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheet: ${errMsg || 'โปรดลองใหม่'}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6">
      {isAdminUnlocked && (
        <div className="bg-white rounded-xl border border-emerald-200/90 shadow-xs p-3.5 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
        
        {/* Left: Google Sheets connection info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 shadow-2xs">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                Google Sheets Integration
              </h3>
              {webhookUrl ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300/60 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  เชื่อมต่อสเปรดชีตถาวร (บันทึกอัตโนมัติ ไม่ต้องกดเชื่อมต่อ)
                </span>
              ) : accessToken ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300/60 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ล็อคการเชื่อมต่อถาวร (Auto-Sync ตลอดเวลา)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                  รอการเชื่อมต่อ (กด 1 ครั้งเพื่อล็อคถาวร)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
              <span>ID: <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded text-slate-700">{SPREADSHEET_ID.substring(0, 14)}...</code></span>
              <span>•</span>
              <span className="text-slate-600">คอลัมน์แรก = ลำดับที่ (รันอัตโนมัติ)</span>
              <span>•</span>
              <span className="text-slate-600">คอลัมน์สุดท้าย = Timestamp</span>
              <span>•</span>
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold underline underline-offset-2 hover:opacity-80 transition"
              >
                เปิดดูสเปรดชีต
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {/* Sync all records button (Available whenever connected via Webhook or OAuth) */}
          {(webhookUrl || accessToken) && (
            <button
              type="button"
              onClick={() => setShowConfirmSync(true)}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
              title="ส่งข้อมูลคำขอทั้งหมดที่มีในระบบลง Google Sheet"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'กำลังบันทึกลง Sheet...' : `ซิงค์ทั้งหมดลง Sheet (${records.length})`}</span>
            </button>
          )}

          {/* Settings button to configure Webhook */}
          <button
            type="button"
            onClick={() => setShowWebhookModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-50 text-purple-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
            title="ตั้งค่าให้ผู้ใช้งานทุกคนบันทึกเข้า Google Sheet ได้ทันทีโดยไม่ต้องกดเชื่อมต่อ Google"
          >
            <Settings2 className="w-3.5 h-3.5 text-purple-600" />
            <span>{webhookUrl ? 'จัดการ Webhook' : 'ให้ทุกคนบันทึกได้ไม่ต้องล็อกอิน'}</span>
          </button>

          {accessToken ? (
            <>
              {/* Force Update headers in sheet */}
              <button
                type="button"
                onClick={handleUpdateHeaders}
                disabled={isUpdatingHeaders}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold shadow-2xs transition disabled:opacity-50 cursor-pointer"
                title="รีเซ็ต/อัปเดตหัวตารางแถวที่ 1 ใน Google Sheet ให้มี 'ประเภทนายจ้าง' และลบ 'ช่องทางการชำระเงิน' / 'ที่ตั้งสถานที่ทำงาน' ออกทันที"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isUpdatingHeaders ? 'animate-spin' : ''}`} />
                <span>{isUpdatingHeaders ? 'กำลังอัปเดตหัวตาราง...' : 'อัปเดตหัวตาราง Sheet'}</span>
              </button>

              {/* Pull records from Sheet button */}
              <button
                type="button"
                onClick={handlePullRecords}
                disabled={isPulling}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition disabled:opacity-50 cursor-pointer"
                title="ดึงข้อมูลคำขอที่ผู้อื่นบันทึกไว้ใน Google Sheet มาแสดงบนเครื่องนี้"
              >
                <Download className={`w-3.5 h-3.5 text-slate-500 ${isPulling ? 'animate-bounce' : ''}`} />
                <span>{isPulling ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูลจาก Sheet'}</span>
              </button>

              {/* User display badge */}
              <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-medium">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-4 h-4 rounded-full" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span className="max-w-[120px] truncate">{user?.displayName || user?.email || 'บัญชี Google'}</span>
              </div>

              {/* Logout button */}
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                title="ตัดการเชื่อมต่อ Google"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Pull button available even before login (will prompt login & pull) */}
              <button
                type="button"
                onClick={async () => {
                  await onLogin();
                }}
                disabled={isPulling}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50/70 hover:bg-blue-100 text-blue-800 text-xs font-semibold shadow-2xs transition cursor-pointer"
                title="ดึงข้อมูลคำขอจาก Google Sheet มาอัปเดตบนเครื่องนี้"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>ดึงข้อมูลจาก Sheet</span>
              </button>

              {/* Official Google Sign-in button style */}
              <button
                type="button"
                onClick={onLogin}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
                <span>เชื่อมต่อ Google Sheets</span>
              </button>
            </div>
          )}

          {/* Lock / Hide button */}
          {onLockAdmin && (
            <button
              type="button"
              onClick={onLockAdmin}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 text-xs font-semibold shadow-2xs transition cursor-pointer"
              title="ซ่อนหัวข้อการเชื่อมต่อนี้ (ต้องระบุรหัสผ่านใหม่อีกครั้งเมื่อต้องการเปิด)"
            >
              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
              <span>ซ่อนหัวข้อนี้</span>
            </button>
          )}
        </div>

      </div>
    )}

      {/* Webhook Configuration Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-purple-700 font-bold text-base">
                <Globe className="w-5 h-5 text-purple-600" />
                <span>ตั้งค่าให้ผู้ใช้ทุกคนบันทึกได้ทันที โดยไม่ต้องล็อกอิน Google</span>
              </div>
              <button
                type="button"
                onClick={() => setShowWebhookModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-600">
              <p className="text-slate-700 leading-relaxed">
                ตามระบบมาตรฐานของ Google หากใช้ Google OAuth แต่ละคนจะต้องล็อกอินบัญชี Google ของตนเอง <strong className="text-purple-700 font-bold">แต่ถ้าต้องการให้เป็น Web App สาธารณะที่เจ้าหน้าที่ทุกคนเปิดเข้ามาแล้วกรอกข้อมูลส่งเข้า Google Sheet ได้ทันที 100% โดยไม่ต้องล็อกอิน</strong> สามารถเปิดใช้งานผ่าน <strong>Google Apps Script Webhook</strong> ตาม 4 ขั้นตอนนี้ครับ:
              </p>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">1</span>
                  <div>
                    <span className="font-semibold text-slate-800">เปิด Google Sheet:</span> ไปที่เมนู <span className="font-semibold text-purple-700">ส่วนขยาย (Extensions)</span> &gt; <span className="font-semibold text-purple-700">Apps Script</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">2</span>
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-slate-800">ลบโค้ดเดิม แล้วนำโค้ดนี้ไปวาง:</span>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                      >
                        {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedCode ? 'คัดลอกแล้ว!' : 'คัดลอกโค้ด'}</span>
                      </button>
                    </div>
                    <pre className="bg-slate-900 text-purple-200 p-3 rounded-lg text-[11px] overflow-x-auto font-mono max-h-36 border border-slate-800">
                      {appsScriptSnippet}
                    </pre>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">3</span>
                  <div>
                    <span className="font-semibold text-slate-800">กด Deploy (ทำให้ใช้งานได้):</span>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5 text-slate-600">
                      <li>กดปุ่มสีน้ำเงิน <strong>ทำให้ใช้งานได้ (Deploy)</strong> &gt; <strong>การทำให้ใช้งานได้ใหม่ (New deployment)</strong></li>
                      <li>เลือกประเภท: <strong>เว็บแอป (Web app)</strong></li>
                      <li>การดำเนินการในฐานะ (Execute as): <strong>ฉัน (Me)</strong></li>
                      <li>ผู้ที่มีสิทธิ์เข้าถึง (Who has access): <strong className="text-purple-700 font-bold">ทุกคน (Anyone)</strong> (สำคัญมาก)</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">4</span>
                  <div className="w-full">
                    <span className="font-semibold text-slate-800">นำ URL เว็บแอป (ที่ลงท้ายด้วย /exec) มาวางที่นี่:</span>
                    <input
                      type="url"
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      className="mt-1.5 w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-200">
              <div>
                {webhookUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputUrl('');
                      setAppsScriptUrl(null);
                      setWebhookState(null);
                      if (onWebhookChange) onWebhookChange(null);
                      setShowWebhookModal(false);
                      onNotify('ยกเลิก Webhook เรียบร้อยแล้ว');
                    }}
                    className="text-rose-600 hover:text-rose-700 text-xs font-medium cursor-pointer"
                  >
                    ลบ Webhook นี้
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowWebhookModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  onClick={handleSaveWebhook}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition shadow-xs cursor-pointer"
                >
                  บันทึกการตั้งค่า
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal before syncing all records (per skill requirement) */}
      {showConfirmSync && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-base">ยืนยันการส่งข้อมูลลง Google Sheet?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  จะทำการส่งข้อมูลคำขอจำนวน <strong className="text-slate-800">{records.length} รายการ</strong> ไปยังสเปรดชีต
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1 border border-slate-200/60">
              <div className="flex justify-between">
                <span>Spreadsheet ID:</span>
                <span className="font-mono text-slate-800 font-medium">{SPREADSHEET_ID}</span>
              </div>
              <div className="flex justify-between">
                <span>คอลัมน์แรก:</span>
                <span className="text-slate-800 font-medium">ลำดับที่ (รันอัตโนมัติ)</span>
              </div>
              <div className="flex justify-between">
                <span>คอลัมน์สุดท้าย:</span>
                <span className="text-slate-800 font-medium">Time Stamp</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmSync(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSyncAll}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ยืนยัน ส่งข้อมูลลง Sheet</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
