import React from 'react';
import {
  Palette,
  Check,
  X,
  RotateCcw,
  Layers,
  Grid,
  Square,
  Sparkles,
} from 'lucide-react';
import {
  UI_THEME_PRESETS,
  UIThemeConfig,
  UIThemePreset,
  ShadowStyle,
  BgPattern,
  RadiusScale,
  DEFAULT_UI_THEME_CONFIG,
} from '../utils/themeConfig';

interface ThemeGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: UIThemeConfig;
  onSelectConfig: (newConfig: UIThemeConfig, notifyMsg?: string) => void;
  inlineMode?: boolean;
}

export const ThemeGalleryModal: React.FC<ThemeGalleryModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onSelectConfig,
  inlineMode = false,
}) => {
  if (!isOpen && !inlineMode) return null;

  const handleSelectPreset = (preset: UIThemePreset) => {
    const nextConfig: UIThemeConfig = {
      themeId: preset.id,
      shadowStyle: preset.defaultShadow,
      bgPattern: preset.defaultPattern,
      radiusScale: preset.defaultRadius,
    };
    onSelectConfig(nextConfig, `เปลี่ยนธีมเป็น "${preset.nameTh}" (${preset.name}) เรียบร้อยแล้ว`);
  };

  const handleShadowChange = (shadowStyle: ShadowStyle) => {
    onSelectConfig({
      ...currentConfig,
      shadowStyle,
    });
  };

  const handlePatternChange = (bgPattern: BgPattern) => {
    onSelectConfig({
      ...currentConfig,
      bgPattern,
    });
  };

  const handleRadiusChange = (radiusScale: RadiusScale) => {
    onSelectConfig({
      ...currentConfig,
      radiusScale,
    });
  };

  const handleResetDefault = () => {
    onSelectConfig(
      DEFAULT_UI_THEME_CONFIG,
      'คืนค่าธีมเริ่มต้น (Neo-Brutalism Pop) เรียบร้อยแล้ว'
    );
  };

  const activePreset =
    UI_THEME_PRESETS.find((t) => t.id === currentConfig.themeId) || UI_THEME_PRESETS[0];

  const galleryCard = (
    <div
      className={
        inlineMode
          ? 'bg-white rounded-2xl w-full border-3 border-black shadow-[8px_8px_0px_0px_#000000] overflow-hidden flex flex-col'
          : 'bg-white rounded-2xl max-w-5xl w-full border-3 border-black shadow-[10px_10px_0px_0px_#000000] overflow-hidden flex flex-col max-h-[92vh]'
      }
    >
      {/* Top Header */}
      <div className="bg-[#FFE500] px-5 py-4 sm:px-6 border-b-3 border-black flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000000] flex items-center justify-center shrink-0">
            <Palette className="w-6 h-6 text-black stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-xl font-black text-black tracking-tight">
                UI Design Themes Gallery · คลังธีมดีไซน์ระบบ
              </h2>
              <span className="text-[11px] font-black bg-white text-black px-2.5 py-0.5 rounded-md border-2 border-black shadow-[2px_2px_0px_0px_#000000]">
                กำลังใช้งาน: {activePreset.nameTh}
              </span>
            </div>
            <p className="text-xs font-bold text-neutral-800 mt-0.5">
              เลือกเปลี่ยนโทนสี สไตล์กรอบเงา และพื้นหลังของระบบได้ทันทีตามความถนัดของสายตา (บันทึกค่าให้อัตโนมัติ)
            </p>
          </div>
        </div>

        {!inlineMode && (
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-[#FF6B6B] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center justify-center transition cursor-pointer shrink-0"
            title="ปิดหน้าต่างคลังธีม"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}
      </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 bg-[#FAF7F0]">
          {/* Section 1: 8 Curated UI Theme Presets Grid */}
          <div>
            <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-black stroke-[2.5]" />
                <h3 className="text-sm sm:text-base font-black text-black">
                  1. เลือกชุดธีมหลัก (8 Curated UI Design Themes)
                </h3>
              </div>
              <span className="text-xs font-bold text-neutral-700">
                คลิกที่การ์ดเพื่อเปลี่ยนธีมแบบเรียลไทม์ทันที
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {UI_THEME_PRESETS.map((preset) => {
                const isSelected = currentConfig.themeId === preset.id;
                const previewRadius =
                  preset.defaultRadius === 'sharp'
                    ? '4px'
                    : preset.defaultRadius === 'rounded'
                    ? '14px'
                    : '8px';
                const previewShadow =
                  preset.defaultShadow === 'brutalist'
                    ? `3px 3px 0px 0px ${preset.colors.shadowColor}`
                    : preset.defaultShadow === 'soft'
                    ? `0 4px 12px -2px ${preset.colors.shadowColor}33`
                    : 'none';

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`group text-left rounded-xl border-2 border-black bg-white overflow-hidden transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'ring-3 ring-black shadow-[6px_6px_0px_0px_#000000] -translate-x-0.5 -translate-y-0.5'
                        : 'shadow-[3px_3px_0px_0px_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000000]'
                    }`}
                  >
                    {/* Visual Mini-UI Preview Stage */}
                    <div
                      style={{
                        backgroundColor: preset.colors.bgCanvas,
                        borderBottom: `2px solid ${preset.colors.borderColor}`,
                      }}
                      className="p-3 relative overflow-hidden"
                    >
                      {/* Mini App Header Bar */}
                      <div
                        style={{
                          backgroundColor: preset.colors.primary,
                          border: `2px solid ${preset.colors.borderColor}`,
                          borderRadius: previewRadius,
                          boxShadow: previewShadow,
                        }}
                        className="px-2.5 py-1.5 flex items-center justify-between mb-2.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            style={{
                              backgroundColor: preset.colors.bgCard,
                              border: `1.5px solid ${preset.colors.borderColor}`,
                            }}
                            className="w-3.5 h-3.5 rounded-xs inline-block"
                          />
                          <span className="text-[10px] font-black text-slate-900 tracking-tight truncate">
                            {preset.name}
                          </span>
                        </div>
                        <span
                          style={{
                            backgroundColor: preset.colors.secondary,
                            border: `1.5px solid ${preset.colors.borderColor}`,
                          }}
                          className="w-6 h-2.5 rounded-xs inline-block"
                        />
                      </div>

                      {/* Mini 2-Column Content Preview */}
                      <div className="grid grid-cols-2 gap-2">
                        <div
                          style={{
                            backgroundColor: preset.colors.bgCard,
                            border: `1.5px solid ${preset.colors.borderColor}`,
                            borderRadius: previewRadius,
                            boxShadow: previewShadow,
                          }}
                          className="p-2 space-y-1.5"
                        >
                          <div
                            style={{ backgroundColor: preset.colors.infoSoft }}
                            className="h-2 w-12 rounded-xs"
                          />
                          <div className="h-1.5 w-full bg-slate-200 rounded-xs" />
                          <div className="h-1.5 w-4/5 bg-slate-200 rounded-xs" />
                        </div>

                        <div
                          style={{
                            backgroundColor: preset.colors.secondarySoft,
                            border: `1.5px solid ${preset.colors.borderColor}`,
                            borderRadius: previewRadius,
                            boxShadow: previewShadow,
                          }}
                          className="p-2 flex flex-col justify-between"
                        >
                          <div className="text-[9px] font-mono font-black text-slate-900">
                            1,000 ฿
                          </div>
                          <div
                            style={{
                              backgroundColor: preset.colors.primary,
                              border: `1.5px solid ${preset.colors.borderColor}`,
                            }}
                            className="h-3 w-full rounded-xs"
                          />
                        </div>
                      </div>

                      {/* Active Check Badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-black text-[#FFE500] text-[10px] font-black px-2 py-0.5 rounded-md border border-white flex items-center gap-1 shadow-sm">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>ใช้อยู่</span>
                        </div>
                      )}
                    </div>

                    {/* Card Details & Palette Swatches */}
                    <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between bg-white">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <h4 className="text-xs font-black text-black">
                            {preset.nameTh}
                          </h4>
                        </div>
                        <div className="text-[10px] font-extrabold text-neutral-600 mb-1.5">
                          {preset.name} · {preset.badge}
                        </div>
                        <p className="text-[11px] font-medium text-neutral-700 leading-snug">
                          {preset.description}
                        </p>
                      </div>

                      {/* Color Swatch Strip */}
                      <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {[
                            preset.colors.bgCanvas,
                            preset.colors.primary,
                            preset.colors.secondary,
                            preset.colors.info,
                            preset.colors.accentPurple,
                          ].map((hex, idx) => (
                            <span
                              key={idx}
                              style={{
                                backgroundColor: hex,
                                borderColor: preset.colors.borderColor,
                              }}
                              className="w-4 h-4 rounded-full border-2 inline-block"
                              title={hex}
                            />
                          ))}
                        </div>
                        <span className="text-[10.5px] font-black text-black group-hover:underline">
                          {isSelected ? 'กำลังใช้งาน' : 'เลือกธีมนี้ →'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Fine-Tune Style Controls (Shadow, Pattern, Corner Radius) */}
          <div className="bg-white rounded-xl border-2 border-black p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000000] space-y-4">
            <div className="flex items-center justify-between pb-2.5 border-b-2 border-black flex-wrap gap-2">
              <h3 className="text-xs sm:text-sm font-black text-black flex items-center gap-2">
                <Layers className="w-4 h-4 stroke-[2.5]" />
                <span>2. ปรับแต่งรายละเอียดสไตล์เพิ่มเติม (Custom Style Modifiers)</span>
              </h3>
              <span className="text-[11px] font-bold text-neutral-700">
                สามารถผสมผสานโทนสีด้านบนเข้ากับสไตล์เงาและพื้นหลังที่ชอบได้อิสระ
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Control 1: Shadow & Depth */}
              <div className="space-y-2">
                <label className="text-xs font-black text-black flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>สไตล์กรอบและเงา (Shadow Style)</span>
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    {
                      id: 'brutalist' as ShadowStyle,
                      label: 'Neo-Brutalist (เงาตัดคมชัด)',
                      desc: 'ขอบเข้ม เงาตัด 3D สไตล์ Pop',
                    },
                    {
                      id: 'soft' as ShadowStyle,
                      label: 'Modern Soft (เงานุ่มนวล)',
                      desc: 'เงาฟุ้งละมุนสบายตาแบบ SaaS สมัยใหม่',
                    },
                    {
                      id: 'flat' as ShadowStyle,
                      label: 'Minimal Flat (แบนเรียบคลีน)',
                      desc: 'ไร้เงา เน้นเส้นตารางคมชัดสะอาดตา',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleShadowChange(opt.id)}
                      className={`px-3 py-2 rounded-lg border-2 border-black text-left transition flex items-center justify-between cursor-pointer ${
                        currentConfig.shadowStyle === opt.id
                          ? 'bg-[#FFE500] shadow-[2px_2px_0px_0px_#000000]'
                          : 'bg-white hover:bg-neutral-100'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black text-black">{opt.label}</div>
                        <div className="text-[10px] font-bold text-neutral-700">{opt.desc}</div>
                      </div>
                      {currentConfig.shadowStyle === opt.id && (
                        <Check className="w-4 h-4 text-black shrink-0 stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Control 2: Canvas Background Pattern */}
              <div className="space-y-2">
                <label className="text-xs font-black text-black flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5" />
                  <span>ลวดลายพื้นหลัง (Background Pattern)</span>
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    {
                      id: 'dots' as BgPattern,
                      label: 'ลายจุด (Polka Dots)',
                      desc: 'พื้นหลังจุดดอทละเอียด สไตล์สมุดโน้ต',
                    },
                    {
                      id: 'grid' as BgPattern,
                      label: 'ตารางกริด (Engineering Grid)',
                      desc: 'เส้นตารางสมุดบัญชี / บลูพริ้นท์',
                    },
                    {
                      id: 'solid' as BgPattern,
                      label: 'พื้นเรียบ (Solid Clean)',
                      desc: 'สีพื้นเรียบสะอาดตา ไม่มีลวดลาย',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handlePatternChange(opt.id)}
                      className={`px-3 py-2 rounded-lg border-2 border-black text-left transition flex items-center justify-between cursor-pointer ${
                        currentConfig.bgPattern === opt.id
                          ? 'bg-[#6EE7B7] shadow-[2px_2px_0px_0px_#000000]'
                          : 'bg-white hover:bg-neutral-100'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black text-black">{opt.label}</div>
                        <div className="text-[10px] font-bold text-neutral-700">{opt.desc}</div>
                      </div>
                      {currentConfig.bgPattern === opt.id && (
                        <Check className="w-4 h-4 text-black shrink-0 stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Control 3: Corner Radius */}
              <div className="space-y-2">
                <label className="text-xs font-black text-black flex items-center gap-1.5">
                  <Square className="w-3.5 h-3.5" />
                  <span>ความโค้งมนของกรอบ (Corner Radius)</span>
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    {
                      id: 'default' as RadiusScale,
                      label: 'โค้งมาตรฐาน (Balanced)',
                      desc: 'มุมโค้งกำลังดี อ่านง่าย เป็นระเบียบ',
                    },
                    {
                      id: 'rounded' as RadiusScale,
                      label: 'โค้งมนพิเศษ (Soft Rounded)',
                      desc: 'มุมโค้งมนละมุน ทันสมัย เป็นมิตร',
                    },
                    {
                      id: 'sharp' as RadiusScale,
                      label: 'เหลี่ยมคมชัด (Sharp Editorial)',
                      desc: 'มุมตัดคมกริบ สไตล์เอกสารทางการ',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleRadiusChange(opt.id)}
                      className={`px-3 py-2 rounded-lg border-2 border-black text-left transition flex items-center justify-between cursor-pointer ${
                        currentConfig.radiusScale === opt.id
                          ? 'bg-[#BFDBFE] shadow-[2px_2px_0px_0px_#000000]'
                          : 'bg-white hover:bg-neutral-100'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black text-black">{opt.label}</div>
                        <div className="text-[10px] font-bold text-neutral-700">{opt.desc}</div>
                      </div>
                      {currentConfig.radiusScale === opt.id && (
                        <Check className="w-4 h-4 text-black shrink-0 stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 sm:px-6 bg-white border-t-3 border-black flex items-center justify-between flex-wrap gap-3 shrink-0">
          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-black bg-white hover:bg-[#FECACA] text-black text-xs font-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>คืนค่าธีมต้นฉบับ (Neo-Brutalism)</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl border-2 border-black bg-[#6EE7B7] hover:bg-[#34D399] text-black text-xs sm:text-sm font-black shadow-[3px_3px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{inlineMode ? 'กลับไปยังหน้าแบบฟอร์มบันทึก' : 'ใช้งานธีมนี้'}</span>
            </button>
          </div>
        </div>
      </div>
  );

  if (inlineMode) {
    return galleryCard;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150 print:hidden">
      {galleryCard}
    </div>
  );
};
