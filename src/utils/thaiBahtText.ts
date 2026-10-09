/**
 * Thai Baht Text Converter (แปลงตัวเลขเป็นตัวอักษรภาษาไทย)
 * Example: 1000 -> หนึ่งพันบาทถ้วน
 * Example: 12500 -> หนึ่งหมื่นสองพันห้าร้อยบาทถ้วน
 */

const THAI_DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const THAI_POSITIONS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

export function formatThaiCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace('THB', '฿').trim();
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('th-TH').format(num);
}

export function formatIdCard(value: string): string {
  // Only keep digits
  const cleaned = value.replace(/\D/g, '').slice(0, 13);
  if (!cleaned) return '';
  
  // Format: X-XXXX-XXXXX-XX-X
  const parts = [];
  if (cleaned.length > 0) parts.push(cleaned.slice(0, 1));
  if (cleaned.length > 1) parts.push(cleaned.slice(1, 5));
  if (cleaned.length > 5) parts.push(cleaned.slice(5, 10));
  if (cleaned.length > 10) parts.push(cleaned.slice(10, 12));
  if (cleaned.length > 12) parts.push(cleaned.slice(12, 13));
  
  return parts.join('-');
}

export function formatPhone(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 10);
  if (!cleaned) return '';
  
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  if (cleaned.length <= 9) {
    if (cleaned.startsWith('02')) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
    }
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

export function numberToThaiBahtText(num: number): string {
  if (isNaN(num) || num < 0) return 'ศูนย์บาทถ้วน';
  if (num === 0) return 'ศูนย์บาทถ้วน';

  // Separate integer and decimal
  const parts = num.toFixed(2).split('.');
  const integerPart = parseInt(parts[0], 10);
  const decimalPart = parseInt(parts[1], 10);

  let result = '';

  if (integerPart > 0) {
    result += convertMillionsGroup(integerPart) + 'บาท';
  } else {
    result += 'ศูนย์บาท';
  }

  if (decimalPart > 0) {
    result += convertTensGroup(decimalPart) + 'สตางค์';
  } else {
    result += 'ถ้วน';
  }

  return result;
}

function convertMillionsGroup(num: number): string {
  if (num === 0) return '';
  const millions = Math.floor(num / 1000000);
  const remainder = num % 1000000;

  let result = '';
  if (millions > 0) {
    result += convertMillionsGroup(millions) + 'ล้าน';
  }

  result += convertUnderMillion(remainder, millions > 0);
  return result;
}

function convertUnderMillion(num: number, hasHigherUnit: boolean): string {
  if (num === 0) return '';
  const str = num.toString();
  const len = str.length;
  let text = '';

  for (let i = 0; i < len; i++) {
    const digit = parseInt(str[i], 10);
    const pos = len - i - 1;

    if (digit === 0) continue;

    if (pos === 0) {
      if (digit === 1 && len > 1) {
        text += 'เอ็ด';
      } else if (digit === 1 && len === 1 && hasHigherUnit) {
        text += 'เอ็ด';
      } else {
        text += THAI_DIGITS[digit];
      }
    } else if (pos === 1) {
      if (digit === 1) {
        text += 'สิบ';
      } else if (digit === 2) {
        text += 'ยี่สิบ';
      } else {
        text += THAI_DIGITS[digit] + 'สิบ';
      }
    } else {
      text += THAI_DIGITS[digit] + THAI_POSITIONS[pos];
    }
  }

  return text;
}

function convertTensGroup(num: number): string {
  if (num === 0) return '';
  const str = num.toString().padStart(2, '0');
  const tenDigit = parseInt(str[0], 10);
  const unitDigit = parseInt(str[1], 10);

  let text = '';
  if (tenDigit > 0) {
    if (tenDigit === 1) {
      text += 'สิบ';
    } else if (tenDigit === 2) {
      text += 'ยี่สิบ';
    } else {
      text += THAI_DIGITS[tenDigit] + 'สิบ';
    }
  }

  if (unitDigit > 0) {
    if (unitDigit === 1 && tenDigit > 0) {
      text += 'เอ็ด';
    } else {
      text += THAI_DIGITS[unitDigit];
    }
  }

  return text;
}

export const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * Get current date in local timezone as YYYY-MM-DD
 * (Never suffers from UTC midnight offset shifts)
 */
export function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ParsedDateInfo {
  day: number;
  month: number; // 1-12
  yearCE: number; // e.g. 2026
  yearBE: number; // e.g. 2569
  isoDate: string; // YYYY-MM-DD
  buddhistDate: string; // DD/MM/BBBB e.g. 08/10/2569
  thaiFullDate: string; // e.g. 8 ตุลาคม 2569
}

