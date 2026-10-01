import { DepositRecord } from '../types/deposit';
import { formatToBuddhistDate, formatToBuddhistDateTime } from '../utils/thaiBahtText';

export const SPREADSHEET_ID = '1iHFYiENrsCO63VpYP23DBkHqxQwCCEv188v61-hCE4I';

export const SHEET_HEADERS = [
  'ลำดับที่',
  'วันที่ชำระเงิน',
  'เลขที่คำขอ',
  'เล่มที่ใบเสร็จ',
  'เลขที่ใบเสร็จ',
  'ประเภทนายจ้าง',
  'เลขประจำตัวผู้เสียภาษี/บัตรประชาชน',
  'ชื่อนายจ้าง/สถานประกอบการ',
  'เบอร์โทรศัพท์',
  'ประเภทคนต่างด้าว',
  'จำนวนแรงงาน (คน)',
  'อัตราต่อคน (บาท)',
  'จำนวนเงินรวม (บาท)',
  'จำนวนเงินตัวอักษร',
  'เลขประจำตัวคนต่างด้าว (13 หลัก)',
  'ชื่อ-นามสกุลคนต่างด้าว',
  'สัญชาติ',
  'สำนักงานจัดหางานที่รับคำขอ',
  'เจ้าหน้าที่ผู้รับเงิน',
  'ตำแหน่งเจ้าหน้าที่',
  'หมายเหตุ',
  'Timestamp',
];

/**
 * Helper to fetch with exponential backoff retry for high-concurrency requests
 */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, baseDelay = 800): Promise<Response> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const res = await fetch(url, options);
      // Retry on HTTP 429 (Rate Limit) or 5xx (Google Server Busy)
      if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
        attempt++;
        if (attempt >= maxRetries) return res;
        const jitter = Math.floor(Math.random() * 400);
        const delay = baseDelay * Math.pow(2, attempt - 1) + jitter;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      return res;
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return fetch(url, options);
}

/**
 * Escape sheet title with single quotes to support Thai, spaces, and special characters
 */
export function escapeSheetTitle(title: string): string {
  const clean = title.replace(/^'|'$/g, '');
  return `'${clean.replace(/'/g, "''")}'`;
}

/**
 * Fetch spreadsheet metadata to get the first sheet's title
 * (Avoid hardcoding 'Sheet1' per best practices)
 */
export async function getFirstSheetTitle(accessToken: string, spreadsheetId: string = SPREADSHEET_ID): Promise<string> {
  const res = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const rawMsg = errorData.error?.message || '';
    if (res.status === 403 || rawMsg.toLowerCase().includes('insufficient')) {
      throw new Error('สิทธิ์การเข้าถึง Google Sheets ไม่เพียงพอ กรุณากดเชื่อมต่อ Google Sheets ใหม่อีกครั้งและทำเครื่องหมายยินยอมให้สิทธิ์');
    }
    throw new Error(rawMsg || `ไม่สามารถเข้าถึง Google Sheet (${res.status})`);
  }

  const data = await res.json();
  const sheets = data.sheets || [];
  if (sheets.length === 0 || !sheets[0]?.properties?.title) {
    return 'Sheet1';
  }
  return sheets[0].properties.title;
}

/**
 * Ensure sheet has headers in row 1 if empty
 */
export async function ensureHeaders(
  accessToken: string,
  sheetTitle: string,
  spreadsheetId: string = SPREADSHEET_ID
): Promise<number> {
  const quotedSheet = escapeSheetTitle(sheetTitle);
  // Read row 1 broadly (A1:Z1) to inspect current headers
  const range = `${quotedSheet}!A1:Z1`;
  const res = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const rawMsg = errorData.error?.message || '';
    if (res.status === 403 || rawMsg.toLowerCase().includes('insufficient')) {
      throw new Error('สิทธิ์การเข้าถึง Google Sheets ไม่เพียงพอ กรุณากดเชื่อมต่อ Google Sheets ใหม่อีกครั้งและทำเครื่องหมายยินยอมให้สิทธิ์');
    }
    throw new Error(rawMsg || 'ไม่สามารถตรวจสอบหัวตาราง Google Sheet ได้');
  }

  const data = await res.json();
  const values = data.values || [];
  const currentHeaders = values[0] || [];

  // Check if row 1 is empty or does NOT match the latest SHEET_HEADERS
  // (e.g. contains outdated columns like 'ช่องทางการชำระเงิน' or 'ที่ตั้งสถานที่ทำงาน' or missing 'ประเภทนายจ้าง')
  const needsHeaderUpdate = 
    currentHeaders.length === 0 ||
    currentHeaders.includes('ช่องทางการชำระเงิน') ||
    currentHeaders.includes('ที่ตั้งสถานที่ทำงาน') ||
    !currentHeaders.includes('ประเภทนายจ้าง') ||
    currentHeaders.length !== SHEET_HEADERS.length ||
    JSON.stringify(currentHeaders.slice(0, SHEET_HEADERS.length)) !== JSON.stringify(SHEET_HEADERS);

  if (needsHeaderUpdate) {
    // 1. Clear old row 1 from A1:Z1 so obsolete columns (e.g. old W, X, Y) are erased
    await fetchWithRetry(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${quotedSheet}!A1:Z1`)}:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    ).catch(() => {});

    // 2. Write exact new headers to A1:V1
    await fetchWithRetry(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${quotedSheet}!A1:V1`)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [SHEET_HEADERS],
        }),
      }
    );
  }

  // Get current row count to calculate next sequence number
  const colARange = `${quotedSheet}!A:A`;
  const colRes = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(colARange)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (colRes.ok) {
    const colData = await colRes.json();
    const rows = colData.values || [];
    // If rows <= 1 (only header or none), next sequence is 1
    return Math.max(1, rows.length);
  }

  return 1;
}

