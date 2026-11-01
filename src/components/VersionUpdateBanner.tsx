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
      <div className="bg-[#FFFDF7] text-black rounded-2xl p-4 shadow-[8px_8px_0px_0px_#000000] border-3 border-black">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#FFE500] border-2 border-black text-black flex items-center justify-center shrink-0 shadow-[3px_3px_0px_0px_#000000] font-black animate-bounce">
            <Sparkles className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider uppercase bg-[#FFE500] text-black border-2 border-black px-2 py-0.5 rounded-md shadow-[2px_2px_0px_0px_#000000]">
                อัปเดตใหม่
              </span>
              <span className="text-xs font-mono font-black text-black bg-[#6EE7B7] px-2 py-0.5 rounded-md border-2 border-black">
                v{newVersionInfo?.version || 'ใหม่'}
              </span>
            </div>

            <h4 className="text-sm font-black text-black mt-1.5">
              ระบบมีเวอร์ชันใหม่พร้อมใช้งาน
            </h4>
            <p className="text-xs text-slate-800 font-bold mt-0.5 leading-relaxed">
              เพื่อให้ข้อมูลและการทำงานตรงกันกับผู้ใช้งานทุกคน กรุณากดอัปเดตระบบ
            </p>
            {newVersionInfo?.description && (
              <p className="text-[11px] text-slate-900 font-bold mt-1 italic bg-[#FEF3C7] px-2 py-0.5 rounded border border-black">
                "{newVersionInfo.description}"
              </p>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleUpdateClick}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFE500] hover:bg-[#facc15] border-2 border-black text-black font-black text-xs shadow-[3px_3px_0px_0px_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                <span>{isUpdating ? 'กำลังอัปเดต...' : 'กดอัปเดตระบบทันที'}</span>
              </button>

              <button
                type="button"
                onClick={onDismiss}
                className="px-3 py-2 rounded-xl border-2 border-black bg-white text-black hover:bg-slate-100 text-xs font-black shadow-[2px_2px_0px_0px_#000000] transition cursor-pointer"
              >
                ไว้ทีหลัง
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="text-black bg-white hover:bg-[#FF6B6B] border-2 border-black p-1 rounded-lg shadow-[2px_2px_0px_0px_#000000] transition cursor-pointer"
            title="ปิดการแจ้งเตือน"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
