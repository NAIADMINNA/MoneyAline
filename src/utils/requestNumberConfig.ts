export interface RequestNumberConfig {
  prefix: string;
  length: number;
  enabled: boolean;
}

export const DEFAULT_REQUEST_CONFIG: RequestNumberConfig = {
  prefix: '691',
  length: 14,
  enabled: true,
};

const CONFIG_STORAGE_KEY = 'doe_request_number_config';
export const REQUEST_CONFIG_EVENT = 'doe_request_config_changed';

/**
 * โหลดการตั้งค่ารูปแบบเลขที่คำขอจาก localStorage
 */
export function getRequestNumberConfig(): RequestNumberConfig {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        prefix: typeof parsed.prefix === 'string' && parsed.prefix.trim() ? parsed.prefix.trim() : DEFAULT_REQUEST_CONFIG.prefix,
        length: typeof parsed.length === 'number' && parsed.length > 0 ? parsed.length : DEFAULT_REQUEST_CONFIG.length,
        enabled: parsed.enabled !== false,
      };
    }
  } catch (e) {
    console.error('Failed to parse request number config', e);
  }
  return DEFAULT_REQUEST_CONFIG;
}

/**
 * บันทึกการตั้งค่ารูปแบบเลขที่คำขอ และแจ้งเตือน component อื่นๆ
 */
export function saveRequestNumberConfig(config: RequestNumberConfig): void {
  try {
    const cleanConfig: RequestNumberConfig = {
      prefix: (config.prefix || '').trim() || DEFAULT_REQUEST_CONFIG.prefix,
      length: Math.max(config.prefix.length, Number(config.length) || DEFAULT_REQUEST_CONFIG.length),
      enabled: config.enabled !== false,
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cleanConfig));
    window.dispatchEvent(new CustomEvent(REQUEST_CONFIG_EVENT, { detail: cleanConfig }));
  } catch (e) {
    console.error('Failed to save request number config', e);
  }
}

/**
 * สร้างตัวอย่างเลขคำขอจำลองตาม prefix และ length
 */
export function generateSampleRequestNumber(config: RequestNumberConfig): string {
  const prefix = (config.prefix || '691').trim();
  const targetLength = Math.max(prefix.length, config.length || 14);
  
  // ตัวอย่างเฉพาะ 691 / 14 หลัก ให้คงตัวอย่างเดิมที่ผู้ใช้คุ้นเคย
  if (prefix === '691' && targetLength === 14) {
    return '69144400861000';
  }

  // หากเป็นความยาวหรือ prefix อื่น ให้สร้างตัวอย่างตาม format
  const remaining = targetLength - prefix.length;
  if (remaining <= 0) return prefix;
  
  // สร้างตัวเลขต่อท้ายแบบสมจริง
  const defaultSuffix = '444008610002569';
  const suffix = defaultSuffix.slice(0, remaining).padEnd(remaining, '0');
  return `${prefix}${suffix}`;
}

/**
 * ตรวจสอบความถูกต้องของเลขที่คำขอ
 */
export function validateRequestNumber(
  value: string,
  config: RequestNumberConfig = getRequestNumberConfig()
): { isValid: boolean; error?: string } {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'กรุณากรอกเลขที่คำขอ' };
  }

  // หากปิดการบังคับตรวจสอบ ให้ยอมรับได้เลยตราบใดที่ไม่ว่าง
  if (!config.enabled) {
    return { isValid: true };
  }

  // ตรวจสอบว่าต้องเป็นตัวเลขเท่านั้น
  if (!/^\d+$/.test(trimmed)) {
    return { isValid: false, error: 'เลขที่คำขอต้องประกอบด้วยตัวเลขเท่านั้น' };
  }

  // ตรวจสอบตัวเลขนำหน้า (prefix)
  if (config.prefix && !trimmed.startsWith(config.prefix)) {
    return {
      isValid: false,
      error: `เลขที่คำขอต้องขึ้นต้นด้วย "${config.prefix}" เท่านั้น`,
    };
  }

  // ตรวจสอบจำนวนหลัก (length)
  if (trimmed.length !== config.length) {
    return {
      isValid: false,
      error: `เลขที่คำขอต้องมีจำนวน ${config.length} หลัก (ปัจจุบันกรอก ${trimmed.length} หลัก)`,
    };
  }

  return { isValid: true };
}
