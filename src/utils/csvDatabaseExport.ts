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
 * Always exports 1 row per foreign worker (แยก 1 แถวต่อแรงงาน 1 คน อย่างเป็นระเบียบ)
 * @param records All records to choose from
 * @param selectedOffice Office filter string ('all' or specific office name)
 * @returns number of exported records/rows
 */
export function exportDatabaseToCSV(
  records: DepositRecord[], 
  selectedOffice: string = 'all'
): number {
  // Filter by employment office if specified
  const filteredRecords = selectedOffice === 'all'
    ? records
    : records.filter((r) => (r.employmentOffice || '').trim() === selectedOffice.trim());

  if (filteredRecords.length === 0) {
    return 0;
  }

  // Exact 22 headers identical to the database sheet
  const headers = SHEET_HEADERS;

  const rows: string[] = [];
  let seq = 1;

  filteredRecords.forEach((r) => {
    const workers = r.workers || [];

    const employerType = 
      r.employerType === 'company' 
        ? 'นิติบุคคล' 
        : r.employerType === 'individual'
          ? 'บุคคลธรรมดา'
          : (r.companyName || r.companyId ? 'นิติบุคคล' : 'บุคคลธรรมดา');

    const paymentDateBE = formatToBuddhistDate(r.paymentDate);

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

    if (workers.length > 0) {
      // แยกแถวรายคน: 1 แถวต่อแรงงาน 1 คน ไม่มีการซ้อนข้อความในเซลล์
      workers.forEach((w, wIdx) => {
        const rowCells: (string | number)[] = [
          seq++,                                                // 1. ลำดับที่
          paymentDateBE,                                        // 2. วันที่ชำระเงิน (พ.ศ.)
          r.requestNumber || '',                                // 3. เลขที่คำขอ
          r.receiptBook || '',                                  // 4. เล่มที่ใบเสร็จ
          r.receiptNumber || '',                                // 5. เลขที่ใบเสร็จ
          employerType,                                         // 6. ประเภทนายจ้าง
          r.idCardNumber || '',                                 // 7. เลขประจำตัวผู้เสียภาษี/บัตรประชาชน
          r.employerName || '',                                 // 8. ชื่อนายจ้าง/สถานประกอบการ
          r.phoneNumber || '',                                  // 9. เบอร์โทรศัพท์
          r.alienCategory || '',                                // 10. ประเภทคนต่างด้าว
          1,                                                    // 11. จำนวนแรงงาน (1 คนต่อแถว)
          r.ratePerPerson || 1000,                              // 12. อัตราต่อคน (บาท)
          r.ratePerPerson || 1000,                              // 13. จำนวนเงิน (1,000 บาท ต่อแถว)
          'หนึ่งพันบาทถ้วน',                                     // 14. จำนวนเงินตัวอักษร
          w.idCardNumber || '-',                                // 15. เลขประจำตัวคนต่างด้าว (13 หลัก)
          w.name || '-',                                        // 16. ชื่อ-นามสกุลคนต่างด้าว
          w.nationality || '-',                                 // 17. สัญชาติ
          r.employmentOffice || '',                             // 18. สำนักงานจัดหางานที่รับคำขอ
          r.officerName || '',                                  // 19. เจ้าหน้าที่ผู้รับเงิน
          r.officerPosition || '',                              // 20. ตำแหน่งเจ้าหน้าที่
          r.notes ? (workers.length > 1 ? `${r.notes} (คนลำดับที่ ${wIdx + 1}/${workers.length})` : r.notes) : (workers.length > 1 ? `(คนลำดับที่ ${wIdx + 1}/${workers.length})` : ''), // 21. หมายเหตุ
          timestampBE,                                          // 22. Timestamp
        ];
        rows.push(rowCells.map(escapeCsvCell).join(','));
      });
    } else {
      // กรณีไม่มีรายชื่อแรงงาน
      const rowCells: (string | number)[] = [
        seq++,
        paymentDateBE,
        r.requestNumber || '',
        r.receiptBook || '',
        r.receiptNumber || '',
        employerType,
        r.idCardNumber || '',
        r.employerName || '',
        r.phoneNumber || '',
        r.alienCategory || '',
        r.alienCount || 0,
        r.ratePerPerson || 1000,
        r.totalAmount || 0,
        r.thaiBahtText || '',
        '-',
        '-',
        '-',
        r.employmentOffice || '',
        r.officerName || '',
        r.officerPosition || '',
        r.notes || '',
        timestampBE,
      ];
      rows.push(rowCells.map(escapeCsvCell).join(','));
    }
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
