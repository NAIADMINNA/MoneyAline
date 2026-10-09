import { DepositRecord, ForeignWorker } from '../types/deposit';
import { 
  formatToBuddhistDate, 
  formatToBuddhistDateTime, 
  numberToThaiBahtText,
  normalizePaymentDateToIso 
} from '../utils/thaiBahtText';
import { clearExpiredToken } from './googleAuth';

export const WORKER_STORAGE_MODE_KEY = 'doe_worker_storage_mode';

/**
 * Get whether to store foreign workers as 1 row per worker ('split') or combined in 1 row ('single')
 * Default: 'split' (แยก 1 แถวต่อแรงงาน 1 คน เพื่อไม่ให้ข้อมูลซ้อนกันในเซลล์)
 */
export function getWorkerStorageMode(): 'split' | 'single' {
  try {
    const saved = localStorage.getItem(WORKER_STORAGE_MODE_KEY);
    if (saved === 'single') return 'single';
  } catch {}
  return 'split';
}

export function setWorkerStorageMode(mode: 'split' | 'single') {
  try {
    localStorage.setItem(WORKER_STORAGE_MODE_KEY, mode);
  } catch {}
}

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
    if (res.status === 401) {
      clearExpiredToken();
      throw new Error('โทเค็นการเชื่อมต่อ Google หมดอายุ กรุณากดเชื่อมต่อ Google Sheets ใหม่อีกครั้ง');
    }
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
 * Restructure existing data in Google Sheet
 * Converts any rows with stacked multiline workers into 1 clean row per worker
 */
export async function restructureSheetDataToSingleWorkerRows(
  accessToken: string,
  spreadsheetId: string = SPREADSHEET_ID
): Promise<{ originalRecordsCount: number; newRowsCount: number }> {
  const records = await fetchRecordsFromSheet(accessToken, spreadsheetId);
  if (records.length === 0) {
    throw new Error('ไม่พบข้อมูลใน Google Sheet ให้จัดระเบียบ');
  }

  const sheetTitle = await getFirstSheetTitle(accessToken, spreadsheetId);
  const quotedSheet = escapeSheetTitle(sheetTitle);

  // Generate expanded single-worker rows for all records
  const allRows: (string | number)[][] = [];
  records.forEach((r) => {
    const rows = formatRecordToRows(r, allRows.length + 1);
    allRows.push(...rows);
  });

  // Re-sequence column 1
  allRows.forEach((row, i) => {
    row[0] = i + 1;
  });

  // Ensure row 1 has the standard headers
  await ensureHeaders(accessToken, sheetTitle, spreadsheetId);

  // Clear existing data rows (A2:Z)
  await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${quotedSheet}!A2:Z`)}:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  ).catch(() => {});

  // Write new expanded rows into A2:V...
  const writeRes = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${quotedSheet}!A2:V${allRows.length + 1}`)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: allRows,
      }),
    }
  );

  if (!writeRes.ok) {
    const errData = await writeRes.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'ไม่สามารถเขียนข้อมูลที่จัดระเบียบใหม่ลง Google Sheet ได้');
  }

  return { originalRecordsCount: records.length, newRowsCount: allRows.length };
}

/**
 * Trigger restructure via Apps Script webhook
 */
export async function restructureViaAppsScript(scriptUrl: string): Promise<void> {
  await fetch(scriptUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ action: 'restructure' }),
  });
}

/**
 * Format a DepositRecord into row values matching the requested columns.
 * Single row format (แรงงานทุกคนรวมใน 1 แถว คั่นด้วย \n)
 */
