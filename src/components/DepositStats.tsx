import React from 'react';
import { 
  CircleDollarSign, 
  Users, 
  FileCheck2, 
  Building, 
  TrendingUp, 
  CreditCard 
} from 'lucide-react';
import { DepositRecord } from '../types/deposit';
import { formatThaiCurrency, formatNumber } from '../utils/thaiBahtText';

interface DepositStatsProps {
  records: DepositRecord[];
}

export const DepositStats: React.FC<DepositStatsProps> = ({ records }) => {
  const totalAmount = records.reduce((acc, r) => acc + r.totalAmount, 0);
  const totalWorkers = records.reduce((acc, r) => acc + r.alienCount, 0);
  const totalTransactions = records.length;
  const juristicCount = records.filter(r => r.employerType === 'company').length;
  const individualCount = records.filter(r => r.employerType === 'individual').length;

  // Breakdown by alien category
  const categoryStats = records.reduce((acc, r) => {
    acc[r.alienCategory] = (acc[r.alienCategory] || 0) + r.alienCount;
    return acc;
  }, {} as Record<string, number>);

  // Breakdown by payment channel / method
  const channelStats = records.reduce((acc, r) => {
    const key = (r.paymentChannel || 'ชำระผ่านระบบ').split('/')[0].trim();
    acc[key] = (acc[key] || 0) + r.totalAmount;
    return acc;
  }, {} as Record<string, number>);

  // Breakdown by worker nationality
  const nationalityStats = records.reduce((acc, r) => {
    (r.workers || []).forEach(w => {
      const nat = w.nationality ? w.nationality.split('(')[0].trim() : 'ไม่ระบุ';
      acc[nat] = (acc[nat] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="w-full max-w-[1360px] mx-auto space-y-6">
      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">ยอดเงินหลักประกันรวมทั้งสิ้น</p>
            <h3 className="text-2xl font-bold text-blue-900 font-mono mt-1 tracking-tight">
              {formatThaiCurrency(totalAmount)}
            </h3>
            <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>จัดเก็บตามระเบียบ 1,000 บ./คน</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CircleDollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">จำนวนแรงงานต่างด้าวรวม</p>
            <h3 className="text-2xl font-bold text-slate-900 font-mono mt-1 tracking-tight">
              {formatNumber(totalWorkers)} <span className="text-sm font-normal text-slate-500">คน</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              จากทั้งหมด {totalTransactions} รายการคำขอ
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">จำนวนใบเสร็จที่ออกแล้ว</p>
            <h3 className="text-2xl font-bold text-slate-900 font-mono mt-1 tracking-tight">
              {formatNumber(totalTransactions)} <span className="text-sm font-normal text-slate-500">ฉบับ</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              พิมพ์ออกใบเสร็จสมบูรณ์ 100%
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">สัดส่วนประเภทนายจ้าง</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-semibold text-slate-800">
                นิติบุคคล {juristicCount}
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-sm font-semibold text-slate-800">
                บุคคล {individualCount}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              นายจ้างทั้งหมด {juristicCount + individualCount} ราย
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Building className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3 Breakdown Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Nationality Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h4 className="text-sm font-semibold text-slate-800 pb-3 border-b border-slate-100 mb-3 flex items-center justify-between">
            <span>สถิติตามสัญชาติแรงงาน</span>
            <span className="text-xs text-slate-400 font-normal">จำนวน (คน)</span>
          </h4>
          <div className="space-y-3">
            {Object.entries(nationalityStats).map(([nat, count]) => {
              const totalNatWorkers = Object.values(nationalityStats).reduce((a, b) => a + b, 0);
              const pct = totalNatWorkers > 0 ? (count / totalNatWorkers) * 100 : 0;
              return (
                <div key={nat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-medium truncate max-w-[200px]">{nat}</span>
                    <span className="font-mono font-semibold">{formatNumber(count)} คน ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alien Category Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h4 className="text-sm font-semibold text-slate-800 pb-3 border-b border-slate-100 mb-3 flex items-center justify-between">
            <span>สถิติตามประเภทแรงงาน / มติ ครม.</span>
            <span className="text-xs text-slate-400 font-normal">จำนวนแรงงาน (คน)</span>
          </h4>
          <div className="space-y-3">
            {Object.entries(categoryStats).map(([cat, count]) => {
              const pct = totalWorkers > 0 ? (count / totalWorkers) * 100 : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-medium truncate max-w-[200px]">{cat}</span>
                    <span className="font-mono font-semibold">{formatNumber(count)} คน ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Channel Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h4 className="text-sm font-semibold text-slate-800 pb-3 border-b border-slate-100 mb-3 flex items-center justify-between">
            <span>สถิติตามช่องทางการรับชำระเงิน</span>
            <span className="text-xs text-slate-400 font-normal">ยอดเงิน (บาท)</span>
          </h4>
          <div className="space-y-3">
            {Object.entries(channelStats).map(([channel, amt]) => {
              const pct = totalAmount > 0 ? (amt / totalAmount) * 100 : 0;
              return (
                <div key={channel} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-medium truncate max-w-[200px]">{channel}</span>
                    <span className="font-mono font-semibold text-blue-900">{formatThaiCurrency(amt)} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
