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
  EyeOff,
  RotateCcw,
  Hash
} from 'lucide-react';
import { User } from 'firebase/auth';
import { 
  SPREADSHEET_ID, 
  batchAppendRecordsToSheet, 
  fetchRecordsFromSheet,
  getAppsScriptUrl,
  setAppsScriptUrl,
  batchAppendViaAppsScript,
  forceUpdateSheetHeaders,
  restructureSheetDataToSingleWorkerRows,
  restructureViaAppsScript
} from '../services/googleSheets';
import { DepositRecord } from '../types/deposit';
import { 
  getRequestNumberConfig, 
  saveRequestNumberConfig, 
  generateSampleRequestNumber, 
  RequestNumberConfig, 
  DEFAULT_REQUEST_CONFIG 
} from '../utils/requestNumberConfig';

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
  lastSyncTime?: string;
  syncCountdown?: number;
  isAutoSyncing?: boolean;
  onClearAllRecords?: () => void;
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
  lastSyncTime,
  syncCountdown = 20,
  isAutoSyncing = false,
  onClearAllRecords,
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

  // Request number configuration state
  const [reqConfig, setReqConfig] = useState<RequestNumberConfig>(() => getRequestNumberConfig());
  const [inputPrefix, setInputPrefix] = useState(reqConfig.prefix);
  const [inputLength, setInputLength] = useState<number | string>(reqConfig.length);
  const [inputEnabled, setInputEnabled] = useState(reqConfig.enabled);

  useEffect(() => {
    if (showWebhookModal) {
      const current = getRequestNumberConfig();
      setReqConfig(current);
      setInputPrefix(current.prefix);
      setInputLength(current.length);
      setInputEnabled(current.enabled);
    }
  }, [showWebhookModal]);

  const handleResetReqConfig = () => {
    setInputPrefix(DEFAULT_REQUEST_CONFIG.prefix);
    setInputLength(DEFAULT_REQUEST_CONFIG.length);
    setInputEnabled(DEFAULT_REQUEST_CONFIG.enabled);
  };

  useEffect(() => {
    setInputUrl(webhookUrl || '');
  }, [webhookUrl]);

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;

  const appsScriptSnippet = `function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var data = sheet.getDataRange().getDisplayValues();
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
    
    // รองรับทั้งแบบแยก 1 แถวต่อแรงงาน (rows) และแบบแถวเดียวเดิม (row)
    var rows = data.rows || (data.row ? [data.row] : []);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r && r.length > 0) {
        r[0] = sheet.getLastRow(); // ลำดับที่รันตามแถวจริง
        sheet.appendRow(r);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", count: rows.length }))
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

    // บันทึกการกำหนดเงื่อนไขเลขที่คำขอ (Request Number Format Configuration)
    const parsedLength = Number(inputLength);
    const validLength = isNaN(parsedLength) || parsedLength <= 0 ? DEFAULT_REQUEST_CONFIG.length : parsedLength;
    const cleanPrefix = (inputPrefix || '').trim() || DEFAULT_REQUEST_CONFIG.prefix;
    const finalConfig: RequestNumberConfig = {
      prefix: cleanPrefix,
      length: Math.max(cleanPrefix.length, validLength),
      enabled: inputEnabled,
    };
    saveRequestNumberConfig(finalConfig);
    setReqConfig(finalConfig);

    setShowWebhookModal(false);
    if (trimmed) {
      onNotify(`บันทึกการตั้งค่า Webhook และกำหนดเลขที่คำขอ (ขึ้นต้นด้วย "${finalConfig.prefix}" จำนวน ${finalConfig.length} หลัก) เรียบร้อยแล้ว!`);
    } else {
      onNotify(`บันทึกการกำหนดเลขที่คำขอ (ขึ้นต้นด้วย "${finalConfig.prefix}" จำนวน ${finalConfig.length} หลัก) เรียบร้อยแล้ว`);
    }
  };

  const [isRestructuring, setIsRestructuring] = useState(false);

  const handleRestructureSheet = async () => {
    if (!window.confirm('คุณต้องการจัดระเบียบข้อมูลที่มีอยู่เดิมใน Google Sheet ให้แยกแถวเป็น 1 แถวต่อแรงงาน 1 คน ใช่หรือไม่?\n\n(ระบบจะอ่านข้อมูลเดิมทั้งหมดและแปลงแถวที่มีแรงงานซ้อนกันอยู่ออกมาเป็นแถวละ 1 คนอย่างเป็นระเบียบ)')) {
      return;
    }

    setIsRestructuring(true);
    try {
      if (accessToken) {
        const result = await restructureSheetDataToSingleWorkerRows(accessToken);
        onNotify(`จัดระเบียบข้อมูลเดิมใน Google Sheet เรียบร้อยแล้ว (แปลงข้อมูลเป็น ${result.newRowsCount} แถว)`);
        if (onPullFromSheet) {
          const fresh = await fetchRecordsFromSheet(accessToken);
          onPullFromSheet(fresh);
        }
      } else if (webhookUrl) {
        await restructureViaAppsScript(webhookUrl);
        onNotify('ส่งคำสั่งจัดระเบียบข้อมูลเดิมไปยัง Google Apps Script เรียบร้อยแล้ว');
      } else {
        onNotify('กรุณาเชื่อมต่อ Google Sheets หรือระบุ URL Webhook ก่อนจัดระเบียบข้อมูล');
      }
    } catch (err: any) {
      console.error(err);
      onNotify(`ไม่สามารถจัดระเบียบข้อมูลได้: ${err.message || 'โปรดลองใหม่'}`);
    } finally {
      setIsRestructuring(false);
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

            {/* Auto-Sync 20s Status inside Webhook Management */}
            <div className="mt-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${isAutoSyncing ? 'duration-500' : 'duration-1000'}`}></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                </span>
                <div>
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <span>ระบบตรวจสอบอัตโนมัติ (AUTO-SYNC)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-mono font-semibold">
                      ทุก 20 วินาที
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    ระบบดึงข้อมูลและรายงานผลล่าสุดจาก Google Sheet อัตโนมัติทุก 20 วินาที
                  </div>
                </div>
              </div>
              <div className="text-right text-[11px] font-mono text-emerald-800">
                <div>รอบถัดไปใน: <strong className="text-emerald-950 font-bold">{syncCountdown} วิ</strong></div>
                {lastSyncTime && <div className="text-[10px] text-emerald-600 font-mono">อัปเดตล่าสุด {lastSyncTime} น.</div>}
              </div>
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

              {/* กำหนดสิทธิ์รูปแบบเลขที่คำขอ: ขึ้นต้นแบบไหน และจำนวนกี่หลัก */}
              <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Hash className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>กำหนดสิทธิ์รูปแบบเลขที่คำขอ (Request Number Settings)</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                    {inputEnabled ? 'เปิดการบังคับตรวจสอบ' : 'ปิดการบังคับตรวจ'}
                  </span>
                </div>

                <div className="text-[11px] text-amber-900 leading-relaxed">
                  กำหนดตัวเลขคำขอว่าต้องขึ้นต้นด้วยรูปแบบใด และเป็นตัวเลขจำนวนกี่หลัก เพื่อป้องกันเจ้าหน้าที่คีย์ข้อมูลผิดพลาด
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* ตัวเลขคำขอขึ้นต้น */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ตัวเลขคำขอต้องขึ้นต้นด้วย (Prefix):
                    </label>
                    <input
                      type="text"
                      value={inputPrefix}
                      onChange={(e) => setInputPrefix(e.target.value.replace(/\D/g, ''))}
                      placeholder="เช่น 691"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      ค่าเริ่มต้นคือ <strong>691</strong> (ระบุเฉพาะตัวเลข)
                    </span>
                  </div>

                  {/* จำนวนหลักทั้งหมด */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      จำนวนหลักทั้งหมด (Total Digits):
                    </label>
                    <input
                      type="number"
                      min={Math.max(1, inputPrefix.length)}
                      max={30}
                      value={inputLength}
                      onChange={(e) => setInputLength(Number(e.target.value) || '')}
                      placeholder="เช่น 14"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      ค่าเริ่มต้นคือ <strong>14</strong> หลัก
                    </span>
                  </div>
                </div>

                {/* แถบตัวอย่าง Preview & Action */}
                <div className="bg-white/95 border border-amber-200 rounded-lg p-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-600 font-medium">ตัวอย่างเลขคำขอ:</span>
                    <span className="font-mono font-bold px-2 py-0.5 rounded text-[13px] bg-[#efe321] text-[#d71b0c] border border-amber-300 shadow-2xs">
                      {generateSampleRequestNumber({
                        prefix: inputPrefix || '691',
                        length: Number(inputLength) || 14,
                        enabled: inputEnabled,
                      })}
                    </span>
                    <span className="text-[11px] text-slate-600 font-mono">
                      ({Number(inputLength) || 14} หลัก)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={inputEnabled}
                        onChange={(e) => setInputEnabled(e.target.checked)}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>บังคับตรวจ</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleResetReqConfig}
                      className="text-[11px] text-amber-800 hover:text-amber-950 font-medium underline cursor-pointer"
                      title="คืนค่าเป็นขึ้นต้น 691 จำนวน 14 หลัก"
                    >
                      คืนค่าเริ่มต้น (691/14)
                    </button>
                  </div>
                </div>
              </div>

              {/* รูปแบบการจัดเก็บข้อมูล: 1 แถวต่อแรงงาน 1 คน (เปิดใช้งานถาวร ไม่ต้องเลือก) */}
              <div className="bg-indigo-50/70 border border-indigo-200/90 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>ระบบจัดเก็บข้อมูลแบบ: 1 แถวต่อแรงงาน 1 คน (Row-by-Row)</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    เปิดใช้งานถาวร
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 leading-relaxed">
                  เมื่อนายจ้าง 1 รายมีแรงงานหลายคน ระบบจะบันทึกและส่งออกแยกเป็นแถวละ 1 คนอัตโนมัติ 100% ข้อมูลไม่ซ้อนกันในเซลล์ เพื่อให้กรอง ค้นหา และคำนวณสูตร SUM ใน Excel/Google Sheet ได้อย่างถูกต้องแม่นยำ
                </div>

                {/* ปุ่มแปลงข้อมูลเดิมใน Google Sheet */}
                <div className="pt-2.5 border-t border-indigo-200/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="text-[11px] text-indigo-900 leading-snug">
                    <strong className="font-semibold text-indigo-950">ข้อมูลเดิมใน Google Sheet:</strong> หากมีแถวเก่าที่ข้อมูลแรงงานยังซ้อนกันอยู่ สามารถกดปุ่มนี้เพื่อแปลงให้แยกเป็น 1 แถวต่อคนได้ทันที
                  </div>
                  <button
                    type="button"
                    onClick={handleRestructureSheet}
                    disabled={isRestructuring}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer shrink-0 disabled:opacity-50"
                    title="อ่านแถวข้อมูลเดิมใน Google Sheet และแปลงแถวที่ซ้อนกันให้แยกออกเป็น 1 แถวต่อแรงงาน 1 คน ทั้งหมด"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-white ${isRestructuring ? 'animate-spin' : ''}`} />
                    <span>{isRestructuring ? 'กำลังจัดระเบียบ...' : 'แปลงข้อมูลเดิมใน Sheet ให้เป็น 1 แถวต่อคน'}</span>
                  </button>
                </div>
              </div>

              {/* Reset Statistics to 0 section (Moved here per user request) */}
              {onClearAllRecords && (
                <div className="bg-rose-50/70 border border-rose-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 shrink-0 mt-0.5">
                      <RotateCcw className="w-4 h-4 text-rose-600" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                        <span>รีเซ็ตสถิติ:</span>
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded-full border border-rose-200">
                          รีเซ็ตเป็น 0
                        </span>
                      </div>
                      <div className="text-[11px] text-rose-700/90 mt-0.5 leading-relaxed">
                        หากลบข้อมูลใน Google Sheet แล้วต้องการให้ตัวเลขสถิติภาพรวมในระบบเป็น 0 ทันที
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllRecords();
                      setShowWebhookModal(false);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-rose-50 active:scale-95 text-rose-700 hover:text-rose-800 border border-rose-300 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer shrink-0"
                    title="หากลบข้อมูลใน Google Sheet แล้วต้องการให้ตัวเลขสถิติในระบบเป็น 0 ทันที"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>รีเซ็ตเป็น 0</span>
                  </button>
                </div>
              )}
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
