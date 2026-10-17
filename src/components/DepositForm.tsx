import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  User, 
  Users, 
  ShieldCheck, 
  RotateCcw, 
  Check, 
  Info,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  Building2,
  HelpCircle,
  Printer,
  Receipt
} from 'lucide-react';
import { FormDataState, DepositRecord, ForeignWorker } from '../types/deposit';
import { 
  PAYMENT_CHANNELS, 
  ALIEN_CATEGORIES, 
  EMPLOYMENT_OFFICES, 
  BANGKOK_EMPLOYMENT_OFFICES,
  PROVINCIAL_EMPLOYMENT_OFFICES,
  DEFAULT_FORM_DATA,
  NATIONALITIES
} from '../data/initialData';
import { 
  formatThaiCurrency, 
  numberToThaiBahtText, 
  formatIdCard, 
  formatPhone,
  formatToBuddhistDate,
  getTodayIsoDate,
  normalizePaymentDateToIso
} from '../utils/thaiBahtText';
import { 
  getRequestNumberConfig, 
  generateSampleRequestNumber, 
  validateRequestNumber, 
  splitRequestNumbers,
  REQUEST_CONFIG_EVENT, 
  RequestNumberConfig 
} from '../utils/requestNumberConfig';

interface DepositFormProps {
  onSave: (record: DepositRecord, printImmediately: boolean) => void;
  initialData?: FormDataState;
  onReset?: () => void;
  isGoogleConnected?: boolean;
  onConnectGoogle?: () => void;
  hasWebhook?: boolean;
}

const LAST_EMPLOYER_TYPE_KEY = 'doe_last_employer_type';