/**
 * Force rewrite headers in Google Sheet row 1 to match latest 22 columns
 */
export async function forceUpdateSheetHeaders(
  accessToken: string,
  spreadsheetId: string = SPREADSHEET_ID
): Promise<string> {
  const sheetTitle = await getFirstSheetTitle(accessToken, spreadsheetId);
  const quotedSheet = escapeSheetTitle(sheetTitle);

  // Clear existing row 1 (A1:Z1)
  await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${quotedSheet}!A1:Z1`)}:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  ).catch(() => {});

  // Write current SHEET_HEADERS to A1:V1
  const res = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${quotedSheet}!A1:V1`)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [SHEET_HEADERS],
      }),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'ไม่สามารถอัปเดตหัวตารางได้');
  }

  return sheetTitle;
}

/**
 * Format a DepositRecord into row values matching the requested columns.
 * For Column 1 (ลำดับที่): We use the Google Sheet formula `=ROW()-1`
 * so that Google's server computes the sequential number automatically
 * upon append, guaranteeing ZERO duplicates even during simultaneous concurrent writes!
 */
export function formatRecordToRow(record: DepositRecord, fallbackSeq: number = 1): (string | number)[] {
  // Format separate worker columns: ID Card Numbers, Names, and Nationalities
  const workers = record.workers || [];
  let workerIdsStr = '-';
  let workerNamesStr = '-';
  let workerNationalitiesStr = '-';

  if (workers.length === 1) {
    workerIdsStr = workers[0].idCardNumber || '-';
    workerNamesStr = workers[0].name || '-';
    workerNationalitiesStr = workers[0].nationality || '-';
  } else if (workers.length > 1) {
    workerIdsStr = workers.map((w, idx) => `${idx + 1}. ${w.idCardNumber || '-'}`).join('\n');
    workerNamesStr = workers.map((w, idx) => `${idx + 1}. ${w.name || '-'}`).join('\n');
    workerNationalitiesStr = workers.map((w, idx) => `${idx + 1}. ${w.nationality || '-'}`).join('\n');
  }

  // Determine employer type explicitly
  const employerType = 
    record.employerType === 'company' 
      ? 'นิติบุคคล' 
      : record.employerType === 'individual'
        ? 'บุคคลธรรมดา'
        : (record.companyName || record.companyId ? 'นิติบุคคล' : 'บุคคลธรรมดา');

  // Format date in Buddhist Era (พ.ศ.) e.g. 01/10/2569
  const buddhistPaymentDate = formatToBuddhistDate(record.paymentDate);

  // Generate current timestamp in Thai Buddhist Era format
  const timestamp = formatToBuddhistDateTime(new Date());

  return [
    '=ROW()-1',                                          // 1. คอลัมน์แรก: สูตร =ROW()-1 รันลำดับที่อัตโนมัติบน Google Server ปลอดภัยจาก concurrency 100%
    buddhistPaymentDate || '',                           // 2. วันที่ชำระเงิน (พ.ศ. เช่น 01/10/2569)
    record.requestNumber || '',                          // 3. เลขที่คำขอ
    record.receiptBook || '',                            // 4. เล่มที่ใบเสร็จ
    record.receiptNumber || '',                          // 5. เลขที่ใบเสร็จ
    employerType,                                        // 6. ประเภทนายจ้าง (บุคคลธรรมดา / นิติบุคคล)
    record.idCardNumber || '',                           // 7. เลขประจำตัวผู้เสียภาษี/บัตรประชาชน
    record.employerName || '',                           // 8. ชื่อนายจ้าง/สถานประกอบการ
    record.phoneNumber || '',                            // 9. เบอร์โทรศัพท์
    record.alienCategory || '',                          // 10. ประเภทคนต่างด้าว
    record.alienCount || 0,                              // 11. จำนวนคน
    record.ratePerPerson || 1000,                        // 12. อัตราต่อคน (บาท)
    record.totalAmount || 0,                             // 13. จำนวนเงินรวม (บาท)
    record.thaiBahtText || '',                           // 14. จำนวนเงินตัวอักษร
    workerIdsStr,                                        // 15. เลขประจำตัวคนต่างด้าว (13 หลัก)
    workerNamesStr,                                      // 16. ชื่อ-นามสกุลคนต่างด้าว
    workerNationalitiesStr,                              // 17. สัญชาติ
    record.employmentOffice || '',                       // 18. สำนักงานจัดหางานที่รับคำขอ
    record.officerName || '',                            // 19. เจ้าหน้าที่ผู้รับเงิน
    record.officerPosition || '',                        // 20. ตำแหน่งเจ้าหน้าที่
    record.notes || '',                                  // 21. หมายเหตุ
    timestamp,                                           // 22. คอลัมน์สุดท้าย: Time stamp (พ.ศ.)
  ];
}

