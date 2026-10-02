import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Trash2, 
  Eye, 
  FileSpreadsheet, 
  Building2, 
  User, 
  Clock,
  ArrowUpDown,
  Check,
  AlertCircle
} from 'lucide-react';
import { DepositRecord } from '../types/deposit';
import { formatThaiCurrency, formatNumber, formatToBuddhistDate } from '../utils/thaiBahtText';
import { exportDatabaseToCSV } from '../utils/csvDatabaseExport';

interface DepositLedgerProps {
  records: DepositRecord[];
  onViewReceipt: (record: DepositRecord) => void;
  onDeleteRecord: (id: string) => void;
  onEditInForm?: (record: DepositRecord) => void;
  onSyncSingleRecord?: (record: DepositRecord) => void;
  onSyncAllRecords?: () => void;
}

export const DepositLedger: React.FC<DepositLedgerProps> = ({
  records,
  onViewReceipt,
  onDeleteRecord,
  onEditInForm,
  onSyncSingleRecord,
  onSyncAllRecords,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const [recordToDelete, setRecordToDelete] = useState<DepositRecord | null>(null);

  const unsyncedCount = useMemo(() => {
    return records.filter(r => {
      if (!r || !r.requestNumber) return false;
      if (r.requestNumber.includes('เลขที่คำขอ') || (r.employerName || '').includes('ชื่อนายจ้าง')) return false;
      return !r.syncedToSheet;
    }).length;
  }, [records]);

  // Filtered list
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (!rec) return false;
      const req = (rec.requestNumber || '').trim();
      const emp = (rec.employerName || '').trim();
      const office = (rec.employmentOffice || '').trim();
      if (
        req.includes('เลขที่คำขอ') ||
        emp.includes('ชื่อนายจ้าง') ||
        office.includes('สำนักงานจัดหางานที่รับคำขอ')
      ) {
        return false;
      }

      // Search matches
      const query = searchQuery.trim().toLowerCase();
      const matchWorker = rec.workers?.some((w) =>
        (w.name || '').toLowerCase().includes(query) ||
        (w.idCardNumber || '').includes(query) ||
        (w.nationality || '').toLowerCase().includes(query)
      );

      const matchSearch =
        !query ||
        rec.requestNumber.toLowerCase().includes(query) ||
        rec.receiptNumber.toLowerCase().includes(query) ||
        rec.employerName.toLowerCase().includes(query) ||
        rec.idCardNumber.includes(query) ||
        rec.officerName.toLowerCase().includes(query) ||
        (rec.employmentOffice && rec.employmentOffice.toLowerCase().includes(query)) ||
        matchWorker;

      // Channel filter
      const matchChannel =
        filterChannel === 'all' || (rec.paymentChannel && rec.paymentChannel.includes(filterChannel));

      // Type filter
      const matchType =
        filterType === 'all' || rec.employerType === filterType;

      return matchSearch && matchChannel && matchType;
    });
  }, [records, searchQuery, filterChannel, filterType]);

  // Export to CSV with UTF-8 BOM strictly matching the 22-column database structure
  const exportToCSV = () => {
    exportDatabaseToCSV(filteredRecords, 'all');
  };

  return (
    <div className="w-full max-w-[1360px] mx-auto space-y-4">
      {/* Unsynced Records Alert Banner */}
      {unsyncedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5 text-amber-800">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>
              มีข้อมูล <strong className="font-bold text-amber-900">{unsyncedCount} รายการ</strong> ที่บันทึกไว้ในเครื่อง แต่ยังไม่ได้ส่งเข้า Google Sheet
            </span>
          </div>
          {onSyncAllRecords && (
            <button
              type="button"
              onClick={onSyncAllRecords}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-2xs transition cursor-pointer shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>ส่งข้อมูลทั้งหมด ({unsyncedCount}) เข้า Sheet ทันที</span>
            </button>
          )}
        </div>
      )}

      {/* Control Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหา เลขที่คำขอ, เลขที่ใบเสร็จ, ชื่อนายจ้าง, เลข 13 หลัก..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
          />
        </div>

        {/* Filters & Export */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">ประเภทนายจ้างทั้งหมด</option>
            <option value="individual">บุคคลธรรมดา</option>
            <option value="company">นิติบุคคล / บริษัท</option>
          </select>

          {/* Filter Channel */}
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">ทุกช่องทางชำระเงิน</option>
            <option value="โอนเงิน">โอนเงิน / KTB</option>
            <option value="เงินสด">เงินสด</option>
            <option value="เช็ค">แคชเชียร์เช็ค</option>
            <option value="ค้ำประกัน">หนังสือค้ำประกัน</option>
          </select>

          {/* Export CSV button */}
          <button
            onClick={exportToCSV}
            disabled={filteredRecords.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer disabled:opacity-50"
            title="ส่งออกไฟล์ Excel / CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>ส่งออก CSV</span>
          </button>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <th className="py-3 px-4">วันที่ / เลขที่คำขอ</th>
                <th className="py-3 px-4">ใบเสร็จ (เล่ม/เลขที่)</th>
                <th className="py-3 px-4">นายจ้าง</th>
                <th className="py-3 px-4">ข้อมูลแรงงานต่างด้าว (ชื่อ / เลข 13 หลัก / สัญชาติ)</th>
                <th className="py-3 px-4 text-center">จำนวน (คน)</th>
                <th className="py-3 px-4 text-right">ยอดเงินรวม</th>
                <th className="py-3 px-4 text-center">สถานะ Sheet</th>
                <th className="py-3 px-4 text-center w-24">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock className="w-8 h-8 text-slate-300" />
                      <p className="text-sm">ไม่พบข้อมูลบันทึกตามเงื่อนไขที่ค้นหา</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group">
                    {/* วันที่ & เลขที่คำขอ */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-semibold text-blue-900">
                        {item.requestNumber}
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        {formatToBuddhistDate(item.paymentDate)}
                      </div>
                    </td>

                    {/* ใบเสร็จ */}
                    <td className="py-3.5 px-4 font-mono">
                      <span className="text-slate-500">{item.receiptBook}</span> /{' '}
                      <span className="font-semibold text-slate-800">{item.receiptNumber}</span>
                    </td>

                    {/* นายจ้าง */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-medium text-slate-900 truncate">
                        {item.employerName}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 font-mono">
                        {item.employerType === 'individual' ? (
                          <span className="text-slate-600">บุคคล</span>
                        ) : (
                          <span className="text-blue-700">นิติบุคคล</span>
                        )}
                        <span>·</span>
                        <span>{item.idCardNumber}</span>
                      </div>
                    </td>

                    {/* ข้อมูลแรงงานต่างด้าว (ชื่อ / เลข 13 หลัก / สัญชาติ / ประเภท) */}
                    <td className="py-3.5 px-4 max-w-sm">
                      {item.workers && item.workers.length > 0 ? (
                        <div className="space-y-1.5">
                          {item.workers.slice(0, 2).map((w, i) => (
                            <div key={w.id || i} className="text-xs">
                              <div className="font-medium text-slate-800 flex items-center gap-1.5">
                                <span>{w.name}</span>
                                {w.category && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-normal">
                                    {w.category.split('(')[0].trim()}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                                <span>{w.idCardNumber}</span>
                                <span>·</span>
                                <span className="text-slate-600 font-sans">{w.nationality}</span>
                              </div>
                            </div>
                          ))}
                          {item.workers.length > 2 && (
                            <div className="text-[11px] text-blue-600 font-medium">
                              และอีก {item.workers.length - 2} คน...
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                      <div className="text-[11px] text-slate-400 mt-1">
                        ประเภทหลัก: {item.alienCategory}
                      </div>
                    </td>

                    {/* จำนวนคน */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium text-slate-800">
                      {formatNumber(item.alienCount)}
                    </td>

                    {/* ยอดเงินรวม */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-950">
                      {formatThaiCurrency(item.totalAmount)}
                    </td>

                    {/* สถานะ Google Sheet */}
                    <td className="py-3.5 px-4 text-center">
                      {item.syncedToSheet ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>ใน Sheet แล้ว</span>
                        </span>
                      ) : (
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>ในเครื่อง</span>
                          </span>
                          {onSyncSingleRecord && (
                            <button
                              type="button"
                              onClick={() => onSyncSingleRecord(item)}
                              className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-semibold cursor-pointer"
                              title="ส่งรายการนี้เข้า Google Sheet ทันที"
                            >
                              ส่งลง Sheet
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* จัดการ */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onViewReceipt(item)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100/60 rounded-md transition cursor-pointer"
                          title="ดูและพิมพ์ใบเสร็จ"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setRecordToDelete(item)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                          title="ลบรายการ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer count */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <div>
            แสดงผล <span className="font-semibold text-slate-800">{filteredRecords.length}</span> จากทั้งหมด {records.length} รายการ
          </div>
          <div className="font-mono text-slate-700">
            ยอดรวมหน้านี้: <strong className="text-blue-900">{formatThaiCurrency(filteredRecords.reduce((acc, curr) => acc + curr.totalAmount, 0))}</strong>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-base">ยืนยันการลบรายการ?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  คำขอเลขที่ <strong className="text-slate-800">{recordToDelete.requestNumber}</strong> ({recordToDelete.employerName}) จะถูกลบออกจากระบบอย่างถาวร
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRecord(recordToDelete.id);
                  setRecordToDelete(null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                ยืนยัน ลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