export function formatRecordToRow(record: DepositRecord, fallbackSeq: number = 1): (string | number)[] {
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

  const employerType = 
    record.employerType === 'company' 
      ? 'นิติบุคคล' 
      : record.employerType === 'individual'
        ? 'บุคคลธรรมดา'
        : (record.companyName || record.companyId ? 'นิติบุคคล' : 'บุคคลธรรมดา');

  const buddhistPaymentDate = formatToBuddhistDate(record.paymentDate);
  const timestamp = formatToBuddhistDateTime(new Date());

  return [
    '=ROW()-1',                                          // 1. คอลัมน์แรก: สูตร =ROW()-1 รันลำดับที่อัตโนมัติบน Google Server
    buddhistPaymentDate || '',                           // 2. วันที่ชำระเงิน (พ.ศ.)
    record.requestNumber || '',                          // 3. เลขที่คำขอ
    record.receiptBook || '',                            // 4. เล่มที่ใบเสร็จ
    record.receiptNumber || '',                          // 5. เลขที่ใบเสร็จ
    employerType,                                        // 6. ประเภทนายจ้าง
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
    timestamp,                                           // 22. Timestamp
  ];
}

/**
 * Format a DepositRecord into an array of rows.
 * Always splits into 1 row per foreign worker (แยก 1 แถวต่อแรงงาน 1 คน อย่างเป็นระเบียบ)
 */