/**
 * Append a single deposit record to Google Sheets
 */
export async function appendRecordToSheet(
  accessToken: string,
  record: DepositRecord,
  spreadsheetId: string = SPREADSHEET_ID
): Promise<{ sequenceNumber: number; sheetTitle: string }> {
  const sheetTitle = await getFirstSheetTitle(accessToken, spreadsheetId);
  const nextSeq = await ensureHeaders(accessToken, sheetTitle, spreadsheetId);

  const rowData = formatRecordToRow(record, nextSeq);
  const quotedSheet = escapeSheetTitle(sheetTitle);

  // Use values:append without forced INSERT_ROWS so it fills the next available empty row directly
  const appendRange = `${quotedSheet}!A:V`;
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED`;

  const appendRes = await fetchWithRetry(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowData],
    }),
  });

  if (!appendRes.ok) {
    const errorData = await appendRes.json().catch(() => ({}));
    const rawMsg = errorData.error?.message || '';
    if (appendRes.status === 403 || rawMsg.toLowerCase().includes('insufficient')) {
      throw new Error('สิทธิ์การเข้าถึง Google Sheets ไม่เพียงพอ กรุณากดเชื่อมต่อ Google Sheets ใหม่อีกครั้งและทำเครื่องหมายยินยอมให้สิทธิ์');
    }
    throw new Error(rawMsg || 'ไม่สามารถบันทึกข้อมูลลง Google Sheet ได้');
  }

  // Parse updatedRange from Google response (e.g. "'Sheet1'!A6:V6") to get exact row number
  let exactRowSeq = nextSeq;
  try {
    const appendData = await appendRes.json();
    const updatedRange = appendData.updates?.updatedRange || '';
    const match = updatedRange.match(/A(\d+)/);
    if (match && match[1]) {
      exactRowSeq = Math.max(1, parseInt(match[1], 10) - 1);
    }
  } catch (e) {
    // fallback to estimated nextSeq
  }

  return { sequenceNumber: exactRowSeq, sheetTitle };
}

/**
 * Batch append multiple deposit records to Google Sheets
 */
export async function batchAppendRecordsToSheet(
  accessToken: string,
  records: DepositRecord[],
  spreadsheetId: string = SPREADSHEET_ID
): Promise<{ count: number; sheetTitle: string }> {
  if (records.length === 0) return { count: 0, sheetTitle: '' };

  const sheetTitle = await getFirstSheetTitle(accessToken, spreadsheetId);
  let nextSeq = await ensureHeaders(accessToken, sheetTitle, spreadsheetId);

  const rows = records.map((rec) => {
    const row = formatRecordToRow(rec, nextSeq);
    nextSeq++;
    return row;
  });

  const quotedSheet = escapeSheetTitle(sheetTitle);
  const appendRange = `${quotedSheet}!A:V`;
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED`;

  const appendRes = await fetchWithRetry(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: rows,
    }),
  });

  if (!appendRes.ok) {
    const errorData = await appendRes.json().catch(() => ({}));
    const rawMsg = errorData.error?.message || '';
    if (appendRes.status === 403 || rawMsg.toLowerCase().includes('insufficient')) {
      throw new Error('สิทธิ์การเข้าถึง Google Sheets ไม่เพียงพอ กรุณากดเชื่อมต่อ Google Sheets ใหม่อีกครั้งและทำเครื่องหมายยินยอมให้สิทธิ์');
    }
    throw new Error(rawMsg || 'ไม่สามารถบันทึกข้อมูลลง Google Sheet ได้');
  }

  return { count: records.length, sheetTitle };
}

