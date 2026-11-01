import React, { useState, useEffect, useRef } from 'react';
import { Mail, Copy, Check, X, MessageSquareWarning, ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface RobotHelpWidgetProps {
  onNotify?: (message: string) => void;
}

const POSITION_STORAGE_KEY = 'jeabnakub_robot_side';

export const RobotHelpWidget: React.FC<RobotHelpWidgetProps> = ({ onNotify }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [side, setSide] = useState<'right' | 'left'>(() => {
    try {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY);
      return saved === 'left' ? 'left' : 'right';
    } catch {
      return 'right';
    }
  });
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);

  const widgetRef = useRef<HTMLDivElement>(null);
  const dragStartXRef = useRef<number | null>(null);
  const didMoveRef = useRef(false);

  const email = 'mou.center2@gmail.com';

  // Save side preference
  useEffect(() => {
    try {
      localStorage.setItem(POSITION_STORAGE_KEY, side);
    } catch {
      // ignore storage errors
    }
  }, [side]);

  // Clicking outside the widget sets it back to idle (translucent) state
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsActive(false);
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyEmail = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsActive(true);
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      onNotify?.(`คัดลอกอีเมล ${email} เรียบร้อยแล้ว`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify?.(`อีเมลแจ้งแก้ไขข้อมูล: ${email}`);
    }
  };

  const toggleSide = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsActive(true);
    setSide((prev) => {
      const next = prev === 'right' ? 'left' : 'right';
      onNotify?.(`ย้ายหุ่นยนต์ JEABNAKUB ไปด้าน${next === 'left' ? 'ซ้าย' : 'ขวา'}ของหน้าจอแล้ว`);
      return next;
    });
  };

  // Pointer drag support so user can also drag JEABNAKUB left or right across the screen
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    dragStartXRef.current = e.clientX;
    didMoveRef.current = false;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging || dragStartXRef.current === null) return;
    const deltaX = e.clientX - dragStartXRef.current;
    if (Math.abs(deltaX) > 8) {
      didMoveRef.current = true;
      setDragOffsetX(deltaX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (didMoveRef.current) {
      // Snap to left or right half of screen based on pointer release X
      const viewportHalf = window.innerWidth / 2;
      const targetSide = e.clientX < viewportHalf ? 'left' : 'right';
      setSide(targetSide);
      setIsActive(true);
    }
    setDragOffsetX(0);
    dragStartXRef.current = null;
  };

  const handleRobotClick = () => {
    // Ignore click if user just finished dragging
    if (didMoveRef.current) {
      didMoveRef.current = false;
      return;
    }

    // If currently translucent/inactive, clicking makes it vivid (opaque) and opens the message
    if (!isActive) {
      setIsActive(true);
      setIsOpen(true);
    } else {
      // Toggle message bubble if already active
      const nextOpen = !isOpen;
      setIsOpen(nextOpen);
      if (!nextOpen) {
        setIsActive(false);
      }
    }
  };

  const handleCloseBubble = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    setIsActive(false);
  };

  // Active = 100% clear & sharp; Idle (not in use) = translucent
  const isClear = isActive || isOpen || isDragging;

  return (
    <div
      ref={widgetRef}
      onClick={() => {
        if (!isActive) setIsActive(true);
      }}
      style={
        dragOffsetX !== 0
          ? { transform: `translateX(${dragOffsetX}px)` }
          : undefined
      }
      className={`fixed bottom-5 ${
        side === 'right' ? 'right-5 items-end' : 'left-5 items-start'
      } z-40 flex flex-col gap-2.5 print:hidden select-none transition-opacity duration-300 ${
        isClear ? 'opacity-100' : 'opacity-35'
      }`}
    >
      {/* Speech Bubble Card */}
      {isOpen && (
        <div
          role="status"
          aria-live="polite"
          className="relative w-[300px] sm:w-[350px] bg-[#FFFDF7] border-3 border-black rounded-2xl shadow-[5px_5px_0px_0px_#000000] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {/* Top Neo-Brutalist Header Strip */}
          <div className="bg-[#FFE500] border-b-2 border-black px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-black text-[#FFE500] rounded-md border border-black shrink-0">
                <MessageSquareWarning className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-black text-black tracking-wide uppercase truncate">
                JEABNAKUB • หุ่นยนต์แจ้งเตือน
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Switch Left/Right Side Button */}
              <button
                type="button"
                onClick={toggleSide}
                title={side === 'right' ? 'ย้าย JEABNAKUB ไปด้านซ้ายจอ' : 'ย้าย JEABNAKUB ไปด้านขวาจอ'}
                className="px-2 h-6 rounded-md bg-[#6EE7B7] hover:bg-[#60A5FA] border-2 border-black flex items-center gap-1 text-[10px] font-black text-black transition-colors shadow-[1px_1px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
              >
                <ArrowLeftRight className="w-3 h-3 stroke-[2.5]" />
                <span>{side === 'right' ? 'ย้ายไปซ้าย' : 'ย้ายไปขวา'}</span>
              </button>

              {/* Close / Minimize Button */}
              <button
                type="button"
                onClick={handleCloseBubble}
                title="ย่อหน้าต่างแจ้งเตือน (โหมดโปร่งแสง)"
                className="w-6 h-6 rounded-md bg-white border-2 border-black flex items-center justify-center text-black hover:bg-[#FF6B6B] transition-colors shadow-[1px_1px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Message Body */}
          <div className="p-3.5 space-y-2.5 bg-white">
            <p className="text-xs sm:text-sm font-bold text-black leading-relaxed">
              กรณีบันทึกข้อมูลผิดพลาดให้แจ้งรายละเอียดที่ E-mail{' '}
              <a
                href={`mailto:${email}?subject=${encodeURIComponent('แจ้งแก้ไขข้อมูลที่บันทึกผิดพลาด - ระบบทะเบียนคุมเงินประกัน')}`}
                className="inline-block font-mono font-black text-black bg-[#6EE7B7] px-1.5 py-0.5 rounded border-2 border-black shadow-[2px_2px_0px_0px_#000000] hover:bg-[#FFE500] transition-colors break-all"
              >
                {email}
              </a>
            </p>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleCopyEmail}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#E9D5FF] hover:bg-[#FFE500] text-black font-black text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>คัดลอกอีเมลแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span>คัดลอก E-mail</span>
                  </>
                )}
              </button>

              <a
                href={`mailto:${email}?subject=${encodeURIComponent('แจ้งแก้ไขข้อมูลที่บันทึกผิดพลาด - ระบบทะเบียนคุมเงินประกัน')}`}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#60A5FA] hover:bg-[#FFE500] text-black font-black text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              >
                <Mail className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>ส่งอีเมล</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Mascot Row with Quick Side-Switch Button */}
      <div className={`flex items-center gap-2 ${side === 'left' ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Quick Side Switch Button */}
        <button
          type="button"
          onClick={toggleSide}
          title={side === 'right' ? 'ย้ายหุ่นยนต์ JEABNAKUB ไปด้านซ้ายจอ' : 'ย้ายหุ่นยนต์ JEABNAKUB ไปด้านขวาจอ'}
          className="w-9 h-9 rounded-xl bg-[#FFE500] hover:bg-[#6EE7B7] text-black border-2 border-black shadow-[3px_3px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_#000000] flex items-center justify-center transition-all cursor-pointer"
        >
          {side === 'right' ? (
            <ChevronLeft className="w-5 h-5 stroke-[2.8]" />
          ) : (
            <ChevronRight className="w-5 h-5 stroke-[2.8]" />
          )}
        </button>

        {/* Floating Neo-Brutalist Robot Mascot Button */}
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleRobotClick}
          title={
            isClear
              ? 'คลิกเพื่อสลับการแสดงผล หรือลากเพื่อย้ายซ้าย-ขวา'
              : 'คลิกเพื่อให้หุ่นยนต์ JEABNAKUB แสดงผลชัดเจน (กรณีบันทึกข้อมูลผิดพลาดแจ้งที่ mou.center2@gmail.com)'
          }
          className="group relative flex items-center gap-2.5 bg-[#60A5FA] hover:bg-[#FFE500] text-black px-3 py-2 rounded-2xl border-3 border-black shadow-[4px_4px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000000] transition-all cursor-pointer touch-none"
        >
          {/* Notification Badge when minimized */}
          {!isOpen && (
            <span
              className={`absolute -top-2.5 ${
                side === 'right' ? '-left-2' : '-right-2'
              } flex items-center gap-1 bg-[#FF6B6B] text-black text-[10px] font-black px-2 py-0.5 rounded-md border-2 border-black shadow-[2px_2px_0px_0px_#000000]`}
            >
              แจ้งแก้ไขข้อมูล
            </span>
          )}

          {/* Custom Neo-Brutalist SVG Robot Character */}
          <div className="relative w-11 h-11 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000000] flex items-center justify-center overflow-visible shrink-0">
            <svg
              viewBox="0 0 64 64"
              className="w-10 h-10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Antenna */}
              <line x1="32" y1="6" x2="32" y2="15" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="32" cy="6" r="4.5" fill="#FF6B6B" stroke="#000000" strokeWidth="3" />

              {/* Side Ears / Bolts */}
              <rect x="6" y="25" width="6" height="12" rx="2" fill="#FFE500" stroke="#000000" strokeWidth="3" />
              <rect x="52" y="25" width="6" height="12" rx="2" fill="#FFE500" stroke="#000000" strokeWidth="3" />

              {/* Robot Head */}
              <rect x="12" y="15" width="40" height="32" rx="8" fill="#6EE7B7" stroke="#000000" strokeWidth="3.5" />

              {/* Face Screen */}
              <rect x="17" y="20" width="30" height="16" rx="4" fill="#000000" />

              {/* Glowing Eyes */}
              <circle cx="25" cy="28" r="3.5" fill="#FFE500" />
              <circle cx="39" cy="28" r="3.5" fill="#FFE500" />
              <circle cx="26" cy="27" r="1.2" fill="#FFFFFF" />
              <circle cx="40" cy="27" r="1.2" fill="#FFFFFF" />

              {/* Happy Robot Smile / Speaker Grille */}
              <rect x="24" y="39" width="16" height="4" rx="2" fill="#FFFFFF" stroke="#000000" strokeWidth="2.5" />

              {/* Robot Shoulders / Body Hint */}
              <path
                d="M20 47H44L47 56H17L20 47Z"
                fill="#E9D5FF"
                stroke="#000000"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Compact Label on the Mascot Button */}
          <div className="text-left pr-1">
            <div className="text-xs font-black uppercase tracking-wider text-black leading-tight">
              JEABNAKUB
            </div>
            <div className="text-[11px] font-bold text-black/80 leading-tight">
              {isOpen ? 'คลิกเพื่อย่อข้อความ' : 'คลิกเพื่อดูข้อมูลแจ้งแก้ไข'}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
