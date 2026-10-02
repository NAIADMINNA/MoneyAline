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
  RotateCcw
} from 'lucide-react';
import { DepositRecord } from '../types/deposit';
import { formatThaiCurrency, formatNumber } from '../utils/thaiBahtText';
import { exportDatabaseToCSV } from '../utils/csvDatabaseExport';
import { BANGKOK_EMPLOYMENT_OFFICES, PROVINCIAL_EMPLOYMENT_OFFICES } from '../data/initialData';

interface DepositStatsProps {
  records: DepositRecord[];
  onNotify?: (msg: string) => void;
  accessToken?: string | null;
  onRefreshFromSheet?: () => Promise<void>;
  isRefreshing?: boolean;
  onClearAllRecords?: () => void;
}

export const DepositStats: React.FC<DepositStatsProps> = ({ 
  records, 
  onNotify, 
  accessToken, 
  onRefreshFromSheet,
  isRefreshing = false,
  onClearAllRecords
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

  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Filter records by the chosen specific office (strictly 1 office)
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

  // Breakdown by alien category
  const categoryStats = cleanRecords.reduce((acc, r) => {
    acc[r.alienCategory] = (acc[r.alienCategory] || 0) + r.alienCount;
    return acc;
  }, {} as Record<string, number>);

  // Breakdown by payment channel / method
  const channelStats = cleanRecords.reduce((acc, r) => {
    const key = (r.paymentChannel || 'ชำระผ่านระบบ').split('/')[0].trim();
    acc[key] = (acc[key] || 0) + r.totalAmount;
    return acc;
  }, {} as Record<string, number>);

  // Breakdown by worker nationality
  const nationalityStats = cleanRecords.reduce((acc, r) => {
    (r.workers || []).forEach(w => {
      const nat = w.nationality ? w.nationality.split('(')[0].trim() : 'ไม่ระบุ';
      acc[nat] = (acc[nat] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  // Handle Export CSV (strictly for the chosen employment office)
  const handleExportCSV = () => {
    if (!selectedOffice || filteredRecordsForExport.length === 0) {
      const msg = `ไม่พบข้อมูลสำหรับสำนักงาน "${selectedOffice || 'ที่เลือก'}"`;
      if (onNotify) onNotify(msg);
      return;
    }

    const exportedCount = exportDatabaseToCSV(records, selectedOffice);
    const successMsg = `ส่งออกไฟล์ CSV ฐานข้อมูล (${selectedOffice}) จำนวน ${exportedCount} รายการเรียบร้อยแล้ว`;
    
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
    <div className="w-full max-w-[1360px] mx-auto space-y-6">

      {/* CSV Export & Office Selector Panel (ตามที่ผู้ใช้งานร้องขอ) */}
      <div className="bg-gradient-to-br from-emerald-600/5 via-teal-500/10 to-blue-600/5 rounded-2xl border-2 border-emerald-300/80 p-5 sm:p-6 shadow-md shadow-emerald-500/5 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none -z-10" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          
          {/* Header & Description */}
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/25 ring-2 ring-emerald-100">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  ส่งออกไฟล์ฐานข้อมูล CSV รายสำนักงาน
                  <span className="text-[11px] font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                    22 คอลัมน์ฐานข้อมูล
                  </span>
                </h3>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed pt-1">
              เลือกสำนักงานจัดหางานที่ต้องการส่งออกข้อมูล โครงสร้างตารางอ้างอิงตรงตามฐานข้อมูลหลัก Google Sheet พร้อมแปลงวันที่ชำระเงินเป็น <strong className="text-emerald-700 font-bold">พ.ศ.</strong> และเข้ารหัส UTF-8 BOM สำหรับเปิดใน Microsoft Excel ได้อย่างถูกต้อง
            </p>
          </div>

          {/* Controls: Office Dropdown & Export Button */}
          <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            
            {/* Employment Office Selection Dropdown (Only specific offices allowed) */}
            <div className="relative min-w-[280px] sm:min-w-[320px]">
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>เลือกสำนักงานจัดหางาน (ระบุรายสำนักงาน):</span>
              </label>
              <div className="relative">
                <select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  className="w-full pl-3.5 pr-8 py-2.5 text-xs font-semibold text-slate-800 bg-white border-2 border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-xs cursor-pointer appearance-none transition"
                >
                  <option value="" disabled>
                    -- กรุณาเลือกสำนักงานจัดหางาน --
                  </option>
                  
                  {activeOfficesInData.length > 0 && (
                    <optgroup label="── สำนักงานที่มีรายการในระบบ ──">
                      {activeOfficesInData.map((office) => {
                        const count = records.filter(r => (r.employmentOffice || '').trim() === office).length;
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
                      const count = records.filter(r => (r.employmentOffice || '').trim() === office).length;
                      return (
                        <option key={office} value={office}>
                          {office} {count > 0 ? `(${count} รายการ)` : ''}
                        </option>
                      );
                    })}
                  </optgroup>

                  <optgroup label="── สำนักงานจัดหางานจังหวัด ──">
                    {PROVINCIAL_EMPLOYMENT_OFFICES.map((office) => {
                      const count = records.filter(r => (r.employmentOffice || '').trim() === office).length;
                      return (
                        <option key={office} value={office}>
                          {office} {count > 0 ? `(${count} รายการ)` : ''}
                        </option>
                      );
                    })}
                  </optgroup>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-600">
                  <Filter className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Pull from Google Sheet Button (ALWAYS visible to sync with online sheet) */}
            <div className="sm:self-end">
              <label className="block text-[11px] font-bold text-blue-900 mb-1 flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                <span>ดึงข้อมูลฐานข้อมูล:</span>
              </label>
              <button
                type="button"
                onClick={onRefreshFromSheet}
                disabled={isRefreshing}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/25 transition cursor-pointer disabled:opacity-50"
                title="คลิกเพื่อดึงข้อมูลล่าสุดจาก Google Sheet เพื่ออัปเดตสถิติให้ตรงกับฐานข้อมูลจริงทันที"
              >
                <RefreshCw className={`w-4 h-4 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูลจาก Google Sheet'}</span>
              </button>
            </div>

            {/* Clear / Reset Local Records Button */}
            {onClearAllRecords && records.length > 0 && (
              <div className="sm:self-end">
                <label className="block text-[11px] font-bold text-rose-800 mb-1 flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                  <span>รีเซ็ตสถิติ:</span>
                </label>
                <button
                  type="button"
                  onClick={onClearAllRecords}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-300 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                  title="หากลบข้อมูลใน Google Sheet แล้วต้องการให้ตัวเลขสถิติในระบบเป็น 0 ทันที"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                  <span>รีเซ็ตเป็น 0</span>
                </button>
              </div>
            )}

            {/* Export CSV Button */}
            <div className="sm:self-end">
              <label className="block text-[11px] font-bold text-emerald-900 mb-1 flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>ดาวน์โหลด:</span>
              </label>
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={!selectedOffice || filteredRecordsForExport.length === 0}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/30 transition cursor-pointer"
                title={filteredRecordsForExport.length === 0 ? "ไม่มีข้อมูลสำหรับสำนักงานที่เลือก" : `คลิกเพื่อส่งออกข้อมูล ${selectedOffice}`}
              >
                <Download className="w-4 h-4 text-white" />
                <span>
                  ส่งออกไฟล์ CSV ({filteredRecordsForExport.length} รายการ)
                </span>
              </button>
            </div>

          </div>

        </div>

        {/* Selected office summary preview & Toast */}
        <div className="mt-4 pt-3.5 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap text-slate-700">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span>สำนักงานที่เลือก:</span>
              <strong className="text-emerald-950 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-lg">
                {selectedOffice || 'ยังไม่ได้เลือก'}
              </strong>
            </span>
            <span>•</span>
            <span>
              จำนวนคำขอ: <strong className="text-emerald-700 font-mono font-bold">{formatNumber(selectedOfficeStats.count)}</strong> ฉบับ
            </span>
            <span>•</span>
            <span>
              แรงงานรวม: <strong className="text-indigo-700 font-mono font-bold">{formatNumber(selectedOfficeStats.workers)}</strong> คน
            </span>
            <span>•</span>
            <span>
              ยอดเงินรวม: <strong className="text-blue-900 font-mono font-extrabold text-sm">{formatThaiCurrency(selectedOfficeStats.amount)}</strong>
            </span>

            {selectedOfficeStats.count === 0 && (
              <span className="text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-md font-semibold text-[11px]">
                สำนักงานนี้ยังไม่มีข้อมูลในระบบ
              </span>
            )}
          </div>

          {exportSuccessMessage && (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>{exportSuccessMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4 Metric Cards with Rich Vibrancy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: ยอดเงินรวม */}
        <div className="bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-900 text-white rounded-2xl p-5 shadow-lg shadow-blue-700/20 relative overflow-hidden flex items-center justify-between group hover:-translate-y-0.5 transition-transform duration-200">
          <div className="space-y-1">
            <p className="text-xs font-medium text-blue-200">ยอดเงินหลักประกันรวมทั้งสิ้น</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white drop-shadow-xs">
              {formatThaiCurrency(totalAmount)}
            </h3>
            <p className="text-[11px] text-blue-200 flex items-center gap-1 font-medium pt-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>อัตราจัดเก็บ 1,000 บาท/คน</span>
            </p>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-white/15 text-white backdrop-blur-md ring-1 ring-white/25 flex items-center justify-center shrink-0 shadow-inner">
            <CircleDollarSign className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Metric 2: จำนวนแรงงาน */}
        <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 text-white rounded-2xl p-5 shadow-lg shadow-emerald-600/20 relative overflow-hidden flex items-center justify-between group hover:-translate-y-0.5 transition-transform duration-200">
          <div className="space-y-1">
            <p className="text-xs font-medium text-emerald-100">จำนวนแรงงานต่างด้าวรวม</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white drop-shadow-xs">
              {formatNumber(totalWorkers)} <span className="text-base font-normal text-emerald-200">คน</span>
            </h3>
            <p className="text-[11px] text-emerald-100 pt-0.5">
              จาก {totalTransactions} รายการคำขอในระบบ
            </p>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-white/15 text-white backdrop-blur-md ring-1 ring-white/25 flex items-center justify-center shrink-0 shadow-inner">
            <Users className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Metric 3: จำนวนใบเสร็จ */}
        <div className="bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-800 text-white rounded-2xl p-5 shadow-lg shadow-purple-600/20 relative overflow-hidden flex items-center justify-between group hover:-translate-y-0.5 transition-transform duration-200">
          <div className="space-y-1">
            <p className="text-xs font-medium text-purple-200">จำนวนใบเสร็จที่ออกแล้ว</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white drop-shadow-xs">
              {formatNumber(totalTransactions)} <span className="text-base font-normal text-purple-200">ฉบับ</span>
            </h3>
            <p className="text-[11px] text-purple-200 pt-0.5">
              พิมพ์ออกใบเสร็จสมบูรณ์ 100%
            </p>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-white/15 text-white backdrop-blur-md ring-1 ring-white/25 flex items-center justify-center shrink-0 shadow-inner">
            <FileCheck2 className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Metric 4: สัดส่วนนายจ้าง */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 text-white rounded-2xl p-5 shadow-lg shadow-amber-500/20 relative overflow-hidden flex items-center justify-between group hover:-translate-y-0.5 transition-transform duration-200">
          <div className="space-y-1">
            <p className="text-xs font-medium text-amber-100">สัดส่วนประเภทนายจ้าง</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base sm:text-lg font-bold text-white">
                นิติบุคคล {juristicCount}
              </span>
              <span className="text-amber-200">/</span>
              <span className="text-base sm:text-lg font-bold text-white">
                บุคคล {individualCount}
              </span>
            </div>
            <p className="text-[11px] text-amber-100 pt-0.5">
              รวมนายจ้าง {juristicCount + individualCount} ราย
            </p>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-white/15 text-white backdrop-blur-md ring-1 ring-white/25 flex items-center justify-center shrink-0 shadow-inner">
            <Building className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>

      {/* Breakdown Panels with Vibrant Gradient Accents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Office Breakdown (สถิติตามสำนักงานจัดหางาน) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 border-t-4 border-t-emerald-500 p-5 shadow-sm hover:shadow-md transition-shadow">
          <h4 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-100 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600">
                <Building2 className="w-4 h-4" />
              </span>
              <span>สถิติตามสำนักงานจัดหางาน</span>
            </span>
            <span className="text-xs text-emerald-700 font-semibold">ยอดจัดเก็บ</span>
          </h4>
          <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
            {Object.keys(officeStats).length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">ไม่มีข้อมูลสำนักงาน</p>
            ) : (
              Object.entries(officeStats).map(([office, data]) => {
                const pct = totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0;
                return (
                  <div key={office} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span className="font-semibold truncate max-w-[180px]" title={office}>
                        {office}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatThaiCurrency(data.amount)} <span className="text-slate-500 font-normal">({data.workers} คน)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.max(pct, 2)}%` }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Nationality Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/90 border-t-4 border-t-indigo-500 p-5 shadow-sm hover:shadow-md transition-shadow">
          <h4 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-100 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600">
                <Users className="w-4 h-4" />
              </span>
              <span>สถิติตามสัญชาติแรงงาน</span>
            </span>
            <span className="text-xs text-indigo-700 font-semibold">จำนวน (คน)</span>
          </h4>
          <div className="space-y-3.5">
            {Object.keys(nationalityStats).length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">ไม่มีข้อมูลแรงงานในระบบ</p>
            ) : (
              Object.entries(nationalityStats).map(([nat, count]) => {
                const totalNatWorkers = Object.values(nationalityStats).reduce((a, b) => a + b, 0);
                const pct = totalNatWorkers > 0 ? (count / totalNatWorkers) * 100 : 0;
                return (
                  <div key={nat} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span className="font-semibold truncate max-w-[200px]">{nat}</span>
                      <span className="font-mono font-bold text-indigo-950">{formatNumber(count)} คน <span className="text-slate-400 font-normal">({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.max(pct, 2)}%` }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Alien Category Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/90 border-t-4 border-t-blue-500 p-5 shadow-sm hover:shadow-md transition-shadow">
          <h4 className="text-sm font-bold text-slate-800 pb-3 border-b border-slate-100 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-blue-50 text-blue-600">
                <Layers className="w-4 h-4" />
              </span>
              <span>สถิติตามประเภทแรงงาน</span>
            </span>
            <span className="text-xs text-blue-700 font-semibold">แรงงาน (คน)</span>
          </h4>
          <div className="space-y-3.5">
            {Object.keys(categoryStats).length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">ไม่มีข้อมูลประเภทแรงงานในระบบ</p>
            ) : (
              Object.entries(categoryStats).map(([cat, count]) => {
                const pct = totalWorkers > 0 ? (count / totalWorkers) * 100 : 0;
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span className="font-semibold truncate max-w-[200px]">{cat}</span>
                      <span className="font-mono font-bold text-blue-950">{formatNumber(count)} คน <span className="text-slate-400 font-normal">({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.max(pct, 2)}%` }} 
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