/**
 * Fetch all records from Google Sheet to sync live data across multiple officers/devices
 */
export async function fetchRecordsFromSheet(
  accessToken: string,
  spreadsheetId: string = SPREADSHEET_ID
): Promise<DepositRecord[]> {
  const sheetTitle = await getFirstSheetTitle(accessToken, spreadsheetId);
  const quotedSheet = escapeSheetTitle(sheetTitle);
  const range = `${quotedSheet}!A2:V`; // Skip header row
  const res = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  const rows = data.values || [];

  return rows.map((row: any[], index: number): DepositRecord => {
    const ids = (row[14] || '').split('\n').map((s: string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    const names = (row[15] || '').split('\n').map((s: string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    const nats = (row[16] || '').split('\n').map((s: string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    
    const count = parseInt(row[10], 10) || 1;
    const workers = [];
    for (let i = 0; i < Math.max(names.length, ids.length, 1); i++) {
      if (names[i] || ids[i]) {
        workers.push({
          id: `w-sheet-${index}-${i}`,
          idCardNumber: ids[i] || '',
          name: names[i] || '',
          nationality: nats[i] || 'เมียนมา (Myanmar)',
        });
      }
    }

    return {
      id: `sheet-rec-${index}-${row[2] || Date.now()}`,
      paymentDate: row[1] || '',
      requestNumber: row[2] || '',
      receiptBook: row[3] || '',
      receiptNumber: row[4] || '',
      employerType: row[5] === 'นิติบุคคล' ? 'company' : 'individual',
      idCardNumber: row[6] || '',
      employerName: row[7] || '',
      phoneNumber: row[8] || '',
      alienCategory: row[9] || '',
      alienCount: count,
      ratePerPerson: parseInt(row[11], 10) || 1000,
      totalAmount: parseInt(row[12], 10) || 1000,
      thaiBahtText: row[13] || '',
      workers,
      employmentOffice: row[17] || '',
      officerName: row[18] || '',
      officerPosition: row[19] || '',
      notes: row[20] || '',
      createdAt: row[21] || new Date().toISOString(),
    };
  });
}

/**
 * Built-in Google Apps Script Web App Webhook URL
 * (Allows ANY user to record to Google Sheets with 0 logins needed)
 */
export const BUILT_IN_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRvIhWmhXs3bjiy6-7l7mp1B--Nj8CeDyTS5HeorL11KGLBJG4XpxIK4uG4_Wr_QAemg/exec';

export const APPS_SCRIPT_STORAGE_KEY = 'foreign_worker_apps_script_url';

export const getAppsScriptUrl = (): string | null => {
  try {
    const custom = localStorage.getItem(APPS_SCRIPT_STORAGE_KEY);
    if (custom && custom.trim()) return custom.trim();
  } catch (e) {
    // ignore
  }
  return BUILT_IN_APPS_SCRIPT_URL;
};

export const setAppsScriptUrl = (url: string | null) => {
  try {
    if (url && url.trim()) {
      localStorage.setItem(APPS_SCRIPT_STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(APPS_SCRIPT_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Error saving apps script url', e);
  }
};

/**
 * Append record using Google Apps Script Webhook
 * ZERO LOGIN REQUIRED from any user or any device!
 */
export async function appendRecordViaAppsScript(
  scriptUrl: string,
  record: DepositRecord
): Promise<{ status: string }> {
  const rowData = formatRecordToRow(record, 1);
  const payload = {
    action: 'append',
    record,
    row: rowData,
  };

  await fetch(scriptUrl, {
    method: 'POST',
    mode: 'no-cors', // Standard cross-origin pattern for Google Apps Script Web Apps
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  return { status: 'success' };
}

/**
 * Batch append multiple records via Google Apps Script Webhook
 */
export async function batchAppendViaAppsScript(
  scriptUrl: string,
  records: DepositRecord[]
): Promise<number> {
  let count = 0;
  for (const record of records) {
    await appendRecordViaAppsScript(scriptUrl, record);
    count++;
    await new Promise((r) => setTimeout(r, 200));
  }
  return count;
}

