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

/**
 * Convert Date or YYYY-MM-DD string to Thai Buddhist Era date format (DD/MM/BBBB)
 * Example: '2026-10-01' -> '01/10/2569'
 */
export function formatToBuddhistDate(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    let year = parseInt(match[1], 10);
    const month = match[2];
    const day = match[3];
    if (year < 2400) {
      year += 543;
    }
    return `${day}/${month}/${year}`;
  }
  return trimmed;
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
