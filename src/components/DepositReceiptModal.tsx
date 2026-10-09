import React from 'react';
import { X, Printer, Download, Share2, CheckCircle2 } from 'lucide-react';
import { DepositRecord } from '../types/deposit';
import { formatThaiCurrency, formatNumber, formatThaiDate } from '../utils/thaiBahtText';

interface DepositReceiptModalProps {
  record: DepositRecord | null;
  onClose: () => void;
}

export const DepositReceiptModal: React.FC<DepositReceiptModalProps> = ({ record, onClose }) => {
  if (!record) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Header toolbar (Hidden when printing) */}
        <div className="px-6 py-4 bg-slate-800 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-wide flex items-center gap-1.5 text-blue-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ตัวอย่างใบเสร็จรับเงินอย่างเป็นทางการ
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition shadow-xs cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ใบเสร็จ (Print)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Thai Government Receipt View */}
        <div id="printable-receipt" className="p-8 sm:p-10 text-slate-800 overflow-y-auto bg-white font-['Sarabun',sans-serif] leading-relaxed">
          
          {/* Top emblem & header */}
          <div className="text-center relative pb-6 border-b border-slate-300">
            {/* Garuda Emblem SVG */}
            <div className="mx-auto w-20 h-20 mb-3 flex items-center justify-center text-slate-800">
              <svg viewBox="0 0 100 100" className="w-18 h-18 fill-current">
                <path d="M50 10 C45 25, 30 30, 20 28 C25 38, 35 40, 40 45 C35 55, 20 55, 10 65 C25 65, 35 60, 42 63 C40 75, 30 85, 25 90 C38 85, 45 78, 50 72 C55 78, 62 85, 75 90 C70 85, 60 75, 58 63 C65 60, 75 65, 90 65 C80 55, 65 55, 60 45 C65 40, 75 38, 80 28 C70 30, 55 25, 50 10 Z" />
                <circle cx="50" cy="30" r="6" />
                <path d="M47 38 L53 38 L52 50 L48 50 Z" />
              </svg>
            </div>

            <div className="text-xs text-slate-500 uppercase tracking-widest font-sans mb-1">
              แบบ บก.๐๑ (ฉบับผู้ชำระเงิน)
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              กรมการจัดหางาน กระทรวงแรงงาน
            </h2>
            <h1 className="text-xl font-bold text-blue-950 mt-1">
              ใบเสร็จรับเงินค่าวางหลักประกันการทำงานของคนต่างด้าว
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              ตามพระราชกำหนดการบริหารจัดการการทำงานของคนต่างด้าว พ.ศ. ๒๕๖๐ และที่แก้ไขเพิ่มเติม
            </p>

            {/* Receipt book & number on top right */}
            <div className="absolute right-0 top-0 text-right text-xs space-y-1">
              <div className="font-semibold text-slate-700">
                เล่มที่: <span className="font-mono text-sm font-bold text-slate-900">{record.receiptBook}</span>
              </div>
              <div className="font-semibold text-slate-700">
                เลขที่: <span className="font-mono text-sm font-bold text-blue-900">{record.receiptNumber}</span>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 py-4 text-sm border-b border-slate-200">
            <div>
              <span className="text-slate-500">สำนักงานจัดหางาน: </span>
              <span className="font-semibold text-slate-800">{record.employmentOffice}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500">วันที่: </span>
              <span className="font-semibold text-slate-800">{formatThaiDate(record.paymentDate)}</span>
            </div>

            <div>
              <span className="text-slate-500">เลขที่คำขอ: </span>
              <span className="font-mono font-semibold text-slate-800">{record.requestNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500">ช่องทางการชำระ: </span>
              <span className="font-medium text-slate-800">{record.paymentChannel}</span>
            </div>
          </div>

          {/* Employer Information */}
          <div className="py-4 space-y-2 text-sm border-b border-slate-200">
            <div>
              <span className="text-slate-500">ได้รับเงินจาก: </span>
              <span className="font-bold text-slate-900 text-base">
                {record.companyName 
                  ? record.companyName + (record.individualName ? ` (โดย ${record.individualName})` : '')
                  : record.individualName || record.employerName}
              </span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                {record.companyName || record.employerType === 'company' ? 'นิติบุคคล' : 'บุคคลธรรมดา'}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {record.companyId && (
                <div>
                  <span className="text-slate-500">เลขทะเบียนนิติบุคคล: </span>
                  <span className="font-mono font-medium text-slate-800">{record.companyId}</span>
                </div>
              )}
              {record.individualIdCard && (
                <div>
                  <span className="text-slate-500">เลขประจำตัวประชาชน: </span>
                  <span className="font-mono font-medium text-slate-800">{record.individualIdCard}</span>
                </div>
              )}
              {!record.companyId && !record.individualIdCard && (
                <div>
                  <span className="text-slate-500">เลขประจำตัว: </span>
                  <span className="font-mono font-medium text-slate-800">{record.idCardNumber}</span>
                </div>
              )}
              {record.phoneNumber && (
                <div>
                  <span className="text-slate-400 mr-2">|</span>
                  <span className="text-slate-500">เบอร์โทรศัพท์: </span>
                  <span className="font-mono text-slate-800">{record.phoneNumber}</span>
                </div>
              )}
            </div>
            {record.workplaceAddress && (
              <div>
                <span className="text-slate-500">ที่ตั้งสถานประกอบการ: </span>
                <span className="text-slate-800">{record.workplaceAddress}</span>
              </div>
            )}
          </div>

          {/* Payment Breakdown Table */}
          <div className="py-4">
            <table className="w-full text-sm border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="border border-slate-300 px-3 py-2.5 text-center w-12">ลำดับ</th>
                  <th className="border border-slate-300 px-4 py-2.5 text-left">รายการ</th>
                  <th className="border border-slate-300 px-3 py-2.5 text-center w-24">จำนวน (คน)</th>
                  <th className="border border-slate-300 px-3 py-2.5 text-right w-28">อัตรา (บาท)</th>
                  <th className="border border-slate-300 px-3 py-2.5 text-right w-32">จำนวนเงิน (บาท)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-300 px-3 py-4 text-center font-mono">1</td>
                  <td className="border border-slate-300 px-4 py-4">
                    <div className="font-semibold text-slate-900">
                      ค่าวางหลักประกันการทำงานของคนต่างด้าว
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      ประเภท/มติ: <span className="font-medium text-slate-800">{record.alienCategory}</span>
                    </div>

                    {/* รายชื่อแรงงานต่างด้าว (เลขประจำตัว 13 หลัก, ชื่อ, สัญชาติ) */}
                    {record.workers && record.workers.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-xs">
                        <div className="font-medium text-slate-700 mb-1">รายชื่อคนต่างด้าว ({record.workers.length} คน):</div>
                        <div className="space-y-1 pl-1">
                          {record.workers.map((w, i) => (
                            <div key={w.id || i} className="text-slate-600 flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[11px] text-slate-400">{i + 1}.</span>
                              <span className="font-medium text-slate-900">{w.name || '-'}</span>
                              <span className="text-slate-400">·</span>
                              <span className="font-mono text-slate-700">เลข: {w.idCardNumber || '-'}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-700">สัญชาติ: {w.nationality || '-'}</span>
                              {w.category && (
                                <>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-blue-900 font-medium font-sans">ประเภท: {w.category}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {record.notes && (
                      <div className="text-xs text-slate-500 mt-1 italic">
                        หมายเหตุ: {record.notes}
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-300 px-3 py-4 text-center font-mono font-medium">
                    {formatNumber(record.alienCount)}
                  </td>
                  <td className="border border-slate-300 px-3 py-4 text-right font-mono">
                    {formatNumber(record.ratePerPerson)}
                  </td>
                  <td className="border border-slate-300 px-3 py-4 text-right font-mono font-semibold text-slate-900">
                    {formatNumber(record.totalAmount)}.00
                  </td>
                </tr>

                {/* Total row */}
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={3} className="border border-slate-300 px-4 py-3">
                    <span className="text-slate-600 font-normal">จำนวนเงินตัวอักษร: </span>
                    <span className="text-blue-900 font-bold ml-1">({record.thaiBahtText})</span>
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right text-slate-700">
                    รวมทั้งสิ้น
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right text-blue-950 text-base font-bold font-mono">
                    {formatThaiCurrency(record.totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legal disclaimer notes */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 leading-relaxed mb-8">
            <strong>คำเตือน & ข้อกำหนด:</strong> หลักประกันนี้จะได้รับการคืนให้แก่นายจ้างเมื่อคนต่างด้าวได้เดินทางกลับออกไปนอกราชอาณาจักร 
            หรือเมื่อสิ้นสุดหน้าที่ตามที่กำหนดไว้ในพระราชกำหนดการบริหารจัดการการทำงานของคนต่างด้าว พ.ศ. ๒๕๖๐ โปรดเก็บรักษาใบเสร็จรับเงินนี้ไว้เพื่อใช้เป็นหลักฐานในการขอรับคืนหลักประกัน
          </div>

          {/* Signatures & Official Stamp Zone */}
          <div className="grid grid-cols-2 gap-8 pt-4">
            {/* Left: QR Code & Verification */}
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 bg-slate-100 border border-slate-300 rounded flex flex-col items-center justify-center p-1">
                {/* SVG QR Code Simulation */}
                <svg viewBox="0 0 40 40" className="w-16 h-16 fill-slate-800">
                  <rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
                  <rect x="5" y="5" width="6" height="6" />
                  <rect x="26" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
                  <rect x="29" y="5" width="6" height="6" />
                  <rect x="2" y="26" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
                  <rect x="5" y="29" width="6" height="6" />
                  <rect x="18" y="4" width="4" height="4" />
                  <rect x="18" y="14" width="4" height="8" />
                  <rect x="26" y="18" width="6" height="4" />
                  <rect x="18" y="26" width="8" height="4" />
                  <rect x="30" y="28" width="6" height="8" />
                </svg>
              </div>
              <div className="text-xs text-slate-500 space-y-0.5">
                <div className="font-semibold text-slate-700">e-Receipt Verification</div>
                <div>รหัสตรวจสอบ: <span className="font-mono">DOE-{record.requestNumber}</span></div>
                <div className="text-[11px] text-slate-400">สแกนเพื่อตรวจสอบความถูกต้องของเอกสาร</div>
              </div>
            </div>

            {/* Right: Officer Signature */}
            <div className="text-center text-sm space-y-6">
              <div className="space-y-1">
                <div className="border-b border-dotted border-slate-400 w-48 mx-auto pb-1 font-['Brush_Script_MT',cursive] italic text-blue-900 text-lg">
                  {record.officerName}
                </div>
                <div className="font-semibold text-slate-800 pt-1">
                  ({record.officerName})
                </div>
                <div className="text-xs text-slate-600">
                  ตำแหน่ง {record.officerPosition || 'เจ้าหน้าที่ผู้รับเงิน'}
                </div>
                <div className="text-xs text-slate-500">
                  เจ้าหน้าที่ผู้รับเงิน
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between print:hidden">
          <div className="text-xs text-slate-500">
            เอกสารฉบับนี้พิมพ์จากระบบบันทึกการชำระเงินค่าวางหลักประกันแรงงานต่างด้าว
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
            >
              ปิด
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์เอกสาร</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
