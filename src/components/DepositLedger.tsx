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
import { normalizeAlienCategory } from '../data/initialData';
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
  const [sortOption, setSortOption] = useState<'amount-desc' | 'amount-asc' | 'date-desc' | 'date-asc' | 'workers-desc'>('amount-desc');

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
     const req = String(rec.requestNumber || '').trim();
      const emp = String(rec.employerName || '').trim();
      const office = String(rec.employmentOffice || '').trim();
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

  // Sorted list according to user's selected sort order (default: amount-desc / ยอดจัดเก็บ มากไปน้อย)
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      if (sortOption === 'amount-desc') {
        return (b.totalAmount || 0) - (a.totalAmount || 0);
      }
      if (sortOption === 'amount-asc') {
        return (a.totalAmount || 0) - (b.totalAmount || 0);
      }
      if (sortOption === 'workers-desc') {
        return (b.alienCount || 0) - (a.alienCount || 0);
      }
      if (sortOption === 'date-asc') {
        return new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime();
      }
      // date-desc
      return new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime();
    });
  }, [filteredRecords, sortOption]);

  // Export to CSV with UTF-8 BOM strictly matching the 22-column database structure
  const exportToCSV = () => {
    exportDatabaseToCSV(sortedRecords, 'all');
  };

  return (
    <div className="w-full max-w-[1600px] 2xl:max-w-[1720px] mx-auto space-y-4 transition-all duration-300">
      {/* Unsynced Records Alert Banner */}
      {unsyncedCount > 0 && (
        <div className="bg-[#FDE68A] border-2 border-black rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-[4px_4px_0px_0px_#000000]">
          <div className="flex items-center gap-2.5 text-black font-bold">
            <span className="w-3 h-3 rounded-sm bg-[#FF6B6B] border border-black animate-pulse shrink-0" />
            <span>
              มีข้อมูล <strong className="font-black text-black">{unsyncedCount} รายการ</strong> ที่บันทึกไว้ในเครื่อง แต่ยังไม่ได้ส่งเข้า Google Sheet
            </span>
          </div>
          {onSyncAllRecords && (
            <button
              type="button"
              onClick={onSyncAllRecords}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg border-2 border-black bg-[#6EE7B7] hover:bg-[#34D399] text-black font-black text-xs shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>ส่งข้อมูลทั้งหมด ({unsyncedCount}) เข้า Sheet ทันที</span>
            </button>
          )}
        </div>
      )}

      {/* Control Toolbar */}
      <div className="bg-white rounded-xl border-3 border-black p-4 shadow-[5px_5px_0px_0px_#000000] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-black stroke-[2.5] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหา เลขที่คำขอ, เลขที่ใบเสร็จ, ชื่อนายจ้าง, เลข 13 หลัก..."
            className="w-full pl-10 pr-4 py-2 text-sm font-bold rounded-lg border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000000] focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[3px_3px_0px_0px_#000000] transition"
          />
        </div>

        {/* Filters & Export */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Filter Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-extrabold rounded-lg border-2 border-black bg-white text-black shadow-[2px_2px_0px_0px_#000000] focus:outline-none focus:bg-[#FFFBEB] cursor-pointer"
          >
            <option value="all">ประเภทนายจ้างทั้งหมด</option>
            <option value="individual">บุคคลธรรมดา</option>
            <option value="company">นิติบุคคล / บริษัท</option>
          </select>

          {/* Filter Channel */}
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-extrabold rounded-lg border-2 border-black bg-white text-black shadow-[2px_2px_0px_0px_#000000] focus:outline-none focus:bg-[#FFFBEB] cursor-pointer"
          >
            <option value="all">ทุกช่องทางชำระเงิน</option>
            <option value="โอนเงิน">โอนเงิน / KTB</option>
            <option value="เงินสด">เงินสด</option>
            <option value="เช็ค">แคชเชียร์เช็ค</option>
            <option value="ค้ำประกัน">หนังสือค้ำประกัน</option>
          </select>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-[#BFDBFE] border-2 border-black rounded-lg px-2.5 py-1.5 shadow-[2px_2px_0px_0px_#000000]">
            <ArrowUpDown className="w-3.5 h-3.5 text-black stroke-[2.5] shrink-0" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="text-xs sm:text-sm bg-transparent text-black font-extrabold focus:outline-none cursor-pointer"
            >
              <option value="amount-desc">เรียง: ยอดจัดเก็บ (มาก ➔ น้อย)</option>
              <option value="amount-asc">เรียง: ยอดจัดเก็บ (น้อย ➔ มาก)</option>
              <option value="date-desc">เรียง: วันที่ (ใหม่ ➔ เก่า)</option>
              <option value="date-asc">เรียง: วันที่ (เก่า ➔ ใหม่)</option>
              <option value="workers-desc">เรียง: จำนวนแรงงาน (มาก ➔ น้อย)</option>
            </select>
          </div>

          {/* Export CSV button */}
          <button
            onClick={exportToCSV}
            disabled={sortedRecords.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-black rounded-lg border-2 border-black bg-[#6EE7B7] hover:bg-[#34D399] text-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer disabled:opacity-50"
            title="ส่งออกไฟล์ Excel / CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-black stroke-[2.5]" />
            <span>ส่งออก CSV</span>
          </button>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl border-3 border-black shadow-[6px_6px_0px_0px_#000000] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#FFE500] border-b-3 border-black text-black font-black">
                <th className="py-3 px-4 border-r border-black">วันที่ / เลขที่คำขอ</th>
                <th className="py-3 px-4 border-r border-black">ใบเสร็จ (เล่ม/เลขที่)</th>
                <th className="py-3 px-4 border-r border-black">นายจ้าง</th>
                <th className="py-3 px-4 border-r border-black">ข้อมูลแรงงานต่างด้าว (ชื่อ / เลข 13 หลัก / สัญชาติ)</th>
                <th className="py-3 px-4 text-center border-r border-black">จำนวน (คน)</th>
                <th 
                  className="py-3 px-4 text-right cursor-pointer hover:bg-[#FDE047] transition select-none group border-r border-black"
                  onClick={() => setSortOption(prev => prev === 'amount-desc' ? 'amount-asc' : 'amount-desc')}
                  title="คลิกเพื่อสลับเรียงลำดับยอดจัดเก็บ (มาก ➔ น้อย / น้อย ➔ มาก)"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>ยอดเงินรวม</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center border-r border-black">สถานะ Sheet</th>
                <th className="py-3 px-4 text-center w-24">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black">
              {sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-600 font-bold">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock className="w-8 h-8 text-black stroke-[2]" />
                      <p className="text-sm font-extrabold text-black">ไม่พบข้อมูลบันทึกตามเงื่อนไขที่ค้นหา</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-[#FFFBEB] transition-colors group">
                    {/* วันที่ & เลขที่คำขอ */}
                    <td className="py-3.5 px-4 border-r border-black">
                      <div className="font-mono font-black text-black">
                        {item.requestNumber}
                      </div>
                      <div className="text-neutral-700 font-bold text-[11px] mt-0.5">
                        {formatToBuddhistDate(item.paymentDate)}
                      </div>
                    </td>

                    {/* ใบเสร็จ */}
                    <td className="py-3.5 px-4 font-mono border-r border-black">
                      <span className="text-neutral-700 font-bold">{item.receiptBook}</span> /{' '}
                      <span className="font-black text-black">{item.receiptNumber}</span>
                    </td>

                    {/* นายจ้าง */}
                    <td className="py-3.5 px-4 max-w-xs border-r border-black">
                      <div className="font-extrabold text-black truncate">
                        {item.employerName}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-800 font-bold mt-0.5 font-mono">
                        {item.employerType === 'individual' ? (
                          <span className="bg-[#D1FAE5] text-black px-1.5 py-0.2 rounded border border-black font-black">บุคคล</span>
                        ) : (
                          <span className="bg-[#BFDBFE] text-black px-1.5 py-0.2 rounded border border-black font-black">นิติบุคคล</span>
                        )}
                        <span>·</span>
                        <span>{item.idCardNumber}</span>
                      </div>
                    </td>

                    {/* ข้อมูลแรงงานต่างด้าว (ชื่อ / เลข 13 หลัก / สัญชาติ / ประเภท) */}
                    <td className="py-3.5 px-4 max-w-sm border-r border-black">
                      {item.workers && item.workers.length > 0 ? (
                        <div className="space-y-1.5">
                          {item.workers.slice(0, 2).map((w, i) => (
                            <div key={w.id || i} className="text-xs">
                              <div className="font-extrabold text-black flex items-center gap-1.5">
                                <span>{w.name}</span>
                                {w.category && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#FFE500] border border-black text-black font-black">
                                    {w.category.split('(')[0].trim()}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-neutral-700 font-mono font-bold flex items-center gap-1.5 mt-0.5">
                                <span>{w.idCardNumber}</span>
                                <span>·</span>
                                <span className="text-black font-sans font-bold">{w.nationality}</span>
                              </div>
                            </div>
                          ))}
                          {item.workers.length > 2 && (
                            <div className="text-[11px] text-black font-black">
                              และอีก {item.workers.length - 2} คน...
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-500 text-xs font-bold">-</span>
                      )}
                      <div className="text-[11px] text-neutral-700 font-bold mt-1">
                        ประเภทหลัก: {normalizeAlienCategory(item.alienCategory)}
                      </div>
                    </td>

                    {/* จำนวนคน */}
                    <td className="py-3.5 px-4 text-center font-mono font-black text-black border-r border-black">
                      {formatNumber(item.alienCount)}
                    </td>

                    {/* ยอดเงินรวม */}
                    <td className="py-3.5 px-4 text-right font-mono font-black text-black border-r border-black">
                      {formatThaiCurrency(item.totalAmount)}
                    </td>

                    {/* สถานะ Google Sheet */}
                    <td className="py-3.5 px-4 text-center border-r border-black">
                      {item.syncedToSheet ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-black bg-[#6EE7B7] px-2 py-0.5 rounded-md border-2 border-black shadow-[2px_2px_0px_0px_#000000]">
                          <Check className="w-3 h-3 text-black stroke-[3]" />
                          <span>ใน Sheet แล้ว</span>
                        </span>
                      ) : (
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-black bg-[#FDE68A] px-2 py-0.5 rounded-md border-2 border-black">
                            <Clock className="w-3 h-3 text-black stroke-[2.5]" />
                            <span>ในเครื่อง</span>
                          </span>
                          {onSyncSingleRecord && (
                            <button
                              type="button"
                              onClick={() => onSyncSingleRecord(item)}
                              className="text-[10px] text-black bg-[#BFDBFE] px-1.5 py-0.5 rounded border border-black font-black cursor-pointer"
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
                          className="p-1.5 text-black bg-[#BFDBFE] hover:bg-[#60A5FA] rounded-md border-2 border-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
                          title="ดูและพิมพ์ใบเสร็จ"
                        >
                          <Printer className="w-4 h-4 stroke-[2.5]" />
                        </button>
                        <button
                          onClick={() => setRecordToDelete(item)}
                          className="p-1.5 text-black bg-[#FCA5A5] hover:bg-[#FF6B6B] rounded-md border-2 border-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
                          title="ลบรายการ"
                        >
                          <Trash2 className="w-4 h-4 stroke-[2.5]" />
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
        <div className="px-4 py-3 bg-[#F3F4F6] border-t-3 border-black text-xs text-black font-extrabold flex items-center justify-between">
          <div>
            แสดงผล <span className="font-black text-black">{filteredRecords.length}</span> จากทั้งหมด {records.length} รายการ
          </div>
          <div className="font-mono text-black font-black">
            ยอดรวมหน้านี้: <strong className="bg-[#FFE500] px-2 py-0.5 rounded border-2 border-black">{formatThaiCurrency(filteredRecords.reduce((acc, curr) => acc + curr.totalAmount, 0))}</strong>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-[8px_8px_0px_0px_#000000] max-w-sm w-full p-5 border-3 border-black space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-[#FCA5A5] text-black border-2 border-black shadow-[3px_3px_0px_0px_#000000] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-black text-black text-base">ยืนยันการลบรายการ?</h3>
                <p className="text-xs font-bold text-neutral-700 mt-0.5">
                  คำขอเลขที่ <strong className="text-black font-black">{recordToDelete.requestNumber}</strong> ({recordToDelete.employerName}) จะถูกลบออกจากระบบอย่างถาวร
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-black">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-3.5 py-2 rounded-lg border-2 border-black bg-white text-black hover:bg-neutral-100 text-xs font-extrabold shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRecord(recordToDelete.id);
                  setRecordToDelete(null);
                }}
                className="px-4 py-2 rounded-lg border-2 border-black bg-[#FF6B6B] hover:bg-[#FF5252] text-black text-xs font-extrabold shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
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