export function formatRecordToRows(
  record: DepositRecord,
  fallbackSeq: number = 1
): (string | number)[][] {
  const workers = record.workers || [];

  if (workers.length <= 1) {
    return [formatRecordToRow(record, fallbackSeq)];
  }

  const employerType = 
    record.employerType === 'company' 
      ? 'นิติบุคคล' 
      : record.employerType === 'individual'
        ? 'บุคคลธรรมดา'
        : (record.companyName || record.companyId ? 'นิติบุคคล' : 'บุคคลธรรมดา');

  const buddhistPaymentDate = formatToBuddhistDate(record.paymentDate);
  const timestamp = formatToBuddhistDateTime(new Date());
  const rate = record.ratePerPerson || 1000;

  // แยกออกเป็น 1 แถวต่อแรงงาน 1 คน
  return workers.map((w, idx) => {
    return [
      '=ROW()-1',                                          // 1. ลำดับที่
      buddhistPaymentDate || '',                           // 2. วันที่ชำระเงิน
      record.requestNumber || '',                          // 3. เลขที่คำขอ
      record.receiptBook || '',                            // 4. เล่มที่ใบเสร็จ
      record.receiptNumber || '',                          // 5. เลขที่ใบเสร็จ
      employerType,                                        // 6. ประเภทนายจ้าง
      record.idCardNumber || '',                           // 7. เลขประจำตัวผู้เสียภาษี/บัตรประชาชน
      record.employerName || '',                           // 8. ชื่อนายจ้าง/สถานประกอบการ
      record.phoneNumber || '',                            // 9. เบอร์โทรศัพท์
      record.alienCategory || '',                          // 10. ประเภทคนต่างด้าว
      1,                                                   // 11. จำนวนคน (1 คนต่อแถว)
      rate,                                                // 12. อัตราต่อคน (บาท)
      rate,                                                // 13. จำนวนเงิน (1,000 บาท ต่อแถว คำนวณ SUM ได้แม่นยำ)
      'หนึ่งพันบาทถ้วน',                                    // 14. จำนวนเงินตัวอักษร
      w.idCardNumber || '-',                               // 15. เลขประจำตัวคนต่างด้าว (13 หลัก)
      w.name || '-',                                       // 16. ชื่อ-นามสกุลคนต่างด้าว
      w.nationality || '-',                                // 17. สัญชาติ
      record.employmentOffice || '',                       // 18. สำนักงานจัดหางานที่รับคำขอ
      record.officerName || '',                            // 19. เจ้าหน้าที่ผู้รับเงิน
      record.officerPosition || '',                        // 20. ตำแหน่งเจ้าหน้าที่
      record.notes ? `${record.notes} (คนลำดับที่ ${idx + 1}/${workers.length})` : `(คนลำดับที่ ${idx + 1}/${workers.length})`, // 21. หมายเหตุ
      timestamp,                                           // 22. Timestamp
    ];
  });
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

  const rowsData = formatRecordToRows(record, nextSeq);
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
      values: rowsData,
    }),
  });

  if (!appendRes.ok) {
    if (appendRes.status === 401) {
      clearExpiredToken();
      throw new Error('โทเค็นการเชื่อมต่อ Google หมดอายุ กรุณากดเชื่อมต่อ Google Sheets ใหม่อีกครั้ง');
    }
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
    if (appendRes.status === 401) {
      clearExpiredToken();
      throw new Error('โทเค็นการเชื่อมต่อ Google หมดอายุ กรุณากดเชื่อมต่อ Google Sheets ใหม่อีกครั้ง');
    }
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
 * Transform raw Google Sheet rows into DepositRecord objects
 */
export function parseRowsToRecords(rows: any[][]): DepositRecord[] {
  // Filter out empty rows, null rows, and strictly EXCLUDE the header row
  const validRows = rows.filter((row: any[]) => {
    if (!row || !Array.isArray(row) || row.length === 0) return false;

    // Detect and discard table header row (แถวแรกที่เป็นหัวตาราง ไม่นับเป็นข้อมูล)
    const c0 = String(row[0] || '').trim();
    const c1 = String(row[1] || '').trim();
    const c2 = String(row[2] || '').trim();
    const c3 = String(row[3] || '').trim();
    const c5 = String(row[5] || '').trim();
    const c7 = String(row[7] || '').trim();
    const c17 = String(row[17] || '').trim();

    if (
      c0 === 'ลำดับที่' ||
      c1.includes('วันที่ชำระเงิน') ||
      c2.includes('เลขที่คำขอ') ||
      c3.includes('เล่มที่ใบเสร็จ') ||
      c5.includes('ประเภทนายจ้าง') ||
      c7.includes('ชื่อนายจ้าง') ||
      c17.includes('สำนักงานจัดหางานที่รับคำขอ')
    ) {
      return false; // Skip header row!
    }

    return row.some((cell: any, idx: number) => {
      if (idx === 0) return false; // ignore sequential row number formula/value
      return cell !== undefined && cell !== null && String(cell).trim() !== '' && String(cell).trim() !== '-';
    });
  });

  // Group rows belonging to the same transaction (e.g. 1 employer with 3 rows of workers)
  const groupedMap = new Map<string, { baseRow: any[]; workers: ForeignWorker[]; totalAmount: number; count: number }>();

  validRows.forEach((row: any[], rowIndex: number) => {
    const reqNum = String(row[2] || '').trim();
    const recBook = String(row[3] || '').trim();
    const recNum = String(row[4] || '').trim();
    const employerId = String(row[6] || '').trim();

    // Grouping key: requestNumber + receiptBook + receiptNumber + employerId
    // If request and receipt are given, group by them. Otherwise, row is independent.
    const groupKey = (reqNum || recNum) 
      ? `${reqNum}_${recBook}_${recNum}_${employerId}` 
      : `row_${rowIndex}`;

    const ids = (row[14] || '').split('\n').map((s: string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    const names = (row[15] || '').split('\n').map((s: string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    const nats = (row[16] || '').split('\n').map((s: string) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    
    const countInRow = parseInt(String(row[10] || '').replace(/\D/g, ''), 10) || Math.max(names.length, ids.length, 1);
    const currentWorkers: ForeignWorker[] = [];
    for (let i = 0; i < Math.max(names.length, ids.length, countInRow); i++) {
      if (names[i] || ids[i]) {
        currentWorkers.push({
          id: `w-sheet-${rowIndex}-${i}`,
          idCardNumber: ids[i] || '',
          name: names[i] || '',
          nationality: nats[i] || 'เมียนมา (Myanmar)',
        });
      }
    }

    const rawAmt = String(row[12] || '').replace(/,/g, '').trim();
    const parsedAmt = parseFloat(rawAmt);
    const rowAmount = !isNaN(parsedAmt) && parsedAmt > 0 ? parsedAmt : (countInRow * 1000);

    if (groupedMap.has(groupKey)) {
      const existing = groupedMap.get(groupKey)!;
      existing.workers.push(...currentWorkers);
      existing.totalAmount += rowAmount;
      existing.count += countInRow;
    } else {
      groupedMap.set(groupKey, {
        baseRow: row,
        workers: currentWorkers,
        totalAmount: rowAmount,
        count: countInRow,
      });
    }
  });

  const records: DepositRecord[] = [];
  let index = 0;
  groupedMap.forEach((item) => {
    const row = item.baseRow;
    const finalCount = Math.max(item.workers.length, item.count, 1);
    const finalAmount = item.totalAmount > 0 ? item.totalAmount : (finalCount * 1000);

    records.push({
      id: `sheet-rec-${index}-${row[2] || Date.now()}`,
      paymentDate: normalizePaymentDateToIso(row[1]) || String(row[1] || '').trim(),
      requestNumber: row[2] || '',
      receiptBook: row[3] || '',
      receiptNumber: row[4] || '',
      employerType: row[5] === 'นิติบุคคล' ? 'company' : 'individual',
      idCardNumber: row[6] || '',
      employerName: row[7] || '',
      phoneNumber: row[8] || '',
      alienCategory: row[9] || '',
      alienCount: finalCount,
      ratePerPerson: parseInt(String(row[11] || '').replace(/\D/g, ''), 10) || 1000,
      totalAmount: finalAmount,
      thaiBahtText: item.workers.length > 1 ? numberToThaiBahtText(finalAmount) : (row[13] || numberToThaiBahtText(finalAmount)),
      workers: item.workers,
      employmentOffice: row[17] || '',
      officerName: row[18] || '',
      officerPosition: row[19] || '',
      notes: row[20] || '',
      createdAt: row[21] || new Date().toISOString(),
    });
    index++;
  });

  return records;
}

/**
 * Fetch all records from Google Sheet to sync live data across multiple officers/devices
 * Supports OAuth access token, Apps Script Webhook, and Public Sheet view (0 login)
 */
export async function fetchRecordsFromSheet(
  accessToken?: string | null,
  spreadsheetId: string = SPREADSHEET_ID
): Promise<DepositRecord[]> {
  // Method 1: Google Sheets API v4 with OAuth token
  if (accessToken) {
    try {
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

      if (res.ok) {
        const data = await res.json();
        return parseRowsToRecords(data.values || []);
      }
      if (res.status === 401) {
        clearExpiredToken();
      }
    } catch (e: any) {
      if (e?.message?.includes('หมดอายุ') || String(e).includes('401')) {
        clearExpiredToken();
      }
      console.warn('OAuth fetch failed, trying fallbacks...', e);
    }
  }

  // Method 2: Google Apps Script Webhook (Zero Login required)
  const webhookUrl = getAppsScriptUrl();
  if (webhookUrl) {
    try {
      const scriptRes = await fetch(webhookUrl);
      if (scriptRes.ok) {
        const json = await scriptRes.json().catch(() => null);
        if (json && json.status === 'success' && Array.isArray(json.values)) {
          return parseRowsToRecords(json.values);
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Method 3: Google Visualization API (Zero Login required if shared with "Anyone with link can view")
  try {
    const gvizRes = await fetch(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`
    );
    if (gvizRes.ok) {
      const text = await gvizRes.text();
      if (text.includes('google.visualization.Query.setResponse')) {
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          if (parsed.table && Array.isArray(parsed.table.rows)) {
            const rows = parsed.table.rows.map((r: any) =>
              (r.c || []).map((cell: any) => {
                if (!cell) return '';
                if (cell.f !== undefined && cell.f !== null) return cell.f;
                return cell.v !== undefined && cell.v !== null ? cell.v : '';
              })
            );
            return parseRowsToRecords(rows);
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return [];
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
  const rowsData = formatRecordToRows(record, 1);
  const payload = {
    action: 'append_batch',
    record,
    rows: rowsData,
    row: rowsData[0], // fallback for older Apps Script version
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

