export interface RequestNumberConfig {
  prefix: string; // รองรับ 1 ค่า เช่น "691" หรือหลายค่าคั่นด้วยจุลภาค เช่น "691, 692, 681" (เว้นว่างได้หากไม่บังคับรหัสขึ้นต้น)
  length: number; // จำนวนหลัก เช่น 14
  enabled: boolean; // เปิด/ปิดการบังคับตรวจสอบ
  allowAlphanumeric?: boolean; // อนุญาตตัวอักษรและขีด (-) เช่น WP-691... หรือไม่ (ค่าเริ่มต้น false = เฉพาะตัวเลข)
}

export const DEFAULT_REQUEST_CONFIG: RequestNumberConfig = {
  prefix: '691',
  length: 14,
  enabled: true,
  allowAlphanumeric: false,
};

const CONFIG_STORAGE_KEY = 'doe_request_number_config';
export const REQUEST_CONFIG_EVENT = 'doe_request_config_changed';

/**
 * แยกรหัสขึ้นต้น (Prefix) กรณีแอดมินตั้งไว้หลายตัวคั่นด้วยจุลภาค เช่น "691, 692"
 */
export function parseAllowedPrefixes(prefixStr: string): string[] {
  if (!prefixStr) return [];
  return prefixStr
    .split(/[,;\s]+/)
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * โหลดการตั้งค่ารูปแบบเลขที่คำขอจาก localStorage
 */
export function getRequestNumberConfig(): RequestNumberConfig {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const prefixVal = typeof parsed.prefix === 'string' ? parsed.prefix.trim() : DEFAULT_REQUEST_CONFIG.prefix;
      const prefixes = parseAllowedPrefixes(prefixVal);
      const minLen = prefixes.length > 0 ? Math.max(...prefixes.map(p => p.length)) : 1;
      return {
        prefix: prefixVal,
        length: typeof parsed.length === 'number' && parsed.length > 0 ? Math.max(minLen, parsed.length) : DEFAULT_REQUEST_CONFIG.length,
        enabled: parsed.enabled !== false,
        allowAlphanumeric: Boolean(parsed.allowAlphanumeric),
      };
    }
  } catch {
    // ignore storage parse errors
  }
  return DEFAULT_REQUEST_CONFIG;
}

/**
 * บันทึกการตั้งค่ารูปแบบเลขที่คำขอ และแจ้งเตือน component อื่นๆ ทันที
 */