/**
 * Robustly parses any date representation without timezone distortion
 * Handles:
 *  - YYYY-MM-DD (e.g. '2026-10-08')
 *  - DD/MM/BBBB (e.g. '08/10/2569')
 *  - DD/MM/YYYY (e.g. '08/10/2026')
 *  - ISO strings ('2026-10-08T...')
 *  - Google Viz Date(2026,9,8)
 */
export function parseDateParts(dateInput: any): ParsedDateInfo | null {
  if (!dateInput) return null;
  const rawStr = String(dateInput).trim();
  if (!rawStr) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  // Case 1: YYYY-MM-DD or ISO string starting with YYYY-MM-DD
  const isoMatch = rawStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const yearCE = year < 2400 ? year : year - 543;
    const yearBE = year < 2400 ? year + 543 : year;
    const monthName = THAI_MONTH_NAMES[month - 1] || '';

    return {
      day,
      month,
      yearCE,
      yearBE,
      isoDate: `${yearCE}-${pad(month)}-${pad(day)}`,
      buddhistDate: `${pad(day)}/${pad(month)}/${yearBE}`,
      thaiFullDate: `${day} ${monthName} ${yearBE}`,
    };
  }

  // Case 2: DD/MM/YYYY or DD/MM/BBBB (with / or - or .)
  const slashMatch = rawStr.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);
    const yearCE = year < 2400 ? year : year - 543;
    const yearBE = year < 2400 ? year + 543 : year;
    const monthName = THAI_MONTH_NAMES[month - 1] || '';

    return {
      day,
      month,
      yearCE,
      yearBE,
      isoDate: `${yearCE}-${pad(month)}-${pad(day)}`,
      buddhistDate: `${pad(day)}/${pad(month)}/${yearBE}`,
      thaiFullDate: `${day} ${monthName} ${yearBE}`,
    };
  }

  // Case 3: Google Visualization Date(yyyy, m, d)
  const gvizMatch = rawStr.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)/);
  if (gvizMatch) {
    let year = parseInt(gvizMatch[1], 10);
    const month = parseInt(gvizMatch[2], 10) + 1; // 0-indexed in GViz
    const day = parseInt(gvizMatch[3], 10);
    const yearCE = year < 2400 ? year : year - 543;
    const yearBE = year < 2400 ? year + 543 : year;
    const monthName = THAI_MONTH_NAMES[month - 1] || '';

    return {
      day,
      month,
      yearCE,
      yearBE,
      isoDate: `${yearCE}-${pad(month)}-${pad(day)}`,
      buddhistDate: `${pad(day)}/${pad(month)}/${yearBE}`,
      thaiFullDate: `${day} ${monthName} ${yearBE}`,
    };
  }

  // Case 4: Try standard Date object parsing if valid
  const parsed = new Date(rawStr);
  if (!isNaN(parsed.getTime())) {
    const day = parsed.getDate();
    const month = parsed.getMonth() + 1;
    const year = parsed.getFullYear();
    const yearCE = year < 2400 ? year : year - 543;
    const yearBE = year < 2400 ? year + 543 : year;
    const monthName = THAI_MONTH_NAMES[month - 1] || '';

    return {
      day,
      month,
      yearCE,
      yearBE,
      isoDate: `${yearCE}-${pad(month)}-${pad(day)}`,
      buddhistDate: `${pad(day)}/${pad(month)}/${yearBE}`,
      thaiFullDate: `${day} ${monthName} ${yearBE}`,
    };
  }

  return null;
}

/**
 * Convert any date input to Thai Buddhist Era date format (DD/MM/BBBB)
 * Example: '2026-10-08' -> '08/10/2569'
 * Example: '08/10/2569' -> '08/10/2569'
 */
export function formatToBuddhistDate(dateStr: string): string {
  if (!dateStr) return '';
  const parsed = parseDateParts(dateStr);
  return parsed ? parsed.buddhistDate : String(dateStr).trim();
}

/**
 * Convert any date input to Full Thai Official format
 * Example: '2026-10-08' -> '8 ตุลาคม 2569'
 * Example: '08/10/2569' -> '8 ตุลาคม 2569'
 */
export function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '';
  const parsed = parseDateParts(dateStr);
  return parsed ? parsed.thaiFullDate : String(dateStr).trim();
}

/**
 * Normalizes any date input into strict ISO YYYY-MM-DD
 * Example: '08/10/2569' -> '2026-10-08'
 * Example: '2026-10-08' -> '2026-10-08'
 */
export function normalizePaymentDateToIso(dateStr: string): string {
  if (!dateStr) return '';
  const parsed = parseDateParts(dateStr);
  return parsed ? parsed.isoDate : String(dateStr).trim();
}

/**
 * Convert Date object to Thai Buddhist Era with Time
 * Example: 01/10/2569 14:30:00
 */
export function formatToBuddhistDateTime(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear() + 543;
  const hours = pad(date.getHours());
  const mins = pad(date.getMinutes());
  const secs = pad(date.getSeconds());
  return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
}
