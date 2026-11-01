import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#FFE500] border-2 border-black px-3.5 py-2 text-xs font-black text-black shadow-[4px_4px_0px_0px_#000000] animate-in slide-in-from-bottom-2">
      <WifiOff className="w-4 h-4 text-black shrink-0 animate-pulse" />
      <span>โหมดออฟไลน์ — กำลังใช้งานข้อมูลที่บันทึกไว้ในเครื่อง</span>
    </div>
  );
};
