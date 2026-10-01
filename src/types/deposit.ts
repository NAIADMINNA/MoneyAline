/**
 * Type definitions for Foreign Worker Security Deposit System
 * (ระบบบันทึกการชำระเงินค่าวางหลักประกันแรงงานต่างด้าว)
 */

export type EmployerType = 'individual' | 'company';

export interface ForeignWorker {
  id: string;
  idCardNumber: string; // เลขประจำตัว 13 หลัก
  name: string; // ชื่อ-นามสกุล
  nationality: string; // สัญชาติ
  category?: string; // ประเภทคนต่างด้าว / มติ ครม. รายบุคคล
}

export interface DepositRecord {
  id: string; // Unique record ID (UUID)
  createdAt: string; // ISO date string
  
  // Section 1: ข้อมูลเอกสารและหลักฐาน
  requestNumber: string; // เลขที่คำขอ เช่น 69-09-0006
  receiptBook: string; // เล่มที่ใบเสร็จ เช่น 012
  receiptNumber: string; // เลขที่ใบเสร็จ เช่น 000546
  paymentDate: string; // วันที่ชำระเงิน YYYY-MM-DD
  paymentChannel?: string; // ช่องทางการวางหลักประกัน (ตัวเลือกเสริม)

  // Section 2: ข้อมูลนายจ้าง / สถานประกอบการ
  employerType: EmployerType; // บุคคลธรรมดา / นิติบุคคล
  idCardNumber: string; // เลขประจำตัวประชาชน / เลขทะเบียนนิติบุคคล 13 หลัก
  employerName: string; // ชื่อ-นามสกุล นายจ้าง / ชื่อบริษัท ห้างหุ้นส่วน
  individualIdCard?: string; // เลขประจำตัวประชาชน (บุคคลธรรมดา)
  individualName?: string; // ชื่อ-นามสกุล (บุคคลธรรมดา)
  companyId?: string; // เลขทะเบียนนิติบุคคล
  companyName?: string; // ชื่อบริษัท / ห้างหุ้นส่วน
  phoneNumber: string; // เบอร์โทรศัพท์ติดต่อ
  workplaceAddress?: string; // ที่ตั้งสถานประกอบการ / จังหวัด (ตัวเลือกเสริม)

  // Section 3: รายการคนต่างด้าว & ยอดเงิน
  alienCategory: string; // ประเภทคนต่างด้าว / มติ ครม.
  alienCount: number; // จำนวนคนต่างด้าว (คน)
  ratePerPerson: number; // อัตราต่อคน (บาท) ปกติ 1000
  totalAmount: number; // alienCount * ratePerPerson
  thaiBahtText: string; // คำอ่านภาษาไทย เช่น หนึ่งพันบาทถ้วน
  notes: string; // หมายเหตุเพิ่มเติม
  workers: ForeignWorker[]; // รายชื่อแรงงานต่างด้าว: เลขประจำตัว 13 หลัก, ชื่อ, สัญชาติ

  // Section 4: ข้อมูลเจ้าหน้าที่ผู้รับเงิน / สำนักงานจัดหางานที่รับคำขอชำระเงินค่าวางหลักประกัน
  officerName: string; // ชื่อ-นามสกุล เจ้าหน้าที่ผู้รับเงิน
  officerPosition: string; // ตำแหน่ง
  employmentOffice: string; // สำนักงานจัดหางานที่รับคำขอ
  // Status fields for Google Sheets Sync
  syncedToSheet?: boolean;
  sheetRow?: number;
}

export type FormDataState = Omit<DepositRecord, 'id' | 'createdAt' | 'totalAmount' | 'thaiBahtText' | 'syncedToSheet' | 'sheetRow'>;

