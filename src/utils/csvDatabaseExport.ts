import { DepositRecord } from '../types/deposit';
import { formatToBuddhistDate, formatToBuddhistDateTime } from './thaiBahtText';
import { SHEET_HEADERS } from '../services/googleSheets';

/**
 * Escapes a cell value for CSV format according to RFC 4180
 * Also ensures leading zeros (e.g. ID card 01055...) are not mangled by Excel
 */
function escapeCsvCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  // Replace internal quotes with double quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Exports deposit records strictly matching the 22-column Google Sheet database structure
 * @param records All records to choose from
 * @param selectedOffice Office filter string ('all' or specific office name)
 * @returns number of exported records
 */
export function exportDatabaseToCSV(records: DepositRecord[], selectedOffice: string = 'all'): number {
  // Filter by employment office if specified
  const filteredRecords = selectedOffice === 'all'
    ? records
    : records.filter((r) => (r.employmentOffice || '').trim() === selectedOffice.trim());

  if (filteredRecords.length === 0) {
    return 0;
  }

  // Exact 22 headers identical to the database sheet
  const headers = SHEET_HEADERS;

  const rows = filteredRecords.map((r, index) => {
    const workers = r.workers || [];
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
      r.employerType === 'company' 
        ? 'นิติบุคคล' 
        : r.employerType === 'individual'
          ? 'บุคคลธรรมดา'
          : (r.companyName || r.companyId ? 'นิติบุคคล' : 'บุคคลธรรมดา');

    // Buddhist Era formatted payment date
    const paymentDateBE = formatToBuddhistDate(r.paymentDate);

    // Timestamp in Buddhist Era format
    let timestampBE = '';
    if (r.createdAt) {
      const dt = new Date(r.createdAt);
      if (!isNaN(dt.getTime())) {
        timestampBE = formatToBuddhistDateTime(dt);
      }
    }
    if (!timestampBE) {
      timestampBE = formatToBuddhistDateTime(new Date());
    }

    const rowCells: (string | number)[] = [
      index + 1,                                            // 1. ลำดับที่ (รันตัวเลข 1, 2, 3...)
      paymentDateBE,                                        // 2. วันที่ชำระเงิน (พ.ศ.)
      r.requestNumber || '',                                // 3. เลขที่คำขอ
      r.receiptBook || '',                                  // 4. เล่มที่ใบเสร็จ
      r.receiptNumber || '',                                // 5. เลขที่ใบเสร็จ
      employerType,                                         // 6. ประเภทนายจ้าง
      r.idCardNumber || '',                                 // 7. เลขประจำตัวผู้เสียภาษี/บัตรประชาชน
      r.employerName || '',                                 // 8. ชื่อนายจ้าง/สถานประกอบการ
      r.phoneNumber || '',                                  // 9. เบอร์โทรศัพท์
      r.alienCategory || '',                                // 10. ประเภทคนต่างด้าว
      r.alienCount || 0,                                    // 11. จำนวนแรงงาน (คน)
      r.ratePerPerson || 1000,                              // 12. อัตราต่อคน (บาท)
      r.totalAmount || 0,                                   // 13. จำนวนเงินรวม (บาท)
      r.thaiBahtText || '',                                 // 14. จำนวนเงินตัวอักษร
      workerIdsStr,                                         // 15. เลขประจำตัวคนต่างด้าว (13 หลัก)
      workerNamesStr,                                       // 16. ชื่อ-นามสกุลคนต่างด้าว
      workerNationalitiesStr,                               // 17. สัญชาติ
      r.employmentOffice || '',                             // 18. สำนักงานจัดหางานที่รับคำขอ
      r.officerName || '',                                  // 19. เจ้าหน้าที่ผู้รับเงิน
      r.officerPosition || '',                              // 20. ตำแหน่งเจ้าหน้าที่
      r.notes || '',                                        // 21. หมายเหตุ
      timestampBE,                                          // 22. Timestamp
    ];

    return rowCells.map(escapeCsvCell).join(',');
  });

  // UTF-8 BOM (\uFEFF) is mandatory for Excel to render Thai characters correctly
  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');

  // Generate safe filename with Office name and Buddhist Era date
  const now = new Date();
  const dateStrBE = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear() + 543}`;
  
  const officeLabel = (selectedOffice && selectedOffice !== 'all')
    ? selectedOffice
        .replace(/สำนักงานจัดหางาน/g, 'สนง.')
        .replace(/กรุงเทพมหานคร/g, 'กทม.')
        .replace(/จังหวัด/g, 'จ.')
        .replace(/[\/\s\\:*?"<>|]/g, '_')
    : 'สำนักงานจัดหางาน';

  const filename = `รายงานฐานข้อมูลเงินหลักประกัน_${officeLabel}_${dateStrBE}.csv`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filteredRecords.length;
}
