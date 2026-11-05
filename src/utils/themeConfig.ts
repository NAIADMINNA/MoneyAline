export type UIThemeId =
  | 'neo-brutalism'
  | 'royal-gov'
  | 'swiss-editorial'
  | 'emerald-coop'
  | 'pastel-glass'
  | 'warm-ledger'
  | 'cyber-blueprint'
  | 'rose-quartz';

export type ShadowStyle = 'brutalist' | 'soft' | 'flat';
export type BgPattern = 'dots' | 'grid' | 'solid';
export type RadiusScale = 'default' | 'rounded' | 'sharp';

export interface UIThemeConfig {
  themeId: UIThemeId;
  shadowStyle: ShadowStyle;
  bgPattern: BgPattern;
  radiusScale: RadiusScale;
}

export interface UIThemePreset {
  id: UIThemeId;
  name: string;
  nameTh: string;
  badge: string;
  description: string;
  defaultShadow: ShadowStyle;
  defaultPattern: BgPattern;
  defaultRadius: RadiusScale;
  colors: {
    bgCanvas: string;
    bgSurface: string;
    bgCard: string;
    borderColor: string;
    shadowColor: string;
    primary: string;      // Replaces #FFE500
    primarySoft: string;  // Replaces #FEF08A / #FDE68A / #FEF3C7
    secondary: string;    // Replaces #6EE7B7
    secondarySoft: string;// Replaces #D1FAE5
    info: string;         // Replaces #60A5FA
    infoSoft: string;     // Replaces #BFDBFE
    accentPurple: string; // Replaces #E9D5FF
    danger: string;       // Replaces #FF6B6B
  };
}

