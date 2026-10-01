import React, { useState } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
        title="ติดตั้งเป็นแอปพลิเคชันบนอุปกรณ์ (Web App)"
      >
        <Download className="w-3.5 h-3.5" />
        <span>ติดตั้ง Web App</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer"
          title="วิธีติดตั้งบน iOS"
        >
          <Smartphone className="w-3.5 h-3.5 text-slate-500" />
          <span>ติดตั้งบน iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">ติดตั้งบน iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <p>
                    กดปุ่ม <strong>แชร์ (Share)</strong> <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">⎋</span> ที่แถบเมนู Safari ด้านล่าง
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <p>
                    เลื่อนลงแล้วเลือก <strong>"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</strong>
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <p>
                    กด <strong>"เพิ่ม" (Add)</strong> มุมขวาบน เพื่อเปิดใช้งานเหมือนแอปจริง
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  const [showDesktopGuide, setShowDesktopGuide] = useState(false);

  // Fallback for desktop/browsers where beforeinstallprompt hasn't fired yet:
  return (
    <>
      <button
        onClick={() => setShowDesktopGuide(true)}
        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium transition cursor-pointer"
        title="วิธีติดตั้งเป็น Web App บนคอมพิวเตอร์"
      >
        <Download className="w-3.5 h-3.5 text-slate-500" />
        <span>ติดตั้ง App</span>
      </button>

      {showDesktopGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">ติดตั้ง Web App บนอุปกรณ์</h3>
              </div>
              <button
                onClick={() => setShowDesktopGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <p>
                ท่านสามารถติดตั้งแอปพลิเคชันนี้เพื่อใช้งานเสมือนแอปบนคอมพิวเตอร์และมือถือได้ทันที:
              </p>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] space-y-1.5 text-slate-700">
                <div>• <strong>Chrome / Edge บนคอมพิวเตอร์:</strong> คลิกไอคอน <em>"ติดตั้งแอป" (Install)</em> บริเวณขวาสุดของแถบ URL ด้านบน</div>
                <div>• <strong>Android:</strong> แตะเมนู ⋮ แล้วเลือก <em>"ติดตั้งแอป" (Install App)</em></div>
                <div>• <strong>iPhone / iPad:</strong> แตะปุ่มแชร์ แล้วเลือก <em>"เพิ่มไปยังหน้าจอโฮม"</em></div>
              </div>
            </div>

            <button
              onClick={() => setShowDesktopGuide(false)}
              className="w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}
    </>
  );
};