export const DepositForm: React.FC<DepositFormProps> = ({ 
  onSave, 
  initialData, 
  onReset,
  isGoogleConnected = false,
  onConnectGoogle,
  hasWebhook = false,
}) => {
  const [formData, setFormData] = useState<FormDataState>(() => {
    const init = initialData || DEFAULT_FORM_DATA;
    let preferredType = init.employerType || 'individual';
    try {
      const savedType = localStorage.getItem(LAST_EMPLOYER_TYPE_KEY);
      if (savedType === 'individual' || savedType === 'company') {
        preferredType = savedType;
      }
    } catch {
      // ignore
    }
    return {
      ...init,
      employerType: preferredType,
      individualIdCard: init.individualIdCard || (preferredType === 'individual' ? init.idCardNumber : ''),
      individualName: init.individualName || (preferredType === 'individual' ? init.employerName : ''),
      companyId: init.companyId || (preferredType === 'company' ? init.idCardNumber : ''),
      companyName: init.companyName || (preferredType === 'company' ? init.employerName : ''),
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic request number configuration from Webhook settings
  const [reqConfig, setReqConfig] = useState<RequestNumberConfig>(() => getRequestNumberConfig());

  useEffect(() => {
    const handleConfigChange = () => {
      setReqConfig(getRequestNumberConfig());
    };
    window.addEventListener(REQUEST_CONFIG_EVENT, handleConfigChange);
    return () => window.removeEventListener(REQUEST_CONFIG_EVENT, handleConfigChange);
  }, []);

  const totalAmount = (formData.alienCount || 0) * (formData.ratePerPerson || 1000);
  const thaiBahtText = numberToThaiBahtText(totalAmount);

  const isCompany = formData.employerType === 'company';
  const currentDeterminedName = isCompany 
    ? (formData.companyName?.trim() || '')
    : (formData.individualName?.trim() || '');
  const currentDeterminedId = isCompany 
    ? (formData.companyId?.trim() || '')
    : (formData.individualIdCard?.trim() || '');

  // อัปเดตเลขที่คำขอของแรงงานคนที่ index ใน Section 1
  const handleWorkerRequestNumberChange = (index: number, rawVal: string) => {
    const clean = rawVal.replace(/\D/g, '').slice(0, reqConfig.length || 14);
    setFormData(prev => {
      const currentWorkers = [...(prev.workers || [])];
      while (currentWorkers.length <= index) {
        currentWorkers.push({
          id: `w-${Date.now()}-${currentWorkers.length + 1}`,
          idCardNumber: '',
          name: '',
          nationality: currentWorkers[0]?.nationality || NATIONALITIES[0],
          category: currentWorkers[0]?.category || prev.alienCategory || ALIEN_CATEGORIES[0],
        });
      }
      currentWorkers[index] = {
        ...currentWorkers[index],
        requestNumber: clean,
      };

      const allReqs = currentWorkers.map(w => w.requestNumber?.trim()).filter(Boolean);
      return {
        ...prev,
        workers: currentWorkers,
        alienCount: Math.max(prev.alienCount || 1, currentWorkers.length),
        requestNumber: allReqs.length > 0 ? allReqs.join(', ') : clean,
      };
    });

    if (errors.requestNumber) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.requestNumber;
        return copy;
      });
    }
  };

  const handleInputChange = (field: keyof FormDataState, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear field error on change
    if (errors[field]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handleRequestNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // กรองเฉพาะตัวเลข และเครื่องหมายคั่น เช่น จุลภาค, เคาะวรรค, ขึ้นบรรทัดใหม่, เซมิโคลอน
    let raw = e.target.value;
    let cleanVal = raw.replace(/[^\d,\s\n/;\-]/g, '');
    
    // หากเป็นเลขเดี่ยว (ไม่มีเครื่องหมายคั่น) ตัดไม่เกิน 14 หลัก
    if (!cleanVal.includes(',') && !cleanVal.includes('\n') && !cleanVal.includes(';') && !cleanVal.includes('/')) {
      const digitsOnly = cleanVal.replace(/\D/g, '').slice(0, 14);
      cleanVal = digitsOnly;
    }

    handleInputChange('requestNumber', cleanVal);

    if (!cleanVal.trim()) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.requestNumber;
        return copy;
      });
      return;
    }

    const list = splitRequestNumbers(cleanVal);
    // ตรวจสอบกรณีเลขคำขอเดียว
    if (list.length <= 1 && !cleanVal.includes(',')) {
      const singleNum = list[0] || '';
      const prefix = '691';

      // ตรวจสอบว่าขึ้นต้นด้วย 691 หรือไม่
      const expectedSlice = prefix.slice(0, Math.min(prefix.length, singleNum.length));
      if (!singleNum.startsWith(expectedSlice)) {
        setErrors(prev => ({
          ...prev,
          requestNumber: 'เลขที่คำขอต้องขึ้นต้นด้วย "691" เสมอ',
        }));
        return;
      }

      if (singleNum.length === 14) {
        if (!singleNum.startsWith('691')) {
          setErrors(prev => ({
            ...prev,
            requestNumber: 'เลขที่คำขอต้องขึ้นต้นด้วย "691" เสมอ',
          }));
        } else {
          setErrors(prev => {
            const copy = { ...prev };
            delete copy.requestNumber;
            return copy;
          });
        }
      } else {
        setErrors(prev => {
          const copy = { ...prev };
          delete copy.requestNumber;
          return copy;
        });
      }
    } else {
      // กรณีมีมากกว่า 1 เลขคำขอ (เช่น คั่นด้วยเครื่องหมายจุลภาค , )
      let hasError = false;
      for (let i = 0; i < list.length; i++) {
        const num = list[i];
        const label = `เลขที่คำขอลำดับที่ ${i + 1}`;
        if (!num.startsWith('691'.slice(0, Math.min(3, num.length)))) {
          setErrors(prev => ({
            ...prev,
            requestNumber: `${label} ต้องขึ้นต้นด้วย "691" เสมอ`,
          }));
          hasError = true;
          break;
        }
        if (num.length > 14) {
          setErrors(prev => ({
            ...prev,
            requestNumber: `${label} ต้องมี 14 หลักพอดี (ปัจจุบัน ${num.length} หลัก)`,
          }));
          hasError = true;
          break;
        }
      }

      if (!hasError) {
        setErrors(prev => {
          const copy = { ...prev };
          delete copy.requestNumber;
          return copy;
        });

        // ซิงค์จำนวนคนและผูกเลขคำขอให้แรงงานแต่ละคนโดยอัตโนมัติ
        if (list.length > (formData.workers?.length || 0)) {
          setFormData(prev => {
            const currentWorkers = [...(prev.workers || [])];
            while (currentWorkers.length < list.length) {
              currentWorkers.push({
                id: `w-${Date.now()}-${currentWorkers.length + 1}`,
                idCardNumber: '',
                name: '',
                nationality: currentWorkers[0]?.nationality || NATIONALITIES[0],
                category: currentWorkers[0]?.category || prev.alienCategory || ALIEN_CATEGORIES[0],
              });
            }
            return {
              ...prev,
              alienCount: currentWorkers.length,
              workers: currentWorkers.map((w, idx) => ({
                ...w,
                requestNumber: list[idx] || w.requestNumber,
              })),
            };
          });
        }
      }
    }
  };

  const handleRequestNumberBlur = () => {
    const val = (formData.requestNumber || '').trim();
    if (!val) {
      setErrors(prev => ({
        ...prev,
        requestNumber: 'กรุณากรอกเลขที่คำขอ',
      }));
      return;
    }

    const list = splitRequestNumbers(val);
    for (let i = 0; i < list.length; i++) {
      const num = list[i];
      const label = list.length > 1 ? `เลขที่คำขอลำดับที่ ${i + 1} ` : 'เลขที่คำขอ';
      if (!num.startsWith('691')) {
        setErrors(prev => ({
          ...prev,
          requestNumber: `${label}ต้องขึ้นต้นด้วย "691" เสมอ`,
        }));
        return;
      }
      if (num.length !== 14) {
        setErrors(prev => ({
          ...prev,
          requestNumber: `${label}ต้องมีจำนวน 14 หลักเท่านั้น (ปัจจุบันกรอก ${num.length} หลัก)`,
        }));
        return;
      }
    }

    setErrors(prev => {
      const copy = { ...prev };
      delete copy.requestNumber;
      return copy;
    });
  };

  const handleIndividualIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatIdCard(e.target.value);
    setFormData(prev => ({
      ...prev,
      individualIdCard: formatted,
      idCardNumber: formatted,
      employerType: 'individual',
    }));
    if (errors.individualIdCard || errors.employerInfo) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.individualIdCard;
        delete copy.employerInfo;
        return copy;
      });
    }
  };

  const handleIndividualNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => ({
      ...prev,
      individualName: val,
      employerName: val,
      employerType: 'individual',
    }));
    if (errors.individualName || errors.employerInfo) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.individualName;
        delete copy.employerInfo;
        return copy;
      });
    }
  };

  const handleCompanyIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatIdCard(e.target.value);
    setFormData(prev => ({
      ...prev,
      companyId: formatted,
      idCardNumber: formatted,
      employerType: 'company',
    }));
    if (errors.companyId || errors.employerInfo) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.companyId;
        delete copy.employerInfo;
        return copy;
      });
    }
  };

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => ({
      ...prev,
      companyName: val,
      employerName: val,
      employerType: 'company',
    }));
    if (errors.companyName || errors.employerInfo) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.companyName;
        delete copy.employerInfo;
        return copy;
      });
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    handleInputChange('phoneNumber', formatted);
    if (errors.phoneNumber) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.phoneNumber;
        return copy;
      });
    }
  };

  const handleWorkerChange = (index: number, field: keyof ForeignWorker, value: string) => {
    // ล็อคชื่อคนต่างด้าวเป็นภาษาอังกฤษตัวพิมพ์ใหญ่เท่านั้น (แปลงพิมพ์เล็กเป็นพิมพ์ใหญ่อัตโนมัติ)
    let cleanValue = value;
    if (field === 'name') {
      cleanValue = value.toUpperCase().replace(/[^A-Z\s\.\-']/g, '');
    }

    setFormData(prev => {
      const currentWorkers = [...(prev.workers || [])];
      if (!currentWorkers[index]) {
        currentWorkers[index] = {
          id: `w-${Date.now()}-${index}`,
          idCardNumber: '',
          name: '',
          nationality: NATIONALITIES[0],
          category: prev.alienCategory || ALIEN_CATEGORIES[0],
        };
      }
      currentWorkers[index] = {
        ...currentWorkers[index],
        [field]: cleanValue,
      };

      // If category was changed, also update summarized alienCategory
      let newAlienCategory = prev.alienCategory;
      if (field === 'category') {
        const uniqueCategories = Array.from(new Set(currentWorkers.map(w => w.category || prev.alienCategory)));
        newAlienCategory = uniqueCategories.length === 1 ? uniqueCategories[0] : `หลากหลายประเภท (${uniqueCategories.join(', ')})`;
      }

      return {
        ...prev,
        alienCategory: newAlienCategory,
        workers: currentWorkers,
      };
    });

    if (errors[`workerName_${index}`] || errors[`workerId_${index}`] || errors.workerName || errors.workerId) {
      setErrors(prev => {
        const copy = { ...prev };
        if (field === 'name') {
          delete copy[`workerName_${index}`];
          if (index === 0) delete copy.workerName;
        }
        if (field === 'idCardNumber') {
          delete copy[`workerId_${index}`];
          if (index === 0) delete copy.workerId;
        }
        return copy;
      });
    }
  };

  const applyCategoryToAllWorkers = (category: string) => {
    setFormData(prev => ({
      ...prev,
      alienCategory: category,
      workers: (prev.workers || []).map(w => ({
        ...w,
        category,
      })),
    }));
  };

  const handleAddWorker = () => {
    setFormData(prev => {
      const currentWorkers = prev.workers || [];
      const defaultNationality = currentWorkers[0]?.nationality || NATIONALITIES[0];
      const defaultCategory = currentWorkers[0]?.category || prev.alienCategory || ALIEN_CATEGORIES[0];
      const newWorker: ForeignWorker = {
        id: `w-${Date.now()}-${currentWorkers.length + 1}`,
        idCardNumber: '',
        name: '',
        nationality: defaultNationality,
        category: defaultCategory,
      };
      const updated = [...currentWorkers, newWorker];
      return {
        ...prev,
        workers: updated,
        alienCount: updated.length,
      };
    });
  };

  const handleRemoveWorker = (index: number) => {
    setFormData(prev => {
      const currentWorkers = prev.workers || [];
      if (currentWorkers.length <= 1) return prev;
      const updated = currentWorkers.filter((_, idx) => idx !== index);
      return {
        ...prev,
        workers: updated,
        alienCount: updated.length,
      };
    });
  };

  const handleCountChange = (delta: number) => {
    const current = Number(formData.alienCount) || 1;
    const nextVal = Math.max(1, current + delta);
    setFormData(prev => {
      const currentWorkers = [...(prev.workers || [])];
      const defaultNationality = currentWorkers[0]?.nationality || NATIONALITIES[0];
      const defaultCategory = currentWorkers[0]?.category || prev.alienCategory || ALIEN_CATEGORIES[0];
      if (nextVal > currentWorkers.length) {
        while (currentWorkers.length < nextVal) {
          currentWorkers.push({
            id: `w-${Date.now()}-${currentWorkers.length + 1}`,
            idCardNumber: '',
            name: '',
            nationality: defaultNationality,
            category: defaultCategory,
          });
        }
      } else if (nextVal < currentWorkers.length) {
        currentWorkers.splice(nextVal);
      }
      return {
        ...prev,
        alienCount: nextVal,
        workers: currentWorkers,
      };
    });
  };

  const handleCountDirectChange = (count: number) => {
    const nextVal = Math.max(1, count);
    setFormData(prev => {
      const currentWorkers = [...(prev.workers || [])];
      const defaultNationality = currentWorkers[0]?.nationality || NATIONALITIES[0];
      const defaultCategory = currentWorkers[0]?.category || prev.alienCategory || ALIEN_CATEGORIES[0];
      if (nextVal > currentWorkers.length) {
        while (currentWorkers.length < nextVal) {
          currentWorkers.push({
            id: `w-${Date.now()}-${currentWorkers.length + 1}`,
            idCardNumber: '',
            name: '',
            nationality: defaultNationality,
            category: defaultCategory,
          });
        }
      } else if (nextVal < currentWorkers.length) {
        currentWorkers.splice(nextVal);
      }
      return {
        ...prev,
        alienCount: nextVal,
        workers: currentWorkers,
      };
    });
  };

  const fillExampleFromImage = () => {
    const sampleReq = generateSampleRequestNumber(reqConfig);
    setFormData({
      requestNumber: sampleReq,
      receiptBook: '012',
      receiptNumber: '000546',
      paymentDate: '2026-09-30',
      paymentChannel: 'โอนเงิน / KTB Corporate Online',
      employerType: 'individual',
      individualIdCard: '3-1005-00421-12-8',
      individualName: 'นายสมชาย ใจดี',
      companyId: '',
      companyName: '',
      idCardNumber: '3-1005-00421-12-8',
      employerName: 'นายสมชาย ใจดี',
      phoneNumber: '081-234-5678',
      alienCategory: 'MOU (2 ปีแรก)',
      alienCount: 1,
      ratePerPerson: 1000,
      notes: 'เลขที่เช็ค KTB-992100 สัญญาจ้างแรงงาน วาระนำเข้าปี 2569',
      workers: [
        {
          id: 'w-ex-1',
          idCardNumber: '0-0012-34567-89-1',
          name: 'AUNG SAN',
          nationality: 'เมียนมา (Myanmar)',
        }
      ],
      officerName: 'นายอดิศร วงศ์เจริญรัตน์',
      officerPosition: 'นักวิชาการแรงงานปฏิบัติการ',
      employmentOffice: 'สจก. 6 (คลองเตย วัฒนา สวนหลวง)',
    });
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // ตรวจสอบและบังคับให้เลขที่คำขอขึ้นต้นด้วย 691 และมี 14 หลักเสมอ
    const reqList = splitRequestNumbers(formData.requestNumber);
    if (reqList.length === 0) {
      newErrors.requestNumber = 'กรุณากรอกเลขที่คำขอ (ต้องขึ้นต้นด้วย "691" จำนวน 14 หลักเสมอ)';
    } else {
      for (let i = 0; i < reqList.length; i++) {
        const num = reqList[i];
        const label = reqList.length > 1 ? `เลขที่คำขอลำดับที่ ${i + 1} ` : 'เลขที่คำขอ';
        if (!num.startsWith('691')) {
          newErrors.requestNumber = `${label}ต้องขึ้นต้นด้วย "691" เสมอ`;
          break;
        }
        if (num.length !== 14) {
          newErrors.requestNumber = `${label}ต้องมีจำนวน 14 หลักเท่านั้น (ปัจจุบัน ${num.length} หลัก)`;
          break;
        }
      }
    }

    if (!formData.receiptBook.trim()) newErrors.receiptBook = 'กรุณากรอกเล่มที่ใบเสร็จ';
    if (!formData.receiptNumber.trim()) newErrors.receiptNumber = 'กรุณากรอกเลขที่ใบเสร็จ';
    if (!formData.paymentDate) newErrors.paymentDate = 'กรุณาเลือกวันที่ชำระเงิน';

    // Validate Employer Info: Must complete the selected employer type (individual OR company)
    if (formData.employerType === 'individual') {
      const idRaw = (formData.individualIdCard || '').replace(/\D/g, '');
      if (!formData.individualIdCard?.trim()) {
        newErrors.individualIdCard = 'กรุณากรอกเลขประจำตัวประชาชน (13 หลัก)';
      } else if (idRaw.length !== 13) {
        newErrors.individualIdCard = `เลขประจำตัวประชาชนต้องครบ 13 หลัก (ปัจจุบัน ${idRaw.length} หลัก)`;
      }

      if (!formData.individualName?.trim()) {
        newErrors.individualName = 'กรุณากรอกชื่อ-นามสกุล นายจ้าง';
      }
    } else {
      const idRaw = (formData.companyId || '').replace(/\D/g, '');
      if (!formData.companyId?.trim()) {
        newErrors.companyId = 'กรุณากรอกเลขทะเบียนนิติบุคคล (13 หลัก)';
      } else if (idRaw.length !== 13) {
        newErrors.companyId = `เลขทะเบียนนิติบุคคลต้องครบ 13 หลัก (ปัจจุบัน ${idRaw.length} หลัก)`;
      }

      if (!formData.companyName?.trim()) {
        newErrors.companyName = 'กรุณากรอกชื่อบริษัท / ห้างหุ้นส่วน';
      }
    }

    // Validate Phone Number: Mandatory for both individual and company
    const phoneRaw = (formData.phoneNumber || '').replace(/\D/g, '');
    if (!formData.phoneNumber?.trim()) {
      newErrors.phoneNumber = 'กรุณากรอกเบอร์โทรศัพท์ติดต่อ';
    } else if (phoneRaw.length < 9) {
      newErrors.phoneNumber = 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (อย่างน้อย 9-10 หลัก)';
    }

    if (!formData.alienCount || formData.alienCount < 1) newErrors.alienCount = 'จำนวนคนต้องมากกว่า 0';
    if (!formData.officerName.trim()) newErrors.officerName = 'กรุณากรอกชื่อเจ้าหน้าที่ผู้รับเงิน';

    // Verify all foreign workers if provided
    if (formData.workers && formData.workers.length > 0) {
      formData.workers.forEach((w, idx) => {
        if (!w.name.trim()) {
          newErrors[`workerName_${idx}`] = `กรุณาระบุชื่อ-นามสกุลแรงงานต่างด้าว (คนที่ ${idx + 1})`;
        }
        if (!w.idCardNumber.trim()) {
          newErrors[`workerId_${idx}`] = `กรุณาระบุเลขประจำตัว 13 หลักของแรงงานต่างด้าว (คนที่ ${idx + 1})`;
        }
      });
      if (newErrors.workerName_0) newErrors.workerName = newErrors.workerName_0;
      if (newErrors.workerId_0) newErrors.workerId = newErrors.workerId_0;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPrintImmediately, setPendingPrintImmediately] = useState(false);

  // เมื่อผู้ใช้กดปุ่มบันทึก: ตรวจสอบความถูกต้อง แล้วเปิดหน้าต่างสรุปข้อมูลให้นายจ้าง/ผู้ใช้ตรวจทาน
  const handleSubmit = (printImmediately: boolean = false) => {
    if (!validate()) {
      return;
    }
    setPendingPrintImmediately(printImmediately);
    setShowConfirmModal(true);
  };

  // ดำเนินการบันทึกจริงเมื่อผู้ใช้กดยืนยันในหน้าต่างสรุป
  const executeConfirmSave = (printImmediately?: boolean) => {
    const shouldPrint = printImmediately !== undefined ? printImmediately : pendingPrintImmediately;
    setShowConfirmModal(false);

    const isCompany = formData.employerType === 'company';
    const determinedName = isCompany 
      ? (formData.companyName?.trim() || '')
      : (formData.individualName?.trim() || '');
    const determinedId = isCompany 
      ? (formData.companyId?.trim() || '')
      : (formData.individualIdCard?.trim() || '');

    const chosenPaymentDate = normalizePaymentDateToIso(formData.paymentDate) || formData.paymentDate || getTodayIsoDate();

    const reqList = splitRequestNumbers(formData.requestNumber);
    const enrichedWorkers = (formData.workers || []).map((w, idx) => ({
      ...w,
      requestNumber: w.requestNumber?.trim() || reqList[idx] || reqList[0] || formData.requestNumber || '',
    }));

    const newRecord: DepositRecord = {
      ...formData,
      paymentDate: chosenPaymentDate,
      employerType: isCompany ? 'company' : 'individual',
      employerName: determinedName,
      idCardNumber: determinedId,
      id: 'rec-' + Date.now(),
      createdAt: new Date().toISOString(),
      totalAmount,
      thaiBahtText,
      workers: enrichedWorkers,
    };

    onSave(newRecord, shouldPrint);

    // ล้างฟอร์มทันทีเมื่อกดบันทึกตามความต้องการของผู้ใช้งาน
    // โดยคงวันที่ที่ผู้ใช้งานเลือกไว้ เพื่อความสะดวกในการบันทึกรายการในวันนั้นอย่างต่อเนื่อง
    const savedOfficerName = formData.officerName;
    const savedOfficerPosition = formData.officerPosition;
    const savedEmploymentOffice = formData.employmentOffice;
    const savedPaymentDate = chosenPaymentDate;

    const freshFormData: FormDataState = {
      requestNumber: '',
      receiptBook: '',
      receiptNumber: '',
      paymentDate: savedPaymentDate,
      paymentChannel: PAYMENT_CHANNELS[0] || 'โอนเงิน / KTB Corporate Online',
      employerType: 'individual',
      idCardNumber: '',
      employerName: '',
      individualIdCard: '',
      individualName: '',
      companyId: '',
      companyName: '',
      phoneNumber: '',
      workplaceAddress: '',
      alienCategory: ALIEN_CATEGORIES[0] || 'MOU (2 ปีแรก)',
      alienCount: 1,
      ratePerPerson: 1000,
      notes: '',
      workers: [
        {
          id: `w-${Date.now()}-0`,
          idCardNumber: '',
          name: '',
          nationality: NATIONALITIES[0] || 'เมียนมา (Myanmar)',
          category: ALIEN_CATEGORIES[0] || 'MOU (2 ปีแรก)',
        }
      ],
      officerName: savedOfficerName,
      officerPosition: savedOfficerPosition,
      employmentOffice: savedEmploymentOffice,
    };

    setFormData(freshFormData);
    setErrors({});
    setResetSuccess(true);
    setTimeout(() => {
      setResetSuccess(false);
    }, 3500);
  };

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const executeReset = () => {
    const freshEmptyData: FormDataState = {
      requestNumber: '',
      receiptBook: '',
      receiptNumber: '',
      paymentDate: getTodayIsoDate(),
      paymentChannel: PAYMENT_CHANNELS[0] || 'โอนเงิน / KTB Corporate Online',
      employerType: 'individual',
      idCardNumber: '',
      employerName: '',
      individualIdCard: '',
      individualName: '',
      companyId: '',
      companyName: '',
      phoneNumber: '',
      workplaceAddress: '',
      alienCategory: ALIEN_CATEGORIES[0] || 'MOU (2 ปีแรก)',
      alienCount: 1,
      ratePerPerson: 1000,
      notes: '',
      workers: [
        {
          id: `w-${Date.now()}-0`,
          idCardNumber: '',
          name: '',
          nationality: NATIONALITIES[0] || 'เมียนมา (Myanmar)',
          category: ALIEN_CATEGORIES[0] || 'MOU (2 ปีแรก)',
        }
      ],
      officerName: '',
      officerPosition: '',
      employmentOffice: BANGKOK_EMPLOYMENT_OFFICES[0] || 'สำนักงานจัดหางานกรุงเทพมหานครพื้นที่ 1',
    };
    setFormData(freshEmptyData);
    setErrors({});
    setShowResetConfirm(false);
    setResetSuccess(true);
    setTimeout(() => {
      setResetSuccess(false);
    }, 3000);
    if (onReset) onReset();
  };

  return (
    <div className="w-full max-w-[1600px] 2xl:max-w-[1720px] mx-auto bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden font-sans relative transition-all duration-300">
      
      {/* Reset Success Notification Toast */}
      {resetSuccess && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900/95 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm border border-slate-700 animate-in slide-in-from-top-3 fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">ล้างข้อมูลในแบบฟอร์มเรียบร้อยแล้ว</span>
        </div>
      )}

      {/* Confirm Reset Dialog Modal (Replaces blocked window.confirm) */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-base">ยืนยันการล้างข้อมูล?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ข้อมูลที่กรอกไว้ในแบบฟอร์มจะถูกรีเซ็ตกลับเป็นค่าเริ่มต้น
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeReset}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                ยืนยัน ล้างข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Summary Modal before Saving (สรุปข้อมูลก่อนบันทึก: นายจ้างอะไร จำนวนแรงงานกี่ราย) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-800 text-white px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 text-white flex items-center justify-center font-bold ring-1 ring-white/20 shadow-inner">
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white">
                    สรุปข้อมูลก่อนบันทึกเข้าระบบ
                  </h3>
                  <p className="text-xs text-blue-200">
                    กรุณาตรวจสอบชื่อนายจ้าง จำนวนแรงงาน และยอดเงินก่อนยืนยันบันทึก
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer text-sm font-bold"
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              
              {/* Alert Callout */}
              <div className="p-3 bg-blue-50 border border-blue-200/90 rounded-xl text-blue-900 text-xs flex items-center gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  ระบบพร้อมบันทึกรายการสำหรับนายจ้างและแรงงานต่างด้าวดังต่อไปนี้:
                </span>
              </div>

              {/* Box 1: สรุปข้อมูลนายจ้าง */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-slate-800 font-bold">
                  <div className="flex items-center gap-2 text-blue-950">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>ข้อมูลนายจ้าง / ผู้ประกอบการ</span>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md border border-blue-200">
                    {formData.employerType === 'company' ? 'นิติบุคคล / บริษัท' : 'บุคคลธรรมดา'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <span className="text-slate-500 text-xs block mb-0.5">ชื่อนายจ้าง / บริษัท:</span>
                    <strong className="text-blue-950 text-base font-extrabold block break-words">
                      {currentDeterminedName || '-'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-500 text-xs block mb-0.5">
                      {formData.employerType === 'company' ? 'เลขทะเบียนนิติบุคคล (13 หลัก):' : 'เลขประจำตัวประชาชน (13 หลัก):'}
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {currentDeterminedId || '-'}
                    </span>
                    {formData.phoneNumber && (
                      <span className="text-slate-500 text-xs block mt-1 font-mono">
                        เบอร์ติดต่อ: {formatPhone(formData.phoneNumber)}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-500 text-xs block mb-0.5">
                      เลขที่คำขอ {splitRequestNumbers(formData.requestNumber).length > 1 ? `(${splitRequestNumbers(formData.requestNumber).length} เลข):` : '(14 หลัก):'}
                    </span>
                    <strong className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200 inline-block text-xs max-w-full truncate">
                      {formData.requestNumber || '-'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-500 text-xs block mb-0.5">ใบเสร็จรับเงิน:</span>
                    <span className="font-mono font-bold text-slate-800">
                      เล่มที่ {formData.receiptBook || '-'} / เลขที่ {formData.receiptNumber || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Box 2: สรุปข้อมูลแรงงานต่างด้าว (จำนวน X ราย พร้อมตารางรายชื่อ) */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/80">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold">
                    <Users className="w-4 h-4 text-emerald-700" />
                    <span>ข้อมูลแรงงานต่างด้าวที่จะบันทึก</span>
                  </div>
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-600 text-white font-bold text-xs shadow-2xs">
                    <span>จำนวน {formData.workers?.length || 1} ราย</span>
                  </div>
                </div>

                {/* Worker List Table */}
                <div className="bg-white rounded-lg border border-emerald-200/80 overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-emerald-100/70 text-emerald-950 font-bold border-b border-emerald-200">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">คนที่</th>
                        <th className="py-2.5 px-3">เลขที่คำขอ</th>
                        <th className="py-2.5 px-3">เลขประจำตัว (13 หลัก)</th>
                        <th className="py-2.5 px-3">ชื่อ-นามสกุล คนต่างด้าว</th>
                        <th className="py-2.5 px-3">สัญชาติ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {(formData.workers || []).map((w, idx) => {
                        const wReq = w.requestNumber?.trim() || splitRequestNumbers(formData.requestNumber)[idx] || splitRequestNumbers(formData.requestNumber)[0] || formData.requestNumber || '-';
                        return (
                          <tr key={w.id || idx} className="hover:bg-emerald-50/40 transition-colors">
                            <td className="py-2 px-3 text-center font-bold text-emerald-800 bg-emerald-50/30">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-blue-800 text-[11px]">
                              {wReq}
                            </td>
                            <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                              {w.idCardNumber || '-'}
                            </td>
                            <td className="py-2 px-3 font-semibold text-blue-900 break-words">
                              {w.name || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {w.nationality?.split('(')[0]?.trim() || w.nationality || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Box 3: สรุปยอดเงินและสถานที่ชำระ */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-600 block">สำนักงานจัดหางาน:</span>
                    <strong className="text-slate-800 text-xs sm:text-sm font-bold block">
                      {formData.employmentOffice}
                    </strong>
                    <div className="text-[11px] text-slate-500 pt-0.5">
                      <span>เจ้าหน้าที่ผู้รับเงิน: {formData.officerName}</span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right sm:border-l sm:border-amber-200 sm:pl-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-200">
                    <span className="text-xs text-amber-900 block font-medium">ยอดเงินหลักประกันรวม:</span>
                    <span className="text-2xl font-black font-mono text-emerald-700 block">
                      {formatThaiCurrency(totalAmount)}
                    </span>
                    <span className="text-[11px] text-slate-600 font-medium">
                      ({thaiBahtText})
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs sm:text-sm transition cursor-pointer"
              >
                ← ยกเลิก / กลับไปแก้ไข
              </button>

              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={() => executeConfirmSave(false)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/25 transition cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4 text-white" />
                  <span>ยืนยัน บันทึกข้อมูล</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      
      {/* Top Header Banner matching official institutional style with Glassmorphism & Soft Shadows */}
      <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950 text-white px-6 py-6 sm:px-8 sm:py-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl shadow-slate-950/25 relative overflow-hidden border-b border-white/10">
        {/* Ambient radial reflections for glassy depth */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute -bottom-10 left-1/3 w-80 h-80 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none -z-10" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-white/10 text-white backdrop-blur-md ring-1 ring-white/25 flex items-center justify-center font-bold shadow-[0_8px_24px_rgba(0,0,0,0.3)] shrink-0 border border-white/20">
            <Building2 className="w-6 h-6 text-amber-300 drop-shadow-[0_2px_8px_rgba(252,211,77,0.4)]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2 drop-shadow-xs">
              แบบบันทึกการชำระเงินค่าวางหลักประกันคนต่างด้าว
            </h1>
            <p className="text-xs text-blue-200/90 mt-0.5 tracking-wide">
              ตามพระราชกำหนดการบริหารจัดการการทำงานของคนต่างด้าว พ.ศ. ๒๕๖๐ และที่แก้ไขเพิ่มเติม
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-white/10 border border-amber-300/35 text-amber-200 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.2)] ring-1 ring-white/15">
            <Info className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>อัตราจัดเก็บคงที่ 1,000 บาทต่อคน</span>
          </div>
        </div>
      </div>

      {/* Main Form Body with subtle depth background */}
      <div className="p-5 sm:p-7 md:p-8 space-y-6 bg-gradient-to-b from-slate-100/70 via-slate-50/50 to-blue-50/20 relative">
        
        {/* Error Banner if any required field is missing */}
        {Object.keys(errors).length > 0 && (
          <div className="p-4 bg-red-50/90 backdrop-blur-xs border-2 border-red-200 rounded-2xl text-red-700 text-xs sm:text-sm flex items-center gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
            <span className="font-medium">กรุณากรอกข้อมูลในช่องที่จำเป็นให้ครบถ้วนก่อนบันทึก ({Object.values(errors).join(', ')})</span>
          </div>
        )}

        {/* 3 Columns Section: 1, 2, 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Section 1: ข้อมูลเอกสารและหลักฐาน */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 border-t-4 border-t-blue-600 p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_36px_-4px_rgba(30,58,138,0.12)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-start ring-1 ring-white/80 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
            <div className="space-y-4 relative">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-500/30">
                  <FileText className="w-4 h-4" />
                </span>
                <h2 className="text-base font-bold text-slate-800">
                  1. ข้อมูลเอกสารและหลักฐาน
                </h2>
              </div>

              {/* เลขที่คำขอ (รองรับทั้ง 1 เลข และคั่นด้วยเครื่องหมายจุลภาคหากมีหลายเลข) */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="text-xs font-semibold text-slate-800">
                    เลขที่คำขอ (Request No.) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-normal">
                    (หากมีหลายเลข ให้คั่นด้วยเครื่องหมายจุลภาค , )
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.requestNumber}
                    onChange={handleRequestNumberChange}
                    onBlur={handleRequestNumberBlur}
                    placeholder="เช่น 69144008610001 หรือคั่นด้วยจุลภาคหากมีหลายเลขคำขอ"
                    className={`w-full px-3.5 py-2 text-sm rounded-lg border font-mono pr-24 ${
                      errors.requestNumber 
                        ? 'border-red-400 bg-red-50/30 ring-1 ring-red-400' 
                        : formData.requestNumber && splitRequestNumbers(formData.requestNumber).length > 0 && splitRequestNumbers(formData.requestNumber).every(n => n.length === 14 && n.startsWith('691'))
                        ? 'border-emerald-400 bg-emerald-50/20 ring-1 ring-emerald-400'
                        : 'border-slate-300'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all`}
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-mono pointer-events-none">
                    {splitRequestNumbers(formData.requestNumber).length > 1 ? (
                      <span className="text-blue-700 font-bold bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[11px]">
                        {splitRequestNumbers(formData.requestNumber).length} เลขคำขอ
                      </span>
                    ) : formData.requestNumber ? (
                      <span className={`${
                        formData.requestNumber.length === 14 && formData.requestNumber.startsWith('691')
                          ? 'text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-0.5'
                          : formData.requestNumber && !formData.requestNumber.startsWith('691'.slice(0, Math.min(3, formData.requestNumber.length)))
                          ? 'text-red-700 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-300'
                          : 'text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded'
                      }`}>
                        {formData.requestNumber.length === 14 && formData.requestNumber.startsWith('691') && '✓ '}
                        {formData.requestNumber.length}/14
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* แสดงสรุปรายการเมื่อระบุหลายเลขคำขอ */}
                {splitRequestNumbers(formData.requestNumber).length > 1 && (
                  <div className="mt-1.5 p-2 rounded-lg bg-blue-50/80 border border-blue-200 flex flex-wrap items-center gap-1 text-xs">
                    <span className="text-blue-900 font-bold text-[11px]">ระบุ {splitRequestNumbers(formData.requestNumber).length} เลขคำขอ:</span>
                    {splitRequestNumbers(formData.requestNumber).map((num, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-white border border-blue-300 text-blue-800 font-mono text-[11px] font-semibold">
                        <span className="text-slate-400 font-sans text-[10px]">คนที่ {i + 1}:</span>
                        <span>{num}</span>
                      </span>
                    ))}
                  </div>
                )}

                {errors.requestNumber && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1 animate-in fade-in font-medium">
                    <span>⚠️</span>
                    <span>{errors.requestNumber}</span>
                  </p>
                )}
              </div>

              {/* เล่มที่ใบเสร็จ & เลขที่ใบเสร็จ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    เล่มที่ใบเสร็จ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.receiptBook}
                    onChange={(e) => handleInputChange('receiptBook', e.target.value)}
                    placeholder="เช่น 012"
                    className={`w-full px-3.5 py-2 text-sm rounded-lg border ${
                      errors.receiptBook ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    เลขที่ใบเสร็จ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.receiptNumber}
                    onChange={(e) => handleInputChange('receiptNumber', e.target.value)}
                    placeholder="เช่น 000546"
                    className={`w-full px-3.5 py-2 text-sm rounded-lg border ${
                      errors.receiptNumber ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono`}
                  />
                </div>
              </div>

              {/* วันที่ชำระเงิน */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    วันที่ชำระเงิน <span className="text-red-500">*</span>
                  </label>
                  {formData.paymentDate && (
                    <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      พ.ศ. {formatToBuddhistDate(formData.paymentDate)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="date"
                    value={normalizePaymentDateToIso(formData.paymentDate) || formData.paymentDate || ''}
                    onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                    className={`w-full px-3.5 py-2 text-sm rounded-lg border ${
                      errors.paymentDate ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono`}
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* กล่องคำอธิบาย: พื้นที่ว่างใต้วันที่ชำระเงิน กรณีที่นายจ้างมีแรงงานหลายคน (เน้นกรอบและเน้นหัวข้อชัดเจน) */}
              <div className="pt-2">
                <div className="rounded-2xl border-2 border-blue-400/90 bg-gradient-to-br from-blue-50/95 via-white/95 to-indigo-50/80 p-4 space-y-3 backdrop-blur-md shadow-[0_10px_28px_-4px_rgba(37,99,235,0.18)] ring-2 ring-blue-200/70 transition-all duration-300 hover:border-blue-500 hover:shadow-[0_14px_34px_-4px_rgba(37,99,235,0.22)]">
                  {/* หัวข้อหลักที่เน้นชัดเจน */}
                  <div className="flex items-center gap-2.5 pb-2.5 border-b-2 border-blue-200/90 bg-gradient-to-r from-blue-100/70 to-indigo-50/30 -mx-4 -mt-4 px-4 pt-3.5 rounded-t-2xl">
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0">
                      <Info className="w-4 h-4" />
                    </span>
                    <div className="flex-1 flex items-center justify-between flex-wrap gap-1">
                      <span className="text-blue-950 font-extrabold text-xs sm:text-[13px] tracking-tight">
                        คำอธิบาย: กรณีที่นายจ้างมีแรงงานหลายคน
                      </span>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100/90 border border-blue-300 px-2 py-0.5 rounded-full shadow-2xs">
                        สะดวก 2 วิธี
                      </span>
                    </div>
                  </div>

                  <p className="text-[11.5px] text-slate-800 leading-relaxed font-semibold">
                    สำหรับกรณีที่นายจ้างมีแรงงานหลายคนสามารถเลือกบันทึกข้อมูลได้ <span className="text-blue-700 font-extrabold underline decoration-blue-400 decoration-2 underline-offset-2">2 วิธี</span> ดังนี้:
                  </p>

                  <div className="space-y-2.5 text-[11px]">
                    {/* วิธีที่ 1 */}
                    <div className="p-3.5 rounded-xl bg-white border-2 border-blue-300/90 space-y-2 shadow-[0_3px_12px_-2px_rgba(37,99,235,0.12)] hover:border-blue-400 transition-all">
                      <div className="flex items-center gap-2 font-bold text-blue-900 flex-wrap">
                        <span className="px-2.5 py-1 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10.5px] font-extrabold shadow-sm shrink-0">
                          วิธีที่ 1
                        </span>
                        <span className="text-xs font-bold text-blue-950">พิมพ์คั่นด้วยเครื่องหมายจุลภาค (,) ในช่องส่วนที่ 1 ได้ทันที</span>
                        <span className="text-emerald-800 font-extrabold bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300 text-[10px] shadow-2xs">
                          (สะดวกที่สุด)
                        </span>
                      </div>
                      <p className="text-slate-700 text-[11px] pl-1 leading-relaxed font-medium">
                        ในช่อง <strong>"เลขที่คำขอ (Request No.)"</strong> ในส่วนที่ 1 ท่านสามารถพิมพ์เลขคำขอของแต่ละคนคั่นด้วยเครื่องหมายจุลภาค (,) ได้เลย
                      </p>
                      <div className="pl-1 pt-0.5">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-blue-900 bg-blue-50/90 px-2.5 py-1 rounded-md border border-blue-300 shadow-2xs">
                          <span className="text-slate-500 font-sans text-[10.5px] font-bold">ตัวอย่าง:</span> 69144008610001, 69144008610002
                        </span>
                      </div>
                    </div>

                    {/* วิธีที่ 2 */}
                    <div className="p-3.5 rounded-xl bg-white border-2 border-indigo-300/90 space-y-2 shadow-[0_3px_12px_-2px_rgba(99,102,241,0.12)] hover:border-indigo-400 transition-all">
                      <div className="flex items-center gap-2 font-bold text-indigo-950">
                        <span className="px-2.5 py-1 rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10.5px] font-extrabold shadow-sm shrink-0">
                          วิธีที่ 2
                        </span>
                        <span className="text-xs font-bold text-indigo-950">ระบุในกล่องข้อมูลของแรงงานแต่ละคนในส่วนที่ 3</span>
                      </div>
                      <div className="text-slate-700 text-[11px] pl-1 space-y-1.5 leading-relaxed font-medium">
                        <p>
                          ในส่วน <strong>"3. ข้อมูลคนต่างด้าว"</strong> เมื่อท่านกดเพิ่มแรงงาน (คนที่ 1, คนที่ 2, ...)
                        </p>
                        <p>
                          ในกล่องข้อมูลของแรงงานแต่ละคน จะมีช่อง <strong>"เลขที่คำขอ (สำหรับแรงงานคนนี้)"</strong> ให้ท่านสามารถพิมพ์ระบุเลข 14 หลักของคนนั้นๆ ได้โดยตรง
                        </p>
                        <p className="text-[10.5px] text-slate-600 pt-0.5 font-semibold flex items-center gap-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-blue-600 font-bold">ℹ️ หมายเหตุ:</span>
                          <span>หากไม่ได้พิมพ์เจาะจงรายคน ระบบจะดึงเลขคำขอหลักจากส่วนที่ 1 ไปใช้อัตโนมัติ</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: ข้อมูลนายจ้าง / สถานประกอบการ */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 border-t-4 border-t-teal-600 p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_36px_-4px_rgba(13,148,136,0.12)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between ring-1 ring-white/80 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-teal-500/10 transition-colors" />
            <div className="space-y-4 relative">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center font-bold shadow-sm shadow-teal-500/30">
                    <User className="w-4 h-4" />
                  </span>
                  <h2 className="text-base font-bold text-slate-800">
                    2. ข้อมูลนายจ้าง / สถานประกอบการ
                  </h2>
                </div>
                <span className="text-[11px] text-teal-800 font-semibold bg-teal-50/90 backdrop-blur-xs px-2.5 py-0.5 rounded-full border border-teal-200/80 shadow-2xs">
                  {formData.employerType === 'company' ? 'นิติบุคคล / บริษัท' : 'บุคคลธรรมดา'}
                </span>
              </div>

              {/* Segmented Radio selector for Employer Type */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    เลือกประเภทผู้ยื่น <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    (ระบบจำค่าไว้ ไม่จำเป็นต้องกดซ้ำ)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-inner">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, employerType: 'individual' }));
                      try { localStorage.setItem(LAST_EMPLOYER_TYPE_KEY, 'individual'); } catch {}
                      setErrors(prev => {
                        const copy = { ...prev };
                        delete copy.companyId;
                        delete copy.companyName;
                        delete copy.employer;
                        return copy;
                      });
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      formData.employerType === 'individual'
                        ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/30 ring-2 ring-teal-400/40'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>บุคคลธรรมดา</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, employerType: 'company' }));
                      try { localStorage.setItem(LAST_EMPLOYER_TYPE_KEY, 'company'); } catch {}
                      setErrors(prev => {
                        const copy = { ...prev };
                        delete copy.individualIdCard;
                        delete copy.individualName;
                        delete copy.employer;
                        return copy;
                      });
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      formData.employerType === 'company'
                        ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/30 ring-2 ring-teal-400/40'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>นิติบุคคล / บริษัท</span>
                  </button>
                </div>
              </div>

              {/* Form fields for บุคคลธรรมดา */}
              {formData.employerType === 'individual' && (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-1.5 border-b border-blue-200/80">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                      <User className="w-4 h-4 text-blue-600" />
                      <span>ข้อมูลบุคคลธรรมดา (นายจ้างบุคคล)</span>
                    </div>
                    <span className="text-[10px] font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      บังคับกรอกทั้ง 2 ช่อง
                    </span>
                  </div>

                  {/* เลขประจำตัวประชาชน (13 หลัก) */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      เลขประจำตัวประชาชน (13 หลัก) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={17}
                      value={formData.individualIdCard || ''}
                      onChange={handleIndividualIdChange}
                      placeholder="x-xxxx-xxxxx-xx-x"
                      className={`w-full px-3 py-1.5 text-xs rounded-md border ${
                        errors.individualIdCard ? 'border-red-400 bg-red-50/40' : 'border-slate-300 bg-white'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono transition`}
                    />
                    {errors.individualIdCard && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.individualIdCard}</p>
                    )}
                  </div>

                  {/* ชื่อ-นามสกุล นายจ้าง */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      ชื่อ-นามสกุล นายจ้าง <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.individualName || ''}
                      onChange={handleIndividualNameChange}
                      placeholder="เช่น นายสมชาย ใจดี"
                      className={`w-full px-3 py-1.5 text-xs rounded-md border ${
                        errors.individualName ? 'border-red-400 bg-red-50/40' : 'border-slate-300 bg-white'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition`}
                    />
                    {errors.individualName && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.individualName}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Form fields for นิติบุคคล / บริษัท */}
              {formData.employerType === 'company' && (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-1.5 border-b border-blue-200/80">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>ข้อมูลนิติบุคคล / บริษัท (ห้างหุ้นส่วน)</span>
                    </div>
                    <span className="text-[10px] font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      บังคับกรอกทั้ง 2 ช่อง
                    </span>
                  </div>

                  {/* เลขทะเบียนนิติบุคคล (13 หลัก) */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      เลขทะเบียนนิติบุคคล (13 หลัก) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={17}
                      value={formData.companyId || ''}
                      onChange={handleCompanyIdChange}
                      placeholder="x-xxxx-xxxxx-xx-x"
                      className={`w-full px-3 py-1.5 text-xs rounded-md border ${
                        errors.companyId ? 'border-red-400 bg-red-50/40' : 'border-slate-300 bg-white'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono transition`}
                    />
                    {errors.companyId && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.companyId}</p>
                    )}
                  </div>

                  {/* ชื่อบริษัท / ห้างหุ้นส่วน */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      ชื่อบริษัท / ห้างหุ้นส่วน <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyName || ''}
                      onChange={handleCompanyNameChange}
                      placeholder="เช่น บริษัท ทรัพย์เจริญการค้า จำกัด"
                      className={`w-full px-3 py-1.5 text-xs rounded-md border ${
                        errors.companyName ? 'border-red-400 bg-red-50/40' : 'border-slate-300 bg-white'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition`}
                    />
                    {errors.companyName && (
                      <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.companyName}</p>
                    )}
                  </div>
                </div>
              )}

              {/* เบอร์โทรศัพท์ติดต่อ (บังคับกรอกทุกกรณี) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>
                    เบอร์โทรศัพท์ติดต่อ <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    (บังคับกรอกทุกกรณี)
                  </span>
                </label>
                <input
                  type="tel"
                  maxLength={12}
                  value={formData.phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="0xx-xxx-xxxx"
                  className={`w-full px-3.5 py-2 text-sm rounded-lg border ${
                    errors.phoneNumber ? 'border-red-400 bg-red-50/40' : 'border-slate-300 bg-white'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono`}
                />
                {errors.phoneNumber && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.phoneNumber}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: รายการคนต่างด้าว & ยอดเงิน */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 border-t-4 border-t-indigo-600 p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_36px_-4px_rgba(79,70,229,0.12)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between ring-1 ring-white/80 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
            <div className="space-y-4 relative">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold shadow-sm shadow-indigo-500/30">
                  <Users className="w-4 h-4" />
                </span>
                <h2 className="text-base font-bold text-slate-800">
                  3. รายการคนต่างด้าว & ยอดเงิน
                </h2>
              </div>

              {/* ข้อมูลแรงงานต่างด้าว (เลขประจำตัว 13 หลัก, ชื่อ-นามสกุล, สัญชาติ, ประเภทแรงงาน) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>ข้อมูลแรงงานต่างด้าว</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      (เลข 13 หลัก, ชื่อ-นามสกุล)
                    </span>
                  </span>
                  <span className="text-[11px] font-mono text-blue-800 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md font-semibold">
                    {formData.workers?.length || 1} คน · รวม {(formData.workers?.length || 1) * (formData.ratePerPerson || 1000)} บาท
                  </span>
                </div>

                {/* Worker Items List */}
                <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
                  {(formData.workers || []).map((worker, idx) => (
                    <div 
                      key={worker.id || idx}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2.5 relative group hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                        <span className="text-blue-900 font-semibold flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-[11px] font-bold">
                            {idx + 1}
                          </span>
                          <span>แรงงานคนที่ {idx + 1}</span>
                          {idx > 0 && (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/50 font-medium">
                              คัดลอกสัญชาติ/ประเภทอัตโนมัติ
                            </span>
                          )}
                        </span>
                        {(formData.workers?.length || 0) > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveWorker(idx)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition cursor-pointer"
                            title="ลบแรงงานคนนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* เลขที่คำขอเฉพาะคนนี้ (ถ้ามีหลายเลขคำขอต่อนายจ้างเดียว) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-slate-600">
                            เลขที่คำขอ (สำหรับแรงงานคนนี้)
                          </label>
                          <span className="text-[10px] text-blue-700 font-mono">
                            {worker.requestNumber ? 'กำหนดเฉพาะคน' : (splitRequestNumbers(formData.requestNumber)[idx] ? `ใช้เลขคำขอลำดับที่ ${idx + 1}` : 'ใช้เลขคำขอหลัก')}
                          </span>
                        </div>
                        <input
                          type="text"
                          maxLength={14}
                          value={worker.requestNumber !== undefined ? worker.requestNumber : (splitRequestNumbers(formData.requestNumber)[idx] || '')}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/\D/g, '').slice(0, 14);
                            handleWorkerChange(idx, 'requestNumber', clean);
                          }}
                          placeholder={splitRequestNumbers(formData.requestNumber)[idx] || splitRequestNumbers(formData.requestNumber)[0] || '14 หลัก (ต้องขึ้นต้นด้วย 691 เสมอ)'}
                          className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                        />
                      </div>

                      {/* เลขประจำตัวคนต่างด้าว 13 หลัก */}
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          เลขประจำตัวคนต่างด้าว (13 หลัก) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          maxLength={17}
                          value={worker.idCardNumber}
                          onChange={(e) => handleWorkerChange(idx, 'idCardNumber', formatIdCard(e.target.value))}
                          placeholder="0-xxxx-xxxxx-xx-x"
                          className={`w-full px-3 py-1.5 text-xs rounded-md border ${
                            errors[`workerId_${idx}`] || (idx === 0 && errors.workerId)
                              ? 'border-red-400 bg-red-50/30 ring-1 ring-red-400'
                              : 'border-slate-300 bg-white'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono transition`}
                        />
                        {(errors[`workerId_${idx}`] || (idx === 0 && errors.workerId)) && (
                          <p className="mt-1 text-[11px] text-red-600 font-medium">
                            {errors[`workerId_${idx}`] || errors.workerId}
                          </p>
                        )}
                      </div>

                      {/* ชื่อ-นามสกุล คนต่างด้าว (ล็อคภาษาอังกฤษพิมพ์ใหญ่เท่านั้น) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-slate-600">
                            ชื่อ-นามสกุล คนต่างด้าว <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded">
                            ภาษาอังกฤษพิมพ์ใหญ่ (A-Z)
                          </span>
                        </div>
                        <input
                          type="text"
                          value={worker.name}
                          onChange={(e) => {
                            const upperVal = e.target.value.toUpperCase().replace(/[^A-Z\s\.\-']/g, '');
                            handleWorkerChange(idx, 'name', upperVal);
                          }}
                          placeholder="ระบุตัวพิมพ์ใหญ่ เช่น AUNG SAN"
                          className={`w-full px-3 py-1.5 text-xs rounded-md border ${
                            errors[`workerName_${idx}`] || (idx === 0 && errors.workerName)
                              ? 'border-red-400 bg-red-50/30 ring-1 ring-red-400'
                              : 'border-slate-300 bg-white'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 uppercase font-mono tracking-wide transition`}
                        />
                        {(errors[`workerName_${idx}`] || (idx === 0 && errors.workerName)) && (
                          <p className="mt-1 text-[11px] text-red-600 font-medium">
                            {errors[`workerName_${idx}`] || errors.workerName}
                          </p>
                        )}
                      </div>

                      {/* สัญชาติ & ประเภทแรงงาน / มติ ครม. รายคน */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* สัญชาติ */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            สัญชาติ <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={worker.nationality || NATIONALITIES[0]}
                            onChange={(e) => handleWorkerChange(idx, 'nationality', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition text-slate-700"
                          >
                            {NATIONALITIES.map((nat) => (
                              <option key={nat} value={nat}>
                                {nat}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* ประเภทแรงงานของคนนี้ */}
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            ประเภทแรงงาน / มติ <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={worker.category || formData.alienCategory || ALIEN_CATEGORIES[0]}
                            onChange={(e) => handleWorkerChange(idx, 'category', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded-md border border-blue-200 bg-blue-50/40 text-blue-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                          >
                            {ALIEN_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Button to add worker */}
                <button
                  type="button"
                  onClick={handleAddWorker}
                  className="w-full py-2 px-3 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100/70 text-blue-700 text-[15px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มรายชื่อแรงงาน (คนที่ {(formData.workers?.length || 0) + 1})</span>
                </button>
              </div>

              {/* จำนวนคนต่างด้าว & อัตราต่อคน */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      จำนวนคนต่างด้าว (คน) <span className="text-red-500">*</span>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={formData.alienCount || ''}
                      onChange={(e) => handleCountDirectChange(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 text-center text-sm font-semibold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono"
                    />
                  </div>
                  {/* Quick counter chips */}
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => handleCountChange(-1)}
                      className="flex-1 py-0.5 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      title="ลด 1 คน"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCountChange(1)}
                      className="flex-1 py-0.5 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      title="เพิ่ม 1 คน"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCountChange(5)}
                      className="flex-1 py-0.5 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      title="เพิ่ม 5 คน"
                    >
                      +5
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    อัตราต่อคน (บาท)
                  </label>
                  <input
                    type="text"
                    disabled
                    value="1,000"
                    className="w-full px-3.5 py-2 text-center text-sm font-semibold rounded-lg border border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed font-mono"
                  />
                  <p className="text-[10px] text-slate-400 text-center mt-1">อัตราคงที่ตามระเบียบ</p>
                </div>
              </div>

              {/* ยอดรวมทั้งสิ้น Radiant Highlight Box */}
              <div className="bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-900 text-white rounded-2xl p-4.5 shadow-lg shadow-blue-700/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-baseline justify-between relative z-10">
                  <span className="text-xs sm:text-sm font-semibold text-blue-100">
                    จำนวนเงินรวมทั้งสิ้น:
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight drop-shadow-xs">
                    {formatThaiCurrency(totalAmount)}
                  </span>
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-white/20 text-xs text-blue-100 font-medium relative z-10 flex items-center gap-1.5 flex-wrap">
                  <span className="text-blue-200">คำอ่าน:</span>
                  <span className="font-bold text-amber-300 bg-black/20 px-2 py-0.5 rounded-md backdrop-blur-xs">{thaiBahtText}</span>
                </div>
              </div>

              {/* หมายเหตุเพิ่มเติม */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  หมายเหตุเพิ่มเติม
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all resize-none"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Section 4: ข้อมูลเจ้าหน้าที่ผู้รับเงิน / สำนักงานจัดหางานที่รับคำขอชำระเงินค่าวางหลักประกัน (Full width row) */}
        {/* Section 4: ข้อมูลเจ้าหน้าที่ผู้รับเงิน / สำนักงานจัดหางาน */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 border-t-4 border-t-amber-500 p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] hover:shadow-md transition-all ring-1 ring-white/80">
          <div className="flex items-center pb-3.5 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center font-bold shadow-sm shadow-amber-500/30">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-slate-800">
                4. ข้อมูลเจ้าหน้าที่ผู้รับเงิน / สำนักงานจัดหางานที่รับคำขอชำระเงินค่าวางหลักประกัน
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ชื่อ-นามสกุล เจ้าหน้าที่ */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                ชื่อ-นามสกุล เจ้าหน้าที่ผู้รับเงิน <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.officerName}
                onChange={(e) => handleInputChange('officerName', e.target.value)}
                placeholder="เช่น นายอดิศร วงศ์เจริญรัตน์"
                className={`w-full px-3.5 py-2 text-sm rounded-lg border ${
                  errors.officerName ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all`}
              />
            </div>

            {/* ตำแหน่ง */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                ตำแหน่ง
              </label>
              <input
                type="text"
                value={formData.officerPosition}
                onChange={(e) => handleInputChange('officerPosition', e.target.value)}
                placeholder="เช่น นักวิชาการแรงงานปฏิบัติการ"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              />
            </div>

            {/* สำนักงานจัดหางาน */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                สำนักงานจัดหางานที่รับคำขอ <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.employmentOffice}
                onChange={(e) => handleInputChange('employmentOffice', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white transition-all text-slate-700"
              >
                <optgroup label="สำนักงานจัดหางานกรุงเทพมหานคร (พื้นที่ 1 - 10)">
                  {BANGKOK_EMPLOYMENT_OFFICES.map((office) => (
                    <option key={office} value={office}>
                      {office}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="สำนักงานจัดหางานจังหวัดทั่วประเทศ (76 จังหวัด)">
                  {PROVINCIAL_EMPLOYMENT_OFFICES.map((office) => (
                    <option key={office} value={office}>
                      {office}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>
        </div>

      </div>

      {/* Google Sheets Live Status Indicator */}
      <div className="px-6 sm:px-8 pt-4 pb-1">
        <div 
          className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
            isGoogleConnected || hasWebhook 
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800' 
              : 'bg-amber-50/90 border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isGoogleConnected || hasWebhook ? (
              <>
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-emerald-900">
                    {hasWebhook ? 'โหมด Webhook พร้อมทำงาน:' : 'เชื่อมต่อ Google Sheets แล้ว:'}
                  </span>{' '}
                  <span className="text-emerald-700">
                    เมื่อกดบันทึก ข้อมูลจะถูกบันทึกและส่งเข้า Google Sheet อัตโนมัติทันที
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-amber-900">ยังไม่ได้เชื่อมต่อ Google Sheets:</span>{' '}
                  <span className="text-amber-700">
                    หากกดบันทึกตอนนี้ ข้อมูลจะถูกบันทึกเฉพาะในเครื่องนี้เท่านั้น (ยังไม่ส่งเข้า Google Sheet)
                  </span>
                </div>
              </>
            )}
          </div>

          {!isGoogleConnected && !hasWebhook && onConnectGoogle && (
            <button
              type="button"
              onClick={onConnectGoogle}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-2xs cursor-pointer shrink-0"
            >
              <span>กดเชื่อมต่อ Google ทันที</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Summary Bar before pressing Save (สรุปข้อมูลก่อนกดบันทึก) */}
      <div className="px-6 sm:px-8 py-3.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-emerald-50/90 backdrop-blur-md border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner">
        <div className="flex items-center gap-3.5 flex-wrap">
          <span className="text-slate-600 flex items-center gap-1.5 font-medium">
            <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>นายจ้างที่จะบันทึก:</span>
            <strong className="text-blue-950 font-bold bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-blue-200/80 shadow-2xs max-w-xs truncate">
              {currentDeterminedName || 'ยังไม่ได้ระบุ'}
            </strong>
          </span>

          <span className="text-slate-600 flex items-center gap-1.5 font-medium">
            <Users className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>จำนวนแรงงาน:</span>
            <strong className="text-emerald-900 font-mono font-bold bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-emerald-200/80 shadow-2xs">
              {formData.workers?.length || 1} ราย
            </strong>
          </span>

          <span className="text-slate-600 flex items-center gap-1.5 font-medium">
            <span>ยอดรวม:</span>
            <strong className="text-indigo-950 font-mono font-extrabold bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-indigo-200/80 shadow-2xs text-sm">
              {formatThaiCurrency(totalAmount)}
            </strong>
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5 text-[11px] text-blue-800 bg-white/80 backdrop-blur-xs border border-blue-200 px-3 py-1 rounded-full font-medium shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>เมื่อกดปุ่มบันทึก จะมีหน้าต่างสรุปข้อมูลให้ตรวจสอบอีกครั้ง</span>
        </div>
      </div>

      {/* Bottom Action Footer Bar */}
      <div className="px-6 py-4 sm:px-8 sm:py-5 bg-white/95 backdrop-blur-md border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left button: ล้างแบบฟอร์ม */}
        <button
          type="button"
          onClick={handleReset}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 bg-white/80 hover:bg-slate-100 active:bg-slate-200 transition-all text-sm font-semibold shadow-xs hover:shadow-sm cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-slate-500" />
          <span>ล้างแบบฟอร์ม</span>
        </button>

        {/* Right button: บันทึกข้อมูลหลักประกัน */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white transition-all text-sm sm:text-base font-bold shadow-[0_8px_25px_-4px_rgba(37,99,235,0.4)] hover:shadow-[0_12px_32px_-4px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 active:translate-y-0 active:scale-98 cursor-pointer ring-1 ring-white/20"
          >
            <Check className="w-5 h-5 text-white" />
            <span>บันทึกข้อมูลหลักประกัน</span>
          </button>
        </div>
      </div>

    </div>
  );
};
