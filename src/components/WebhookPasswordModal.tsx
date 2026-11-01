import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, X, AlertCircle } from 'lucide-react';

interface WebhookPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CORRECT_PASSWORD = '0841543524';

export const WebhookPasswordModal: React.FC<WebhookPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setShowPassword(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setError(null);
      onSuccess();
    } else {
      setError('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      inputRef.current?.select();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#FFFDF7] rounded-2xl max-w-md w-full p-6 shadow-[10px_10px_0px_0px_#000000] border-3 border-black animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#E9D5FF] border-2 border-black text-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000000]">
              <Lock className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="text-base font-black text-black">
                ยืนยันรหัสผ่านผู้ดูแลระบบ
              </h3>
              <p className="text-xs text-slate-800 font-bold mt-0.5">
                เพื่อเปิดการจัดการ Webhook และแสดงข้อมูลการเชื่อมต่อ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border-2 border-black bg-white text-black hover:bg-[#FF6B6B] shadow-[2px_2px_0px_0px_#000000] transition cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-black text-black mb-1.5">
              รหัสผ่าน (Password):
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="ระบุรหัสผ่านเพื่อเข้าใช้งาน"
                className={`w-full pl-3.5 pr-10 py-2.5 border-2 border-black rounded-xl text-sm font-mono font-black tracking-wider focus:outline-hidden shadow-[3px_3px_0px_0px_#000000] transition ${
                  error 
                    ? 'bg-[#FECACA] text-black' 
                    : 'bg-white focus:bg-[#FFFDF7] text-black'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black hover:opacity-70 cursor-pointer"
                title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-[#FECACA] border-2 border-black text-xs font-black text-black animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="bg-[#E9D5FF] border-2 border-black rounded-xl p-3 text-xs text-black font-bold flex items-start gap-2 shadow-[3px_3px_0px_0px_#000000]">
            <ShieldCheck className="w-4 h-4 text-black shrink-0 mt-0.5" />
            <span>
              เมื่อใส่รหัสผ่านถูกต้อง ระบบจะเปิดหน้าต่าง <strong>จัดการ Webhook</strong> และปลดล็อกแสดงหัวข้อแถบเชื่อมต่อ Google Sheets ให้ทันที
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border-2 border-black bg-white text-xs font-black text-black hover:bg-slate-100 shadow-[3px_3px_0px_0px_#000000] transition cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={!password.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFE500] hover:bg-[#facc15] border-2 border-black disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-black shadow-[4px_4px_0px_0px_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>ยืนยันรหัสผ่าน</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