export const UI_THEME_PRESETS: UIThemePreset[] = [
  {
    id: 'neo-brutalism',
    name: 'Neo-Brutalism Pop',
    nameTh: 'นีโอบรูทัลลิซึม (ต้นฉบับ)',
    badge: 'ค่าเริ่มต้น',
    description: 'กรอบเส้นดำคมชัด เงาตัดแข็งแบบ Pop Art สีเหลืองสดตัดเขียวมิ้นท์และฟ้า สะดุดตา แยกหมวดหมู่ชัดเจน',
    defaultShadow: 'brutalist',
    defaultPattern: 'dots',
    defaultRadius: 'default',
    colors: {
      bgCanvas: '#FFFDF7',
      bgSurface: '#FAF7F0',
      bgCard: '#FFFFFF',
      borderColor: '#000000',
      shadowColor: '#000000',
      primary: '#FFE500',
      primarySoft: '#FEF08A',
      secondary: '#6EE7B7',
      secondarySoft: '#D1FAE5',
      info: '#60A5FA',
      infoSoft: '#BFDBFE',
      accentPurple: '#E9D5FF',
      danger: '#FF6B6B',
    },
  },
  {
    id: 'royal-gov',
    name: 'Official Thai Gov',
    nameTh: 'ราชการไทยยุคใหม่ (กรมท่า-ทอง)',
    badge: 'ทางการ & น่าเชื่อถือ',
    description: 'โทนสีน้ำเงินกรมท่าและทองอำพัน สุภาพ เป็นทางการ เหมาะสำหรับระบบงานทะเบียนหน่วยงานภาครัฐ',
    defaultShadow: 'soft',
    defaultPattern: 'solid',
    defaultRadius: 'default',
    colors: {
      bgCanvas: '#F1F5F9',
      bgSurface: '#E2E8F0',
      bgCard: '#FFFFFF',
      borderColor: '#1E3A8A',
      shadowColor: '#1E3A8A',
      primary: '#FCD34D',
      primarySoft: '#FEF3C7',
      secondary: '#6EE7B7',
      secondarySoft: '#ECFDF5',
      info: '#93C5FD',
      infoSoft: '#DBEAFE',
      accentPurple: '#C7D2FE',
      danger: '#FCA5A5',
    },
  },
  {
    id: 'swiss-editorial',
    name: 'Swiss Minimal Grid',
    nameTh: 'สวิสกริด มินิมอลคลีน',
    badge: 'เรียบหรู สบายตา',
    description: 'งานออกแบบสไตล์ Swiss Typographic เน้นพื้นที่สีขาวสะอาดตา เส้นตารางคมกริบ ไร้เงาทึบ อ่านข้อมูลตัวเลขได้แม่นยำ',
    defaultShadow: 'flat',
    defaultPattern: 'grid',
    defaultRadius: 'sharp',
    colors: {
      bgCanvas: '#F8FAFC',
      bgSurface: '#F1F5F9',
      bgCard: '#FFFFFF',
      borderColor: '#0F172A',
      shadowColor: '#0F172A',
      primary: '#E2E8F0',
      primarySoft: '#F1F5F9',
      secondary: '#A7F3D0',
      secondarySoft: '#ECFDF5',
      info: '#BAE6FD',
      infoSoft: '#F0F9FF',
      accentPurple: '#E2E8F0',
      danger: '#FECACA',
    },
  },
  {
    id: 'emerald-coop',
    name: 'Emerald Natural',
    nameTh: 'เขียวมรกต ถนอมสายตา',
    badge: 'คีย์ข้อมูลนานไม่ล้าตา',
    description: 'โทนสีเขียวใบไม้และเขียวมรกตอ่อนผสานพื้นหลังครีมธรรมชาติ ช่วยลดแสงสะท้อนเมื่อต้องบันทึกข้อมูลทั้งวัน',
    defaultShadow: 'soft',
    defaultPattern: 'dots',
    defaultRadius: 'rounded',
    colors: {
      bgCanvas: '#F2FBF7',
      bgSurface: '#E6F7EF',
      bgCard: '#FFFFFF',
      borderColor: '#065F46',
      shadowColor: '#065F46',
      primary: '#A7F3D0',
      primarySoft: '#D1FAE5',
      secondary: '#6EE7B7',
      secondarySoft: '#ECFDF5',
      info: '#99F6E4',
      infoSoft: '#CCFBF1',
      accentPurple: '#DDD6FE',
      danger: '#FDA4AF',
    },
  },
  {
    id: 'cyber-blueprint',
    name: 'Architectural Blueprint',
    nameTh: 'บลูพริ้นท์วิศวกรรม (ฟ้า-คราม)',
    badge: 'โมเดิร์น ไฮเทค',
    description: 'แรงบันดาลใจจากพิมพ์เขียวสถาปัตยกรรม เส้นขอบสีน้ำเงินรอยัลบลู เงาตัดสีครามสดบนพื้นตารางกริด',
    defaultShadow: 'brutalist',
    defaultPattern: 'grid',
    defaultRadius: 'sharp',
    colors: {
      bgCanvas: '#EFF6FF',
      bgSurface: '#DBEAFE',
      bgCard: '#FFFFFF',
      borderColor: '#1E40AF',
      shadowColor: '#1E40AF',
      primary: '#7DD3FC',
      primarySoft: '#E0F2FE',
      secondary: '#5EEAD4',
      secondarySoft: '#CCFBF1',
      info: '#93C5FD',
      infoSoft: '#DBEAFE',
      accentPurple: '#C4B5FD',
      danger: '#FDA4AF',
    },
  },
  {
    id: 'warm-ledger',
    name: 'Classic Paper Ledger',
    nameTh: 'สมุดทะเบียนกระดาษคลาสสิก',
    badge: 'โทนอุ่น วินเทจ',
    description: 'จำลองบรรยากาศสมุดบัญชีและใบเสร็จรับเงินกระดาษถนอมสายตา เส้นขอบสีน้ำตาลเอสเพรสโซ่และไฮไลต์สีอำพัน',
    defaultShadow: 'brutalist',
    defaultPattern: 'grid',
    defaultRadius: 'default',
    colors: {
      bgCanvas: '#F7F3E8',
      bgSurface: '#EFE9D8',
      bgCard: '#FFFDF9',
      borderColor: '#3E2723',
      shadowColor: '#3E2723',
      primary: '#FCD34D',
      primarySoft: '#FEF3C7',
      secondary: '#A3E635',
      secondarySoft: '#ECFCCB',
      info: '#FDBA74',
      infoSoft: '#FFEDD5',
      accentPurple: '#E9D5FF',
      danger: '#FCA5A5',
    },
  },
  {
    id: 'pastel-glass',
    name: 'Soft Lavender & Mint',
    nameTh: 'พาสเทลละมุน (ลาเวนเดอร์-มิ้นท์)',
    badge: 'นุ่มนวล ทันสมัย',
    description: 'โทนสีพาสเทลซอฟต์หวานละมุน ขอบมนโค้งพิเศษพร้อมเงาฟุ้งนุ่มนวล ให้ความรู้สึกผ่อนคลายและเป็นมิตร',
    defaultShadow: 'soft',
    defaultPattern: 'dots',
    defaultRadius: 'rounded',
    colors: {
      bgCanvas: '#FAF5FF',
      bgSurface: '#F3E8FF',
      bgCard: '#FFFFFF',
      borderColor: '#4C1D95',
      shadowColor: '#6D28D9',
      primary: '#E9D5FF',
      primarySoft: '#F3E8FF',
      secondary: '#A7F3D0',
      secondarySoft: '#ECFDF5',
      info: '#BFDBFE',
      infoSoft: '#EFF6FF',
      accentPurple: '#FBCFE8',
      danger: '#FECDD3',
    },
  },
  {
    id: 'rose-quartz',
    name: 'Coral & Peach Studio',
    nameTh: 'คอรัลพีช สดใสโมเดิร์น',
    badge: 'สดใส มีชีวิตชีวา',
    description: 'โทนสีส้มพีชและชมพูคอรัลตัดกับสีเขียวมิ้นท์ ให้บรรยากาศอบอุ่น สดใส และมองเห็นปุ่มคำสั่งชัดเจน',
    defaultShadow: 'brutalist',
    defaultPattern: 'dots',
    defaultRadius: 'rounded',
    colors: {
      bgCanvas: '#FFF7ED',
      bgSurface: '#FFEDD5',
      bgCard: '#FFFFFF',
      borderColor: '#431407',
      shadowColor: '#431407',
      primary: '#FDBA74',
      primarySoft: '#FFEDD5',
      secondary: '#6EE7B7',
      secondarySoft: '#D1FAE5',
      info: '#FDE047',
      infoSoft: '#FEF9C3',
      accentPurple: '#FECDD3',
      danger: '#FCA5A5',
    },
  },
];