export function saveRequestNumberConfig(config: RequestNumberConfig): void {
  try {
    const rawPrefix = typeof config.prefix === 'string' ? config.prefix.trim() : DEFAULT_REQUEST_CONFIG.prefix;
    const prefixes = parseAllowedPrefixes(rawPrefix);
    const maxPrefixLen = prefixes.length > 0 ? Math.max(...prefixes.map(p => p.length)) : 1;
    const cleanConfig: RequestNumberConfig = {
      prefix: rawPrefix,
      length: Math.max(maxPrefixLen, Number(config.length) || DEFAULT_REQUEST_CONFIG.length),
      enabled: config.enabled !== false,
      allowAlphanumeric: Boolean(config.allowAlphanumeric),
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cleanConfig));
    window.dispatchEvent(new CustomEvent(REQUEST_CONFIG_EVENT, { detail: cleanConfig }));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * สร้างข้อความอธิบายเงื่อนไขเลขที่คำขอปัจจุบัน
 */
export function formatRequestConfigSummary(config: RequestNumberConfig = getRequestNumberConfig()): string {
  if (!config.enabled) {
    return 'ไม่จำกัดรูปแบบเลขคำขอ';
  }
  const prefixes = parseAllowedPrefixes(config.prefix);
  const prefixText =
    prefixes.length === 0
      ? 'ขึ้นต้นด้วยตัวเลขใดก็ได้'
      : prefixes.length === 1
      ? `ขึ้นต้นด้วย "${prefixes[0]}"`
      : `ขึ้นต้นด้วย ${prefixes.map(p => `"${p}"`).join(' หรือ ')}`;
  return `${prefixText} จำนวน ${config.length} หลัก`;
}

/**
 * สร้างตัวอย่างเลขคำขอจำลองตาม prefix และ length ที่แอดมินตั้งค่า
 */
export function generateSampleRequestNumber(config: RequestNumberConfig, index = 1): string {
  const prefixes = parseAllowedPrefixes(config.prefix);
  const firstPrefix = prefixes[0] ?? '691';
  const targetLength = Math.max(firstPrefix.length, config.length || 14);

  if (firstPrefix === '691' && targetLength === 14) {
    return index === 1 ? '69144008610001' : `6914400861000${index}`;
  }

  const remaining = targetLength - firstPrefix.length;
  if (remaining <= 0) return firstPrefix;

  const endDigit = String(index);
  const defaultMid = '440086100025690000';
  const midLen = Math.max(0, remaining - endDigit.length);
  const suffix = defaultMid.slice(0, midLen).padEnd(midLen, '0') + endDigit.slice(0, remaining);
  return `${firstPrefix}${suffix}`;
}

/**
 * แยกรายการเลขที่คำขอ (รองรับทั้งคั่นด้วยจุลภาค เคาะวรรค ขึ้นบรรทัดใหม่ หรือสแลช)
 */
export function splitRequestNumbers(value: string): string[] {
  if (!value) return [];
  return value
    .split(/[,;\n\s/]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * ตรวจสอบระหว่างพิมพ์ว่าเลขคำขอกำลังขึ้นต้นตรงตาม Prefix ที่แอดมินกำหนดหรือไม่
 */
export function isMatchingRequestPrefixWhileTyping(
  singleNum: string,
  config: RequestNumberConfig = getRequestNumberConfig()
): boolean {
  if (!config.enabled || !singleNum) return true;
  const prefixes = parseAllowedPrefixes(config.prefix);
  if (prefixes.length === 0) return true;

  const upperNum = singleNum.toUpperCase();
  return prefixes.some(prefix => {
    const compareLen = Math.min(prefix.length, upperNum.length);
    return upperNum.slice(0, compareLen) === prefix.slice(0, compareLen);
  });
}

/**
 * ตรวจสอบว่าเลขคำขอเดี่ยวครบถ้วนสมบูรณ์ตามเงื่อนไขที่แอดมินตั้งไว้หรือไม่
 */
export function isSingleRequestNumberCompleteAndValid(
  singleNum: string,
  config: RequestNumberConfig = getRequestNumberConfig()
): boolean {
  if (!singleNum) return false;
  if (!config.enabled) return singleNum.trim().length > 0;

  const upperNum = singleNum.trim().toUpperCase();
  if (!config.allowAlphanumeric && !/^\d+$/.test(upperNum)) {
    return false;
  }
  const prefixes = parseAllowedPrefixes(config.prefix);
  if (prefixes.length > 0 && !prefixes.some(p => upperNum.startsWith(p))) {
    return false;
  }
  return upperNum.length === config.length;
}

/**
 * ตรวจสอบความถูกต้องของเลขที่คำขอ (รองรับทั้ง 1 เลข และหลายเลขสำหรับนายจ้างที่มีแรงงานหลายคน)
 */
export function validateRequestNumber(
  value: string,
  config: RequestNumberConfig = getRequestNumberConfig()
): { isValid: boolean; error?: string; count?: number } {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: config.enabled
        ? `กรุณากรอกเลขที่คำขอ (${formatRequestConfigSummary(config)})`
        : 'กรุณากรอกเลขที่คำขอ',
    };
  }

  const list = splitRequestNumbers(trimmed);
  if (list.length === 0) {
    return { isValid: false, error: 'กรุณากรอกเลขที่คำขอ' };
  }

  // หากแอดมินปิดการบังคับตรวจสอบ ให้ยอมรับได้เลยตราบใดที่ไม่ว่าง
  if (!config.enabled) {
    return { isValid: true, count: list.length };
  }

  const prefixes = parseAllowedPrefixes(config.prefix);
  const prefixErrorText =
    prefixes.length === 1
      ? `"${prefixes[0]}"`
      : prefixes.map(p => `"${p}"`).join(' หรือ ');

  // ตรวจสอบทีละเลขคำขอ
  for (let i = 0; i < list.length; i++) {
    const num = list[i].toUpperCase();
    const prefixLabel = list.length > 1 ? `เลขที่คำขอลำดับที่ ${i + 1} ` : 'เลขที่คำขอ';

    if (!config.allowAlphanumeric && !/^\d+$/.test(num)) {
      return { isValid: false, error: `${prefixLabel}ต้องประกอบด้วยตัวเลขเท่านั้น` };
    }

    if (prefixes.length > 0 && !prefixes.some(p => num.startsWith(p))) {
      return {
        isValid: false,
        error: `${prefixLabel}ต้องขึ้นต้นด้วย ${prefixErrorText} เสมอ`,
      };
    }

    if (num.length !== config.length) {
      return {
        isValid: false,
        error: `${prefixLabel}ต้องมีจำนวน ${config.length} หลักเท่านั้น (ปัจจุบันกรอก ${num.length} หลัก)`,
      };
    }
  }

  return { isValid: true, count: list.length };
}
