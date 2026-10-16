import React, { useState } from 'react';
import { Sparkles, RefreshCw, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { VersionInfo } from '../utils/versionCheck';

interface VersionUpdateBannerProps {
  hasNewVersion: boolean;
  newVersionInfo: VersionInfo | null;
  onUpdate: () => void;
  onDismiss: () => void;
}

export const VersionUpdateBanner: React.FC<VersionUpdateBannerProps> = ({
  hasNewVersion,
  newVersionInfo,
  onUpdate,
  onDismiss,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  if (!hasNewVersion) return null;

  const handleUpdateClick = () => {
    setIsUpdating(true);
    onUpdate();
  };

  return (
    <div className="fixed top-20 inset-x-4 sm:inset-x-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white rounded-2xl p-4 shadow-2xl border-2 border-amber-400/80 ring-4 ring-blue-900/30">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-blue-950 flex items-center justify-center shrink-0 shadow-md font-bold animate-bounce">
            <Sparkles className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider uppercase bg-amber-400 text-blue-950 px-2 py-0.5 rounded-md">
                อัปเดตใหม่
              </span>
              <span className="text-xs font-mono font-bold text-amber-300">
                v{newVersionInfo?.version || 'ใหม่'}
              </span>
            </div>

            <h4 className="text-sm font-bold text-white mt-1">
              ระบบมีเวอร์ชันใหม่พร้อมใช้งาน
            </h4>
            <p className="text-xs text-blue-200 mt-0.5 leading-relaxed">
              เพื่อให้ข้อมูลและการทำงานตรงกันกับผู้ใช้งานทุกคน กรุณากดอัปเดตระบบ
            </p>
            {newVersionInfo?.description && (
              <p className="text-[11px] text-amber-200/90 mt-1 italic">
                "{newVersionInfo.description}"
              </p>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleUpdateClick}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-95 text-blue-950 font-extrabold text-xs shadow-md shadow-amber-500/25 transition cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                <span>{isUpdating ? 'กำลังอัปเดต...' : 'กดอัปเดตระบบทันที'}</span>
              </button>

              <button
                type="button"
                onClick={onDismiss}
                className="px-3 py-2 rounded-xl border border-white/20 text-blue-200 hover:bg-white/10 text-xs font-medium transition cursor-pointer"
              >
                ไว้ทีหลัง
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            title="ปิดการแจ้งเตือน"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
