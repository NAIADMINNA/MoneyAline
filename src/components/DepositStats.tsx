import React, { useState, useMemo } from 'react';
import { 
  CircleDollarSign, 
  Users, 
  FileCheck2, 
  Building, 
  TrendingUp, 
  Download,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  Filter,
  Check,
  Layers,
  Sparkles,
  RefreshCw,
  RotateCcw,
  ArrowDownWideNarrow
} from 'lucide-react';
import { DepositRecord } from '../types/deposit';
import { formatThaiCurrency, formatNumber } from '../utils/thaiBahtText';
import { exportDatabaseToCSV } from '../utils/csvDatabaseExport';
import { BANGKOK_EMPLOYMENT_OFFICES, PROVINCIAL_EMPLOYMENT_OFFICES, normalizeAlienCategory } from '../data/initialData';

interface DepositStatsProps {
  records: DepositRecord[];
  onNotify?: (msg: string) => void;
  accessToken?: string | null;
  onRefreshFromSheet?: () => Promise<void>;
  isRefreshing?: boolean;
  onClearAllRecords?: () => void;
  lastSyncTime?: string;
  syncCountdown?: number;
  isAutoSyncing?: boolean;
  onExportSuccess?: () => void;
}

export const DepositStats: React.FC<DepositStatsProps> = ({ 
  records, 
  onNotify, 
  accessToken, 
  onRefreshFromSheet,
  isRefreshing = false,
  onClearAllRecords,
  lastSyncTime,
  syncCountdown = 20,
  isAutoSyncing = false,
  onExportSuccess
}) => {
  // Strictly filter out any table header rows (แถวแรกที่เป็นหัวตาราง ไม่นับมาคำนวณในสถิติ)
  const cleanRecords = useMemo(() => {
    return records.filter(r => {
      if (!r) return false;
    const req = String(r.requestNumber || '').trim();
const emp = String(r.employerName || '').trim();
const office = String(r.employmentOffice || '').trim();
const date = String(r.paymentDate || '').trim();
const book = String(r.receiptBook || '').trim();
      if (
        req.includes('เลขที่คำขอ') ||
        emp.includes('ชื่อนายจ้าง') ||
        office.includes('สำนักงานจัดหางานที่รับคำขอ') ||
        date.includes('วันที่ชำระเงิน') ||
        book.includes('เล่มที่ใบเสร็จ')
      ) {
        return false;
      }
      return true;
    });
  }, [records]);

  // Distinct offices currently found in data records
  const activeOfficesInData = useMemo(() => {
    const list = Array.from(new Set(cleanRecords.map(r => (r.employmentOffice || '').trim()).filter(Boolean)));
    return list.sort();
  }, [cleanRecords]);

  // Selected employment office (Must always be a specific office, never "all")
  const [selectedOffice, setSelectedOffice] = useState<string>(() => {
    const list = Array.from(new Set(cleanRecords.map(r => (r.employmentOffice || '').trim()).filter(Boolean)));
    return list[0] || BANGKOK_EMPLOYMENT_OFFICES[0] || 'สำนักงานจัดหางานกรุงเทพมหานครพื้นที่ 1';
  });

  // หากดึงข้อมูลจาก Google Sheet สำเร็จและสำนักงานที่เลือกอยู่เดิมไม่มีข้อมูล ให้สลับไปยังสำนักงานที่มีข้อมูลอัตโนมัติ
  React.useEffect(() => {
    if (activeOfficesInData.length > 0 && !activeOfficesInData.includes(selectedOffice)) {
      setSelectedOffice(activeOfficesInData[0]);
    }
  }, [activeOfficesInData, selectedOffice]);

  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Filter records strictly by the chosen office
  const filteredRecordsForExport = useMemo(() => {
    if (!selectedOffice) return [];
    return cleanRecords.filter((r) => (r.employmentOffice || '').trim() === selectedOffice.trim());
  }, [cleanRecords, selectedOffice]);

  // Overall metrics across all records
  const totalAmount = cleanRecords.reduce((acc, r) => acc + r.totalAmount, 0);
  const totalWorkers = cleanRecords.reduce((acc, r) => acc + r.alienCount, 0);
  const totalTransactions = cleanRecords.length;
  const juristicCount = cleanRecords.filter(r => r.employerType === 'company').length;
  const individualCount = cleanRecords.filter(r => r.employerType === 'individual').length;

  // Breakdown by employment office
  const officeStats = useMemo(() => {
    return cleanRecords.reduce((acc, r) => {
      const office = (r.employmentOffice || 'ไม่ระบุสำนักงาน').trim();
      if (!acc[office]) {
        acc[office] = { count: 0, workers: 0, amount: 0 };
      }
      acc[office].count += 1;
      acc[office].workers += r.alienCount || 0;
      acc[office].amount += r.totalAmount || 0;
      return acc;
    }, {} as Record<string, { count: number; workers: number; amount: number }>);
  }, [cleanRecords]);

  // เรียงลำดับสำนักงานตามยอดจัดเก็บ ตามมากไปน้อย (descending)
  const sortedOfficeStats = useMemo(() => {
    return Object.entries(officeStats).sort(([, a], [, b]) => {
      if (b.amount !== a.amount) {
        return b.amount - a.amount; // ยอดจัดเก็บ มากไปน้อย
      }
      if (b.workers !== a.workers) {
        return b.workers - a.workers;
      }
      return b.count - a.count;
    });
  }, [officeStats]);

  // Breakdown by alien category (ล็อคเฉพาะ 3 ตัวเลือกที่กำหนดเท่านั้น)
  const categoryStats = useMemo(() => {
    return cleanRecords.reduce((acc, r) => {
      if (r.workers && r.workers.length > 0) {
        r.workers.forEach(w => {
          const cat = normalizeAlienCategory(w.category || r.alienCategory);
          acc[cat] = (acc[cat] || 0) + 1;
        });
      } else {
        const cat = normalizeAlienCategory(r.alienCategory);
        acc[cat] = (acc[cat] || 0) + (r.alienCount || 1);
      }
      return acc;
    }, {} as Record<string, number>);
  }, [cleanRecords]);

  const sortedCategoryStats = useMemo(() => {
    return Object.entries(categoryStats).sort(([, a], [, b]) => b - a);
  }, [categoryStats]);

  // Breakdown by payment channel / method
  const channelStats = cleanRecords.reduce((acc, r) => {
    const key = (r.paymentChannel || 'ชำระผ่านระบบ').split('/')[0].trim();
    acc[key] = (acc[key] || 0) + r.totalAmount;
    return acc;
  }, {} as Record<string, number>);

  // Breakdown by worker nationality
  const nationalityStats = useMemo(() => {
    return cleanRecords.reduce((acc, r) => {
      (r.workers || []).forEach(w => {
        const nat = w.nationality ? w.nationality.split('(')[0].trim() : 'ไม่ระบุ';
        acc[nat] = (acc[nat] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
  }, [cleanRecords]);

  const sortedNationalityStats = useMemo(() => {
    return Object.entries(nationalityStats).sort(([, a], [, b]) => b - a);
  }, [nationalityStats]);

  // Handle Export CSV (exportDatabaseToCSV automatically increments export counter)
  const handleExportCSV = () => {
    if (!selectedOffice) return;

    const exportedCount = exportDatabaseToCSV(cleanRecords, selectedOffice);
    const successMsg = exportedCount > 0
      ? `ส่งออกไฟล์ CSV ฐานข้อมูล (${selectedOffice}) จำนวน ${exportedCount} แถวเรียบร้อยแล้ว`
      : `ส่งออกไฟล์ตารางฐานข้อมูล CSV (${selectedOffice}) เรียบร้อยแล้ว`;

    setExportSuccessMessage(successMsg);
    if (onNotify) onNotify(successMsg);

    setTimeout(() => {
      setExportSuccessMessage(null);
    }, 4500);
  };

  const selectedOfficeStats = useMemo(() => {
    const count = filteredRecordsForExport.length;
    const workers = filteredRecordsForExport.reduce((sum, r) => sum + (r.alienCount || 0), 0);
    const amount = filteredRecordsForExport.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    return { count, workers, amount };
  }, [filteredRecordsForExport]);

  return (
    <div className="w-full max-w-[1600px] 2xl:max-w-[1720px] mx-auto space-y-6 transition-all duration-300">

      {/* CSV Export & Office Selector Panel (ตามที่ผู้ใช้งานร้องขอ) */}
      <div className="bg-[#D1FAE5] rounded-2xl border-3 border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000000] relative overflow-hidden">
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          
          {/* Header & Description */}
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#FFE500] text-black border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000000]">
                <FileSpreadsheet className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-black flex items-center gap-2 flex-wrap">
                  <span>ส่งออกไฟล์ฐานข้อมูล CSV รายสำนักงาน</span>
                  <span className="text-[11px] font-black bg-[#FFE500] text-black px-2.5 py-0.5 rounded-md border-2 border-black shadow-[2px_2px_0px_0px_#000000]">
                    22 คอลัมน์ฐานข้อมูล
                  </span>
                </h3>
              </div>
            </div>
            <p className="text-xs text-neutral-900 font-bold leading-relaxed pt-1">
              เลือกสำนักงานจัดหางานที่ต้องการส่งออกข้อมูล โครงสร้างตารางอ้างอิงตรงตามฐานข้อมูลหลัก Google Sheet พร้อมแปลงวันที่ชำระเงินเป็น <strong className="bg-white px-1.5 py-0.2 border border-black font-black">พ.ศ.</strong> และเข้ารหัส UTF-8 BOM สำหรับเปิดใน Microsoft Excel ได้อย่างถูกต้อง
            </p>
          </div>

          {/* Controls: Office Dropdown & Export Button */}
          <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            
            {/* Employment Office Selection Dropdown (Only specific offices allowed) */}
            <div className="relative min-w-[280px] sm:min-w-[320px]">
              <label className="block text-[11px] font-black text-black mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                <span>เลือกสำนักงานจัดหางาน (ระบุรายสำนักงาน):</span>
              </label>
              <div className="relative">
                <select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  className="w-full pl-3.5 pr-8 py-2.5 text-xs font-extrabold text-black bg-white border-2 border-black rounded-xl focus:outline-none focus:bg-[#FFFBEB] shadow-[3px_3px_0px_0px_#000000] cursor-pointer appearance-none transition"
                >
                  {activeOfficesInData.length > 0 && (
                    <optgroup label="── สำนักงานที่มีรายการในระบบ ──">
                      {activeOfficesInData.map((office) => {
                        const count = cleanRecords.filter(r => (r.employmentOffice || '').trim() === office).length;
                        return (
                          <option key={`active-${office}`} value={office}>
                            ✓ {office} ({count} รายการ)
                          </option>
                        );
                      })}
                    </optgroup>
                  )}

                  <optgroup label="── สำนักงานจัดหางานกรุงเทพมหานคร ──">
                    {BANGKOK_EMPLOYMENT_OFFICES.map((office) => {
                      const count = cleanRecords.filter(r => (r.employmentOffice || '').trim() === office).length;
                      return (
                        <option key={office} value={office}>
                          {office} {count > 0 ? `(${count} รายการ)` : ''}
                        </option>
                      );
                    })}
                  </optgroup>

                  <optgroup label="── สำนักงานจัดหางานจังหวัด ──">
                    {PROVINCIAL_EMPLOYMENT_OFFICES.map((office) => {
                      const count = cleanRecords.filter(r => (r.employmentOffice || '').trim() === office).length;
                      return (
                        <option key={office} value={office}>
                          {office} {count > 0 ? `(${count} รายการ)` : ''}
                        </option>
                      );
                    })}
                  </optgroup>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black">
                  <Filter className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
              </div>
            </div>

            {/* Pull from Google Sheet Button (ALWAYS visible to sync with online sheet) */}
            <div className="sm:self-end">
              <label className="block text-[11px] font-black text-black mb-1 flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                <span>ดึงข้อมูลฐานข้อมูล:</span>
              </label>
              <button
                type="button"
                onClick={onRefreshFromSheet}
                disabled={isRefreshing}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#60A5FA] hover:bg-[#3B82F6] text-black text-xs font-black rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                title="คลิกเพื่อดึงข้อมูลล่าสุดจาก Google Sheet เพื่ออัปเดตสถิติให้ตรงกับฐานข้อมูลจริงทันที"
              >
                <RefreshCw className={`w-4 h-4 text-black stroke-[2.5] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูลจาก Google Sheet'}</span>
              </button>
            </div>

            {/* Export CSV Button (Always 1 row per worker & always clickable) */}
            <div className="sm:self-end">
              <label className="block text-[11px] font-black text-black mb-1 flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                <span>ดาวน์โหลด (แยก 1 แถวต่อคน):</span>
              </label>
              <button
                type="button"
                onClick={handleExportCSV}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#FFE500] hover:bg-[#FDE047] text-black text-xs font-black rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                title={`คลิกเพื่อส่งออกข้อมูล ${selectedOffice}`}
              >
                <Download className="w-4 h-4 text-black stroke-[2.5]" />
                <span>
                  ส่งออกไฟล์ CSV ({filteredRecordsForExport.length} รายการ)
                </span>
              </button>
            </div>

          </div>

        </div>

        {/* Selected office summary preview & Toast */}
        <div className="mt-4 pt-3.5 border-t-2 border-black flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3.5 flex-wrap text-black font-bold">
            <span className="font-extrabold text-black flex items-center gap-1.5">
              <span>สำนักงานที่เลือก:</span>
              <strong className="text-black bg-white border-2 border-black px-2.5 py-0.5 rounded-lg shadow-[2px_2px_0px_0px_#000000]">
                {selectedOffice || 'ยังไม่ได้เลือก'}
              </strong>
            </span>
            <span className="font-black">•</span>
            <span>
              จำนวนคำขอ: <strong className="text-black bg-[#FFE500] px-1.5 py-0.5 rounded border border-black font-mono font-black">{formatNumber(selectedOfficeStats.count)}</strong> ฉบับ
            </span>
            <span className="font-black">•</span>
            <span>
              แรงงานรวม: <strong className="text-black bg-[#BFDBFE] px-1.5 py-0.5 rounded border border-black font-mono font-black">{formatNumber(selectedOfficeStats.workers)}</strong> คน
            </span>
            <span className="font-black">•</span>
            <span>
              ยอดเงินรวม: <strong className="text-black bg-white px-2 py-0.5 rounded border-2 border-black font-mono font-black text-sm shadow-[2px_2px_0px_0px_#000000]">{formatThaiCurrency(selectedOfficeStats.amount)}</strong>
            </span>

            {selectedOfficeStats.count === 0 && (
              <span className="text-black bg-[#FDE68A] border-2 border-black px-2.5 py-0.5 rounded-md font-extrabold text-[11px] shadow-[2px_2px_0px_0px_#000000]">
                สำนักงานนี้ยังไม่มีข้อมูลในระบบ
              </span>
            )}
          </div>

          {exportSuccessMessage && (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FFE500] text-black border-2 border-black rounded-xl text-xs font-black shadow-[3px_3px_0px_0px_#000000] animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-black stroke-[2.5]" />
              <span>{exportSuccessMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3 Metric Cards with Neo-Brutalist High Contrast */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Metric 1: ยอดเงินรวม */}
        <div className="bg-[#BFDBFE] text-black rounded-2xl border-3 border-black p-5 shadow-[6px_6px_0px_0px_#000000] relative overflow-hidden flex items-center justify-between hover:-translate-y-0.5 transition-transform duration-150">
          <div className="space-y-1">
            <p className="text-xs font-black text-neutral-900">ยอดเงินหลักประกันรวมทั้งสิ้น</p>
            <h3 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-black">
              {formatThaiCurrency(totalAmount)}
            </h3>
            <p className="text-[11px] text-black flex items-center gap-1 font-extrabold pt-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-black stroke-[2.5]" />
              <span>อัตราจัดเก็บ 1,000 บาท/คน</span>
            </p>
          </div>
          <div className="w-13 h-13 rounded-xl bg-white text-black border-2 border-black flex items-center justify-center shrink-0 shadow-[3px_3px_0px_0px_#000000]">
            <CircleDollarSign className="w-7 h-7 text-black stroke-[2.5]" />
          </div>
        </div>

        {/* Metric 2: จำนวนแรงงาน */}
        <div className="bg-[#6EE7B7] text-black rounded-2xl border-3 border-black p-5 shadow-[6px_6px_0px_0px_#000000] relative overflow-hidden flex items-center justify-between hover:-translate-y-0.5 transition-transform duration-150">
          <div className="space-y-1">
            <p className="text-xs font-black text-neutral-900">จำนวนแรงงานต่างด้าวรวม</p>
            <h3 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-black">
              {formatNumber(totalWorkers)} <span className="text-base font-extrabold text-black">คน</span>
            </h3>
            <p className="text-[11px] text-black font-extrabold pt-0.5">
              จาก {totalTransactions} รายการคำขอในระบบ
            </p>
          </div>
          <div className="w-13 h-13 rounded-xl bg-white text-black border-2 border-black flex items-center justify-center shrink-0 shadow-[3px_3px_0px_0px_#000000]">
            <Users className="w-7 h-7 text-black stroke-[2.5]" />
          </div>
        </div>

        {/* Metric 3: สัดส่วนนายจ้าง */}
        <div className="bg-[#FDE68A] text-black rounded-2xl border-3 border-black p-5 shadow-[6px_6px_0px_0px_#000000] relative overflow-hidden flex items-center justify-between hover:-translate-y-0.5 transition-transform duration-150">
          <div className="space-y-1">
            <p className="text-xs font-black text-neutral-900">สัดส่วนประเภทนายจ้าง</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base sm:text-lg font-black text-black">
                นิติบุคคล {juristicCount}
              </span>
              <span className="text-black font-black">/</span>
              <span className="text-base sm:text-lg font-black text-black">
                บุคคล {individualCount}
              </span>
            </div>
            <p className="text-[11px] text-black font-extrabold pt-0.5">
              รวมนายจ้าง {juristicCount + individualCount} ราย
            </p>
          </div>
          <div className="w-13 h-13 rounded-xl bg-white text-black border-2 border-black flex items-center justify-center shrink-0 shadow-[3px_3px_0px_0px_#000000]">
            <Building className="w-7 h-7 text-black stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* Breakdown Panels with Neo-Brutalist Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Office Breakdown (สถิติตามสำนักงานจัดหางาน - เรียงจากยอดจัดเก็บ ตามมากไปน้อย) */}
        <div className="bg-white rounded-2xl border-3 border-black p-5 shadow-[6px_6px_0px_0px_#000000]">
          <h4 className="text-sm font-black text-black pb-3 border-b-2 border-black mb-3 flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#6EE7B7] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000000]">
                <Building2 className="w-4 h-4 stroke-[2.5]" />
              </span>
              <span>สถิติตามสำนักงานจัดหางาน</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-black bg-[#FFE500] px-2 py-0.5 rounded-md border-2 border-black font-black shadow-[2px_2px_0px_0px_#000000]" title="เรียงจากยอดจัดเก็บ ตามมากไปน้อย">
              <ArrowDownWideNarrow className="w-3.5 h-3.5 text-black stroke-[2.5]" />
              <span>ยอดจัดเก็บ (มาก ➔ น้อย)</span>
            </span>
          </h4>
          <div className="space-y-3.5 max-h-[560px] overflow-y-auto pr-1">
            {sortedOfficeStats.length === 0 ? (
              <p className="text-xs font-bold text-neutral-500 py-3 text-center">ไม่มีข้อมูลสำนักงาน</p>
            ) : (
              sortedOfficeStats.map(([office, data], index) => {
                const pct = totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0;
                return (
                  <div key={office} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2 text-xs text-black">
                      <div className="flex items-start gap-1.5 min-w-0 flex-1">
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-black shrink-0 mt-0.5 border-2 border-black ${
                          index === 0
                            ? 'bg-[#FFE500] text-black'
                            : index === 1
                            ? 'bg-[#6EE7B7] text-black'
                            : index === 2
                            ? 'bg-[#FDBA74] text-black'
                            : 'bg-[#F3F4F6] text-black'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="font-extrabold text-black leading-snug break-words" title={office}>
                          {office}
                        </span>
                      </div>
                      <span className="font-mono font-black text-black shrink-0 text-right">
                        {formatThaiCurrency(data.amount)} <span className="text-neutral-700 font-bold">({data.workers} คน)</span>
                      </span>
                    </div>
                    <div className="w-full bg-[#F3F4F6] h-3 rounded-md border-2 border-black overflow-hidden">
                      <div 
                        className="bg-[#22C55E] h-full border-r-2 border-black transition-all duration-500" 
                        style={{ width: `${Math.max(pct, 3)}%` }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Nationality Breakdown */}
        <div className="bg-white rounded-2xl border-3 border-black p-5 shadow-[6px_6px_0px_0px_#000000]">
          <h4 className="text-sm font-black text-black pb-3 border-b-2 border-black mb-3 flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#E9D5FF] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000000]">
                <Users className="w-4 h-4 stroke-[2.5]" />
              </span>
              <span>สถิติตามสัญชาติแรงงาน</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-black bg-[#E9D5FF] px-2 py-0.5 rounded-md border-2 border-black font-black shadow-[2px_2px_0px_0px_#000000]">
              <ArrowDownWideNarrow className="w-3.5 h-3.5 text-black stroke-[2.5]" />
              <span>จำนวนคน (มาก ➔ น้อย)</span>
            </span>
          </h4>
          <div className="space-y-3.5 max-h-[560px] overflow-y-auto pr-1">
            {sortedNationalityStats.length === 0 ? (
              <p className="text-xs font-bold text-neutral-500 py-3 text-center">ไม่มีข้อมูลแรงงานในระบบ</p>
            ) : (
              sortedNationalityStats.map(([nat, count], index) => {
                const totalNatWorkers = Object.values(nationalityStats).reduce((a, b) => a + b, 0);
                const pct = totalNatWorkers > 0 ? (count / totalNatWorkers) * 100 : 0;
                return (
                  <div key={nat} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2 text-xs text-black">
                      <div className="flex items-start gap-1.5 min-w-0 flex-1">
                        <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-black shrink-0 mt-0.5 bg-[#E9D5FF] text-black border-2 border-black">
                          {index + 1}
                        </span>
                        <span className="font-extrabold text-black leading-snug break-words">{nat}</span>
                      </div>
                      <span className="font-mono font-black text-black shrink-0 text-right">{formatNumber(count)} คน <span className="text-neutral-700 font-bold">({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div className="w-full bg-[#F3F4F6] h-3 rounded-md border-2 border-black overflow-hidden">
                      <div 
                        className="bg-[#C084FC] h-full border-r-2 border-black transition-all duration-500" 
                        style={{ width: `${Math.max(pct, 3)}%` }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Alien Category Breakdown */}
        <div className="bg-white rounded-2xl border-3 border-black p-5 shadow-[6px_6px_0px_0px_#000000]">
          <h4 className="text-sm font-black text-black pb-3 border-b-2 border-black mb-3 flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#BFDBFE] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000000]">
                <Layers className="w-4 h-4 stroke-[2.5]" />
              </span>
              <span>สถิติตามประเภทแรงงาน</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-black bg-[#BFDBFE] px-2 py-0.5 rounded-md border-2 border-black font-black shadow-[2px_2px_0px_0px_#000000]">
              <ArrowDownWideNarrow className="w-3.5 h-3.5 text-black stroke-[2.5]" />
              <span>จำนวนคน (มาก ➔ น้อย)</span>
            </span>
          </h4>
          <div className="space-y-3.5 max-h-[560px] overflow-y-auto pr-1">
            {sortedCategoryStats.length === 0 ? (
              <p className="text-xs font-bold text-neutral-500 py-3 text-center">ไม่มีข้อมูลประเภทแรงงานในระบบ</p>
            ) : (
              sortedCategoryStats.map(([cat, count], index) => {
                const pct = totalWorkers > 0 ? (count / totalWorkers) * 100 : 0;
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2 text-xs text-black">
                      <div className="flex items-start gap-1.5 min-w-0 flex-1">
                        <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-black shrink-0 mt-0.5 bg-[#BFDBFE] text-black border-2 border-black">
                          {index + 1}
                        </span>
                        <span className="font-extrabold text-black leading-snug break-words">{cat}</span>
                      </div>
                      <span className="font-mono font-black text-black shrink-0 text-right">{formatNumber(count)} คน <span className="text-neutral-700 font-bold">({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div className="w-full bg-[#F3F4F6] h-3 rounded-md border-2 border-black overflow-hidden">
                      <div 
                        className="bg-[#60A5FA] h-full border-r-2 border-black transition-all duration-500" 
                        style={{ width: `${Math.max(pct, 3)}%` }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

