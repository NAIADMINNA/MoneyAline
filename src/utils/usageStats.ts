// ระบบจัดการสถิติผู้เข้าใช้งานสะสม และ สถิติการส่งออกไฟล์สะสม
// นับสะสมต่อเนื่องถาวร และอัปเดตตัวเลขทันทีทุกครั้งที่เปิดหน้าเว็บหรือกดส่งออกข้อมูล

export const VISITOR_COUNT_KEY = 'doe_all_time_visitor_count';
export const VISITOR_COUNT_LEGACY_KEY = 'doe_real_visitor_count';

export const EXPORT_COUNT_KEY = 'doe_all_time_export_count';
export const EXPORT_COUNT_LEGACY_KEY = 'doe_real_export_count';

export const USAGE_STATS_UPDATED_EVENT = 'doe-usage-stats-updated';

export interface UsageStatsData {
  visitorCount: number;
  exportCount: number;
}

// ตัวแปรในหน่วยความจำระดับโมดูล เพื่อให้นับ +1 ทุกครั้งที่เปิดหน้าเว็บหรือกดรีเฟรช (F5)
// โดยไม่ถูกบล็อกค้างด้วย sessionStorage และไม่นับซ้ำซ้อนจาก React StrictMode
let hasRecordedVisitThisPageLoad = false;

export function getVisitorCount(): number {
  try {
    const saved =
      localStorage.getItem(VISITOR_COUNT_KEY) ||
      localStorage.getItem(VISITOR_COUNT_LEGACY_KEY);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return 0;
}

export function getExportCount(): number {
  try {
    const saved =
      localStorage.getItem(EXPORT_COUNT_KEY) ||
      localStorage.getItem(EXPORT_COUNT_LEGACY_KEY);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return 0;
}

function broadcastStatsUpdate(stats: UsageStatsData) {
  try {
    window.dispatchEvent(
      new CustomEvent<UsageStatsData>(USAGE_STATS_UPDATED_EVENT, {
        detail: stats,
      })
    );
  } catch {
    // ignore
  }
}

/**
 * บันทึกการเข้าใช้งานระบบ (+1 ทันทีทุกครั้งที่โหลดหรือรีเฟรชหน้าเว็บ)
 */
export function recordPageVisit(): number {
  try {
    // ล้างค่า sessionStorage เดิมที่เคยล็อคไม่ให้ตัวเลขผู้เข้าใช้งานเพิ่มขึ้น
    sessionStorage.removeItem('doe_real_visit_session');
    localStorage.removeItem('doe_visitor_count');
  } catch {
    // ignore
  }

  const current = getVisitorCount();
  if (hasRecordedVisitThisPageLoad) {
    return Math.max(1, current);
  }

  hasRecordedVisitThisPageLoad = true;
  const next = current + 1;

  try {
    localStorage.setItem(VISITOR_COUNT_KEY, String(next));
    localStorage.setItem(VISITOR_COUNT_LEGACY_KEY, String(next));
  } catch {
    // ignore
  }

  broadcastStatsUpdate({
    visitorCount: next,
    exportCount: getExportCount(),
  });

  return next;
}

/**
 * บันทึกสถิติการนำออกข้อมูล / ส่งออกไฟล์ CSV (+1 ทันทีทุกครั้งที่กดส่งออก)
 */
export function incrementExportCount(): number {
  try {
    localStorage.removeItem('doe_export_count');
  } catch {
    // ignore
  }

  const current = getExportCount();
  const next = current + 1;

  try {
    localStorage.setItem(EXPORT_COUNT_KEY, String(next));
    localStorage.setItem(EXPORT_COUNT_LEGACY_KEY, String(next));
  } catch {
    // ignore
  }

  broadcastStatsUpdate({
    visitorCount: getVisitorCount(),
    exportCount: next,
  });

  return next;
}