const THEME_STORAGE_KEY = 'doe_ui_theme_config_v1';
export const UI_THEME_CHANGED_EVENT = 'doe_ui_theme_changed';

export const DEFAULT_UI_THEME_CONFIG: UIThemeConfig = {
  themeId: 'neo-brutalism',
  shadowStyle: 'brutalist',
  bgPattern: 'dots',
  radiusScale: 'default',
};

export function getUIThemePreset(themeId: UIThemeId): UIThemePreset {
  return UI_THEME_PRESETS.find((t) => t.id === themeId) || UI_THEME_PRESETS[0];
}

export function getSavedUIThemeConfig(): UIThemeConfig {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const preset = getUIThemePreset(parsed.themeId);
      return {
        themeId: preset.id,
        shadowStyle: parsed.shadowStyle || preset.defaultShadow,
        bgPattern: parsed.bgPattern || preset.defaultPattern,
        radiusScale: parsed.radiusScale || preset.defaultRadius,
      };
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_UI_THEME_CONFIG;
}

export function applyUIThemeToDOM(config: UIThemeConfig): void {
  if (typeof document === 'undefined') return;
  const preset = getUIThemePreset(config.themeId);
  const root = document.documentElement;

  root.setAttribute('data-ui-theme', config.themeId);
  root.setAttribute('data-shadow-style', config.shadowStyle);
  root.setAttribute('data-bg-pattern', config.bgPattern);
  root.setAttribute('data-radius-scale', config.radiusScale);

  root.style.setProperty('--theme-bg-canvas', preset.colors.bgCanvas);
  root.style.setProperty('--theme-bg-surface', preset.colors.bgSurface);
  root.style.setProperty('--theme-bg-card', preset.colors.bgCard);
  root.style.setProperty('--theme-border-color', preset.colors.borderColor);
  root.style.setProperty('--theme-shadow-color', preset.colors.shadowColor);
  root.style.setProperty('--theme-primary', preset.colors.primary);
  root.style.setProperty('--theme-primary-soft', preset.colors.primarySoft);
  root.style.setProperty('--theme-secondary', preset.colors.secondary);
  root.style.setProperty('--theme-secondary-soft', preset.colors.secondarySoft);
  root.style.setProperty('--theme-info', preset.colors.info);
  root.style.setProperty('--theme-info-soft', preset.colors.infoSoft);
  root.style.setProperty('--theme-accent-purple', preset.colors.accentPurple);
  root.style.setProperty('--theme-danger', preset.colors.danger);
}

export function saveAndApplyUIThemeConfig(config: UIThemeConfig): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage quota errors
  }
  applyUIThemeToDOM(config);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UI_THEME_CHANGED_EVENT, { detail: config }));
  }
}
