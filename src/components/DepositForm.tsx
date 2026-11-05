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
  Receipt,
  Settings2
} from 'lucide-react';
import { FormDataState, DepositRecord, ForeignWorker } from '../types/deposit';
import { 
  PAYMENT_CHANNELS, 
  ALIEN_CATEGORIES, 
  normalizeAlienCategory,
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
  parseAllowedPrefixes,
  formatRequestConfigSummary,
  isMatchingRequestPrefixWhileTyping,
  isSingleRequestNumberCompleteAndValid,
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
  onOpenAdminRequestConfig?: () => void;
}

const LAST_EMPLOYER_TYPE_KEY = 'doe_last_employer_type';

export const DepositForm: React.FC<DepositFormProps> = ({ 
  onSave, 
  initialData, 
  onReset,
  isGoogleConnected = false,
  onConnectGoogle,
  hasWebhook = false,
  onOpenAdminRequestConfig,
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
    const maxLen = reqConfig.enabled ? (reqConfig.length || 14) : 30;
    const clean = reqConfig.allowAlphanumeric
      ? rawVal.toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, maxLen)
      : rawVal.replace(/\D/g, '').slice(0, maxLen);
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
    const raw = e.target.value;
    const maxLen = reqConfig.enabled ? (reqConfig.length || 14) : 30;

    // กรองอักขระตามโหมดที่แอดมินตั้งค่า (ตัวเลขล้วน หรือ ตัวอักษร+ตัวเลข+ขีด) และเครื่องหมายคั่นสำหรับหลายเลขคำขอ
    let cleanVal = reqConfig.allowAlphanumeric
      ? raw.toUpperCase().replace(/[^A-Z0-9,\s\n/;\-]/g, '')
      : raw.replace(/[^\d,\s\n/;\-]/g, '');

    // หากเป็นเลขเดี่ยว (ไม่มีเครื่องหมายคั่น) ตัดไม่เกินจำนวนหลักที่แอดมินกำหนด
    if (!cleanVal.includes(',') && !cleanVal.includes('\n') && !cleanVal.includes(';') && !cleanVal.includes('/')) {
      cleanVal = reqConfig.allowAlphanumeric
        ? cleanVal.replace(/[^A-Z0-9\-]/g, '').slice(0, maxLen)
        : cleanVal.replace(/\D/g, '').slice(0, maxLen);
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

    if (!reqConfig.enabled) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.requestNumber;
        return copy;
      });
      return;
    }

    const prefixes = parseAllowedPrefixes(reqConfig.prefix);
    const prefixErrorText =
      prefixes.length === 1
        ? `"${prefixes[0]}"`
        : prefixes.map(p => `"${p}"`).join(' หรือ ');

    const list = splitRequestNumbers(cleanVal);
    // ตรวจสอบกรณีเลขคำขอเดียว
    if (list.length <= 1 && !cleanVal.includes(',')) {
      const singleNum = list[0] || '';

      if (!isMatchingRequestPrefixWhileTyping(singleNum, reqConfig)) {
        setErrors(prev => ({
          ...prev,
          requestNumber: `เลขที่คำขอต้องขึ้นต้นด้วย ${prefixErrorText} เสมอ`,
        }));
        return;
      }

      if (singleNum.length === reqConfig.length) {
        if (!isSingleRequestNumberCompleteAndValid(singleNum, reqConfig)) {
          setErrors(prev => ({
            ...prev,
            requestNumber: `เลขที่คำขอต้องขึ้นต้นด้วย ${prefixErrorText} เสมอ`,
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
        if (!isMatchingRequestPrefixWhileTyping(num, reqConfig)) {
          setErrors(prev => ({
            ...prev,
            requestNumber: `${label} ต้องขึ้นต้นด้วย ${prefixErrorText} เสมอ`,
          }));
          hasError = true;
          break;
        }
        if (num.length > reqConfig.length) {
          setErrors(prev => ({
            ...prev,
            requestNumber: `${label} ต้องมี ${reqConfig.length} หลักพอดี (ปัจจุบัน ${num.length} หลัก)`,
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
    const result = validateRequestNumber(formData.requestNumber, reqConfig);
    if (!result.isValid && result.error) {
      setErrors(prev => ({
        ...prev,
        requestNumber: result.error!,
      }));
      return;
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
      cleanValue = value.toUpperCase().replace(/[^A-Z\s\.\-'@]/g, '');
    } else if (field === 'category') {
      // บังคับล็อคประเภทแรงงาน / มติ ให้เป็น 1 ใน 3 ตัวเลือกที่ตั้งไว้เสมอ
      cleanValue = normalizeAlienCategory(value);
    }

    setFormData(prev => {
      const currentWorkers = [...(prev.workers || [])];
      if (!currentWorkers[index]) {
        currentWorkers[index] = {
          id: `w-${Date.now()}-${index}`,
          idCardNumber: '',
          name: '',
          nationality: NATIONALITIES[0],
          category: normalizeAlienCategory(prev.alienCategory),
        };
      }
      currentWorkers[index] = {
        ...currentWorkers[index],
        [field]: cleanValue,
      };

      // บังคับล็อค alienCategory ให้อยู่ใน 3 ตัวเลือกเสมอ (ไม่สร้างข้อความ "หลากหลายประเภท (...)")
      let newAlienCategory = normalizeAlienCategory(prev.alienCategory);
      if (field === 'category') {
        newAlienCategory = normalizeAlienCategory(currentWorkers[0]?.category || cleanValue);
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

    // ตรวจสอบเลขที่คำขอตามเงื่อนไขที่แอดมินตั้งค่าไว้ใน RequestNumberConfig
    const reqValidation = validateRequestNumber(formData.requestNumber, reqConfig);
    if (!reqValidation.isValid && reqValidation.error) {
      newErrors.requestNumber = reqValidation.error;
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
      category: normalizeAlienCategory(w.category || formData.alienCategory),
      requestNumber: w.requestNumber?.trim() || reqList[idx] || reqList[0] || formData.requestNumber || '',
    }));

    const newRecord: DepositRecord = {
      ...formData,
      alienCategory: normalizeAlienCategory(enrichedWorkers[0]?.category || formData.alienCategory),
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
    <div className="w-full max-w-[1600px] 2xl:max-w-[1720px] mx-auto bg-white rounded-2xl shadow-[8px_8px_0px_0px_#000000] border-3 border-black overflow-hidden font-sans relative transition-all duration-300">
      
      {/* Reset Success Notification Toast */}
      {resetSuccess && (
        <div className="fixed top-6 right-6 z-50 bg-[#6EE7B7] text-black px-4 py-3 rounded-xl shadow-[5px_5px_0px_0px_#000000] flex items-center gap-2.5 text-sm border-3 border-black font-extrabold animate-in slide-in-from-top-3 fade-in duration-200">
          <Check className="w-5 h-5 text-black shrink-0 stroke-[3]" />
          <span>ล้างข้อมูลในแบบฟอร์มเรียบร้อยแล้ว</span>
        </div>
      )}

      {/* Confirm Reset Dialog Modal (Replaces blocked window.confirm) */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-[8px_8px_0px_0px_#000000] max-w-sm w-full p-5 border-3 border-black space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-[#FFE500] text-black border-2 border-black shadow-[3px_3px_0px_0px_#000000] flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-black text-black text-base">ยืนยันการล้างข้อมูล?</h3>
                <p className="text-xs font-bold text-neutral-700 mt-0.5">
                  ข้อมูลที่กรอกไว้ในแบบฟอร์มจะถูกรีเซ็ตกลับเป็นค่าเริ่มต้น
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-black">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-2 rounded-lg border-2 border-black bg-white text-black hover:bg-neutral-100 text-xs font-extrabold shadow-[2px_2px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeReset}
                className="px-4 py-2 rounded-lg border-2 border-black bg-[#FF6B6B] hover:bg-[#FF5252] text-black text-xs font-extrabold shadow-[2px_2px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
              >
                ยืนยัน ล้างข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Summary Modal before Saving (สรุปข้อมูลก่อนบันทึก: นายจ้างอะไร จำนวนแรงงานกี่ราย) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-[10px_10px_0px_0px_#000000] max-w-2xl w-full border-3 border-black overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="bg-[#FFE500] text-black px-6 py-4 flex items-center justify-between shrink-0 border-b-3 border-black">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white text-black flex items-center justify-center font-black border-2 border-black shadow-[3px_3px_0px_0px_#000000]">
                  <ShieldCheck className="w-6 h-6 text-black stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-black">
                    สรุปข้อมูลก่อนบันทึกเข้าระบบ
                  </h3>
                  <p className="text-xs font-bold text-neutral-800">
                    กรุณาตรวจสอบชื่อนายจ้าง จำนวนแรงงาน และยอดเงินก่อนยืนยันบันทึก
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="bg-white text-black hover:bg-[#FF6B6B] p-1.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition cursor-pointer text-sm font-black"
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm bg-[#FFFDF7]">
              
              {/* Alert Callout */}
              <div className="p-3 bg-[#BFDBFE] border-2 border-black rounded-xl text-black text-xs font-extrabold flex items-center gap-2.5 shadow-[3px_3px_0px_0px_#000000]">
                <Info className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
                <span>
                  ระบบพร้อมบันทึกรายการสำหรับนายจ้างและแรงงานต่างด้าวดังต่อไปนี้:
                </span>
              </div>

              {/* Box 1: สรุปข้อมูลนายจ้าง */}
              <div className="bg-white border-2 border-black rounded-xl p-4 space-y-3 shadow-[4px_4px_0px_0px_#000000]">
                <div className="flex items-center justify-between pb-2 border-b-2 border-black text-black font-black">
                  <div className="flex items-center gap-2 text-black">
                    <Building2 className="w-4 h-4 text-black stroke-[2.5]" />
                    <span>ข้อมูลนายจ้าง / ผู้ประกอบการ</span>
                  </div>
                  <span className="text-[11px] font-extrabold text-black bg-[#FFE500] px-2.5 py-0.5 rounded-md border-2 border-black shadow-[2px_2px_0px_0px_#000000]">
                    {formData.employerType === 'company' ? 'นิติบุคคล / บริษัท' : 'บุคคลธรรมดา'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <span className="text-neutral-700 font-bold text-xs block mb-0.5">ชื่อนายจ้าง / บริษัท:</span>
                    <strong className="text-black text-base font-black block break-words">
                      {currentDeterminedName || '-'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-neutral-700 font-bold text-xs block mb-0.5">
                      {formData.employerType === 'company' ? 'เลขทะเบียนนิติบุคคล (13 หลัก):' : 'เลขประจำตัวประชาชน (13 หลัก):'}
                    </span>
                    <span className="font-mono font-black text-black text-sm">
                      {currentDeterminedId || '-'}
                    </span>
                    {formData.phoneNumber && (
                      <span className="text-neutral-700 font-bold text-xs block mt-1 font-mono">
                        เบอร์ติดต่อ: {formatPhone(formData.phoneNumber)}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-neutral-700 font-bold text-xs block mb-0.5">
                      เลขที่คำขอ {splitRequestNumbers(formData.requestNumber).length > 1 ? `(${splitRequestNumbers(formData.requestNumber).length} เลข):` : `(${reqConfig.length} หลัก):`}
                    </span>
                    <strong className="font-mono font-black text-black bg-[#FEF08A] px-2 py-0.5 rounded border-2 border-black inline-block text-xs max-w-full truncate">
                      {formData.requestNumber || '-'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-neutral-700 font-bold text-xs block mb-0.5">ใบเสร็จรับเงิน:</span>
                    <span className="font-mono font-black text-black">
                      เล่มที่ {formData.receiptBook || '-'} / เลขที่ {formData.receiptNumber || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Box 2: สรุปข้อมูลแรงงานต่างด้าว (จำนวน X ราย พร้อมตารางรายชื่อ) */}
              <div className="bg-[#D1FAE5] border-2 border-black rounded-xl p-4 space-y-3 shadow-[4px_4px_0px_0px_#000000]">
                <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                  <div className="flex items-center gap-2 text-black font-black">
                    <Users className="w-4 h-4 text-black stroke-[2.5]" />
                    <span>ข้อมูลแรงงานต่างด้าวที่จะบันทึก</span>
                  </div>
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#FFE500] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000000]">
                    <span>จำนวน {formData.workers?.length || 1} ราย</span>
                  </div>
                </div>

                {/* Worker List Table */}
                <div className="bg-white rounded-lg border-2 border-black overflow-hidden shadow-[2px_2px_0px_0px_#000000]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#6EE7B7] text-black font-black border-b-2 border-black">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10 border-r border-black">คนที่</th>
                        <th className="py-2.5 px-3 border-r border-black">เลขที่คำขอ</th>
                        <th className="py-2.5 px-3 border-r border-black">เลขประจำตัว (13 หลัก)</th>
                        <th className="py-2.5 px-3 border-r border-black">ชื่อ-นามสกุล คนต่างด้าว</th>
                        <th className="py-2.5 px-3">สัญชาติ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {(formData.workers || []).map((w, idx) => {
                        const wReq = w.requestNumber?.trim() || splitRequestNumbers(formData.requestNumber)[idx] || splitRequestNumbers(formData.requestNumber)[0] || formData.requestNumber || '-';
                        return (
                          <tr key={w.id || idx} className="hover:bg-[#FEF08A]/50 transition-colors">
                            <td className="py-2 px-3 text-center font-black text-black bg-[#F3F4F6] border-r border-black">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 font-mono font-extrabold text-black text-[11px] border-r border-black">
                              {wReq}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-black border-r border-black">
                              {w.idCardNumber || '-'}
                            </td>
                            <td className="py-2 px-3 font-extrabold text-black break-words border-r border-black">
                              {w.name || '-'}
                            </td>
                            <td className="py-2 px-3 font-bold text-neutral-800">
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
              <div className="bg-[#FDE68A] border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_#000000]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-neutral-800 block">สำนักงานจัดหางาน:</span>
                    <strong className="text-black text-xs sm:text-sm font-black block">
                      {formData.employmentOffice}
                    </strong>
                    <div className="text-[11px] font-bold text-neutral-800 pt-0.5">
                      <span>เจ้าหน้าที่ผู้รับเงิน: {formData.officerName}</span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right sm:border-l-2 sm:border-black sm:pl-4 pt-2 sm:pt-0 border-t-2 sm:border-t-0 border-black">
                    <span className="text-xs text-black block font-extrabold">ยอดเงินหลักประกันรวม:</span>
                    <span className="text-2xl font-black font-mono text-black block">
                      {formatThaiCurrency(totalAmount)}
                    </span>
                    <span className="text-[11px] text-neutral-900 font-bold">
                      ({thaiBahtText})
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-white border-t-3 border-black flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border-2 border-black bg-white text-black hover:bg-neutral-100 font-extrabold text-xs sm:text-sm shadow-[3px_3px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
              >
                ← ยกเลิก / กลับไปแก้ไข
              </button>

              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={() => executeConfirmSave(false)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl border-2 border-black bg-[#6EE7B7] hover:bg-[#34D399] text-black font-black text-xs sm:text-sm shadow-[4px_4px_0px_0px_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4 text-black stroke-[3]" />
                  <span>ยืนยัน บันทึกข้อมูล</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      
      {/* Top Header Banner with Neo-Brutalism High-Contrast Yellow & Black */}
      <div className="bg-[#FFE500] text-black px-6 py-6 sm:px-8 sm:py-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden border-b-3 border-black">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-xl bg-white text-black flex items-center justify-center font-black shadow-[4px_4px_0px_0px_#000000] shrink-0 border-2 border-black">
            <Building2 className="w-7 h-7 text-black stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-black flex items-center gap-2">
              แบบบันทึกการชำระเงินค่าวางหลักประกันคนต่างด้าว
            </h1>
            <p className="text-xs font-bold text-neutral-800 mt-0.5 tracking-wide">
              ตามพระราชกำหนดการบริหารจัดการการทำงานของคนต่างด้าว พ.ศ. ๒๕๖๐ และที่แก้ไขเพิ่มเติม
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold bg-white border-2 border-black text-black shadow-[3px_3px_0px_0px_#000000]">
            <Info className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
            <span>อัตราจัดเก็บคงที่ 1,000 บาทต่อคน</span>
          </div>
        </div>
      </div>

      {/* Main Form Body with Neo-Brutalist surface */}
      <div className="p-5 sm:p-7 md:p-8 space-y-6 bg-[#FAF7F0] relative">
        
        {/* Error Banner if any required field is missing */}
        {Object.keys(errors).length > 0 && (
          <div className="p-4 bg-[#FECACA] border-3 border-black rounded-xl text-black text-xs sm:text-sm flex items-center gap-3 shadow-[4px_4px_0px_0px_#000000] font-extrabold">
            <AlertCircle className="w-5 h-5 shrink-0 text-black stroke-[2.5]" />
            <span>กรุณากรอกข้อมูลในช่องที่จำเป็นให้ครบถ้วนก่อนบันทึก ({Object.values(errors).join(', ')})</span>
          </div>
        )}

        {/* 3 Columns Section: 1, 2, 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Section 1: ข้อมูลเอกสารและหลักฐาน */}
          <div className="bg-white rounded-xl border-3 border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000000] flex flex-col justify-start relative overflow-hidden">
            <div className="space-y-4 relative">
              <div className="flex items-center gap-2.5 pb-3 border-b-2 border-black">
                <span className="w-9 h-9 rounded-lg bg-[#60A5FA] text-black border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#000000]">
                  <FileText className="w-4 h-4 stroke-[2.5]" />
                </span>
                <h2 className="text-base font-black text-black">
                  1. ข้อมูลเอกสารและหลักฐาน
                </h2>
              </div>

              {/* เลขที่คำขอ (รองรับทั้ง 1 เลข และคั่นด้วยเครื่องหมายจุลภาคหากมีหลายเลข) */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <label className="text-xs font-extrabold text-black">
                      เลขที่คำขอ (Request No.) <span className="text-red-600 font-black">*</span>
                    </label>
                    <span className="text-[10.5px] font-black text-black bg-[#FEF08A] border border-black px-2 py-0.5 rounded">
                      {formatRequestConfigSummary(reqConfig)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onOpenAdminRequestConfig && (
                      <button
                        type="button"
                        onClick={onOpenAdminRequestConfig}
                        title="สำหรับแอดมิน: กำหนดว่าจะให้กรอกเลขที่คำขอขึ้นต้นด้วยอะไร และมีกี่หลัก"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E9D5FF] hover:bg-[#D8B4FE] text-black border border-black text-[10.5px] font-black shadow-[1px_1px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
                      >
                        <Settings2 className="w-3 h-3 stroke-[2.5]" />
                        <span>ตั้งค่ารูปแบบ (แอดมิน)</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-neutral-700 font-bold mb-1.5">
                  (หากมีหลายเลขคำขอ ให้พิมพ์คั่นด้วยเครื่องหมายจุลภาค <code className="font-mono font-black text-black">,</code>)
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.requestNumber}
                    onChange={handleRequestNumberChange}
                    onBlur={handleRequestNumberBlur}
                    placeholder={`เช่น ${generateSampleRequestNumber(reqConfig, 1)} หรือคั่นด้วยจุลภาคหากมีหลายเลขคำขอ`}
                    className={`w-full px-3.5 py-2 text-sm rounded-lg border-2 border-black font-mono font-bold pr-24 shadow-[2px_2px_0px_0px_#000000] ${
                      errors.requestNumber 
                        ? 'bg-[#FECACA]' 
                        : formData.requestNumber && splitRequestNumbers(formData.requestNumber).length > 0 && splitRequestNumbers(formData.requestNumber).every(n => isSingleRequestNumberCompleteAndValid(n, reqConfig))
                        ? 'bg-[#D1FAE5]'
                        : 'bg-white'
                    } focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[4px_4px_0px_0px_#000000] transition-all`}
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-mono pointer-events-none">
                    {splitRequestNumbers(formData.requestNumber).length > 1 ? (
                      <span className="text-black font-black bg-[#BFDBFE] border-2 border-black px-1.5 py-0.5 rounded text-[11px]">
                        {splitRequestNumbers(formData.requestNumber).length} เลขคำขอ
                      </span>
                    ) : formData.requestNumber ? (
                      <span className={`${
                        isSingleRequestNumberCompleteAndValid(formData.requestNumber, reqConfig)
                          ? 'text-black font-black bg-[#6EE7B7] px-1.5 py-0.5 rounded border-2 border-black flex items-center gap-0.5'
                          : formData.requestNumber && !isMatchingRequestPrefixWhileTyping(formData.requestNumber, reqConfig)
                          ? 'text-black font-black bg-[#FCA5A5] px-1.5 py-0.5 rounded border-2 border-black'
                          : 'text-black font-bold bg-[#F3F4F6] px-1.5 py-0.5 rounded border border-black'
                      }`}>
                        {isSingleRequestNumberCompleteAndValid(formData.requestNumber, reqConfig) && '✓ '}
                        {reqConfig.enabled ? `${formData.requestNumber.length}/${reqConfig.length}` : `${formData.requestNumber.length} หลัก`}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* แสดงสรุปรายการเมื่อระบุหลายเลขคำขอ */}
                {splitRequestNumbers(formData.requestNumber).length > 1 && (
                  <div className="mt-2 p-2.5 rounded-lg bg-[#BFDBFE] border-2 border-black shadow-[2px_2px_0px_0px_#000000] flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-black font-black text-[11px]">ระบุ {splitRequestNumbers(formData.requestNumber).length} เลขคำขอ:</span>
                    {splitRequestNumbers(formData.requestNumber).map((num, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border-2 border-black text-black font-mono text-[11px] font-bold">
                        <span className="text-neutral-700 font-sans text-[10px] font-extrabold">คนที่ {i + 1}:</span>
                        <span>{num}</span>
                      </span>
                    ))}
                  </div>
                )}

                {errors.requestNumber && (
                  <p className="mt-1.5 text-xs text-red-700 flex items-center gap-1 animate-in fade-in font-extrabold">
                    <span>⚠️</span>
                    <span>{errors.requestNumber}</span>
                  </p>
                )}
              </div>

              {/* เล่มที่ใบเสร็จ & เลขที่ใบเสร็จ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-black mb-1.5">
                    เล่มที่ใบเสร็จ <span className="text-red-600 font-black">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.receiptBook}
                    onChange={(e) => handleInputChange('receiptBook', e.target.value)}
                    placeholder="เช่น 012"
                    className={`w-full px-3.5 py-2 text-sm rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] ${
                      errors.receiptBook ? 'bg-[#FECACA]' : 'bg-white'
                    } focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[4px_4px_0px_0px_#000000] transition-all font-mono font-bold`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-black mb-1.5">
                    เลขที่ใบเสร็จ <span className="text-red-600 font-black">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.receiptNumber}
                    onChange={(e) => handleInputChange('receiptNumber', e.target.value)}
                    placeholder="เช่น 000546"
                    className={`w-full px-3.5 py-2 text-sm rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] ${
                      errors.receiptNumber ? 'bg-[#FECACA]' : 'bg-white'
                    } focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[4px_4px_0px_0px_#000000] transition-all font-mono font-bold`}
                  />
                </div>
              </div>

              {/* วันที่ชำระเงิน */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold text-black">
                    วันที่ชำระเงิน <span className="text-red-600 font-black">*</span>
                  </label>
                  {formData.paymentDate && (
                    <span className="text-[11px] font-black text-black bg-[#FFE500] px-2 py-0.5 rounded border-2 border-black shadow-[2px_2px_0px_0px_#000000]">
                      พ.ศ. {formatToBuddhistDate(formData.paymentDate)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="date"
                    value={normalizePaymentDateToIso(formData.paymentDate) || formData.paymentDate || ''}
                    onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                    className={`w-full px-3.5 py-2 text-sm rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] ${
                      errors.paymentDate ? 'bg-[#FECACA]' : 'bg-white'
                    } focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[4px_4px_0px_0px_#000000] transition-all font-mono font-bold`}
                  />
                  <Calendar className="w-4 h-4 text-black absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2.5]" />
                </div>
              </div>

              {/* กล่องคำอธิบาย: พื้นที่ว่างใต้วันที่ชำระเงิน กรณีที่นายจ้างมีแรงงานหลายคน (Neo-Brutalism เน้นกรอบและเน้นหัวข้อชัดเจน) */}
              <div className="pt-2">
                <div className="rounded-xl border-3 border-black bg-[#FEF08A] p-4 space-y-3 shadow-[5px_5px_0px_0px_#000000]">
                  {/* หัวข้อหลักที่เน้นชัดเจน */}
                  <div className="flex items-center gap-2.5 pb-2.5 border-b-2 border-black bg-[#FFE500] -mx-4 -mt-4 px-4 pt-3.5 rounded-t-lg">
                    <span className="w-7 h-7 rounded-md bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_#000000] flex items-center justify-center shrink-0">
                      <Info className="w-4 h-4 stroke-[2.5]" />
                    </span>
                    <div className="flex-1 flex items-center justify-between flex-wrap gap-1">
                      <span className="text-black font-black text-xs sm:text-[13px] tracking-tight">
                        คำอธิบาย: กรณีที่นายจ้างมีแรงงานหลายคน
                      </span>
                      <span className="text-[10px] font-black text-black bg-[#6EE7B7] border-2 border-black px-2 py-0.5 rounded-md shadow-[2px_2px_0px_0px_#000000]">
                        สะดวก 2 วิธี
                      </span>
                    </div>
                  </div>

                  <p className="text-[11.5px] text-black leading-relaxed font-extrabold">
                    สำหรับกรณีที่นายจ้างมีแรงงานหลายคนสามารถเลือกบันทึกข้อมูลได้ <span className="bg-white px-1.5 py-0.5 border border-black font-black">2 วิธี</span> ดังนี้:
                  </p>

                  <div className="space-y-2.5 text-[11px]">
                    {/* วิธีที่ 1 */}
                    <div className="p-3.5 rounded-lg bg-white border-2 border-black space-y-2 shadow-[3px_3px_0px_0px_#000000]">
                      <div className="flex items-center gap-2 font-black text-black flex-wrap">
                        <span className="px-2.5 py-1 rounded bg-[#60A5FA] border-2 border-black text-black text-[10.5px] font-black shadow-[2px_2px_0px_0px_#000000] shrink-0">
                          วิธีที่ 1
                        </span>
                        <span className="text-xs font-black text-black">พิมพ์คั่นด้วยเครื่องหมายจุลภาค (,) ในช่องส่วนที่ 1 ได้ทันที</span>
                        <span className="text-black font-black bg-[#6EE7B7] px-2 py-0.5 rounded border-2 border-black text-[10px]">
                          (สะดวกที่สุด)
                        </span>
                      </div>
                      <p className="text-neutral-800 text-[11px] pl-1 leading-relaxed font-bold">
                        ในช่อง <strong>"เลขที่คำขอ (Request No.)"</strong> ในส่วนที่ 1 ท่านสามารถพิมพ์เลขคำขอของแต่ละคนคั่นด้วยเครื่องหมายจุลภาค (,) ได้เลย
                      </p>
                      <div className="pl-1 pt-0.5">
                        <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[11px] text-black bg-[#BFDBFE] px-2.5 py-1 rounded border-2 border-black">
                          <span className="text-black font-sans text-[10.5px] font-black">ตัวอย่าง:</span> {generateSampleRequestNumber(reqConfig, 1)}, {generateSampleRequestNumber(reqConfig, 2)}
                        </span>
                      </div>
                    </div>

                    {/* วิธีที่ 2 */}
                    <div className="p-3.5 rounded-lg bg-white border-2 border-black space-y-2 shadow-[3px_3px_0px_0px_#000000]">
                      <div className="flex items-center gap-2 font-black text-black">
                        <span className="px-2.5 py-1 rounded bg-[#E9D5FF] border-2 border-black text-black text-[10.5px] font-black shadow-[2px_2px_0px_0px_#000000] shrink-0">
                          วิธีที่ 2
                        </span>
                        <span className="text-xs font-black text-black">ระบุในกล่องข้อมูลของแรงงานแต่ละคนในส่วนที่ 3</span>
                      </div>
                      <div className="text-neutral-800 text-[11px] pl-1 space-y-1.5 leading-relaxed font-bold">
                        <p>
                          ในส่วน <strong>"3. ข้อมูลคนต่างด้าว"</strong> เมื่อท่านกดเพิ่มแรงงาน (คนที่ 1, คนที่ 2, ...)
                        </p>
                        <p>
                          ในกล่องข้อมูลของแรงงานแต่ละคน จะมีช่อง <strong>"เลขที่คำขอ (สำหรับแรงงานคนนี้)"</strong> ให้ท่านสามารถพิมพ์ระบุเลข {reqConfig.length} หลักของคนนั้นๆ ได้โดยตรง
                        </p>
                        <p className="text-[10.5px] text-black pt-0.5 font-extrabold flex items-center gap-1 bg-[#F3F4F6] p-2 rounded border-2 border-black">
                          <span className="text-black font-black">ℹ️ หมายเหตุ:</span>
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
          <div className="bg-white rounded-xl border-3 border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000000] flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-4 relative">
              <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-lg bg-[#6EE7B7] text-black border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#000000]">
                    <User className="w-4 h-4 stroke-[2.5]" />
                  </span>
                  <h2 className="text-base font-black text-black">
                    2. ข้อมูลนายจ้าง / สถานประกอบการ
                  </h2>
                </div>
                <span className="text-[11px] text-black font-black bg-[#6EE7B7] px-2.5 py-0.5 rounded-md border-2 border-black shadow-[2px_2px_0px_0px_#000000]">
                  {formData.employerType === 'company' ? 'นิติบุคคล / บริษัท' : 'บุคคลธรรมดา'}
                </span>
              </div>

              {/* Segmented Radio selector for Employer Type */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-black">
                    เลือกประเภทผู้ยื่น <span className="text-red-600 font-black">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-neutral-600">
                    (ระบบจำค่าไว้ ไม่จำเป็นต้องกดซ้ำ)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 p-1.5 bg-[#F3F4F6] rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000000]">
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
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-black border-2 transition-all duration-150 cursor-pointer ${
                      formData.employerType === 'individual'
                        ? 'bg-[#6EE7B7] text-black border-black shadow-[2px_2px_0px_0px_#000000] -translate-x-0.5 -translate-y-0.5'
                        : 'bg-white text-neutral-800 border-transparent hover:border-black hover:bg-neutral-100'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 stroke-[2.5]" />
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
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-black border-2 transition-all duration-150 cursor-pointer ${
                      formData.employerType === 'company'
                        ? 'bg-[#6EE7B7] text-black border-black shadow-[2px_2px_0px_0px_#000000] -translate-x-0.5 -translate-y-0.5'
                        : 'bg-white text-neutral-800 border-transparent hover:border-black hover:bg-neutral-100'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>นิติบุคคล / บริษัท</span>
                  </button>
                </div>
              </div>

              {/* Form fields for บุคคลธรรมดา */}
              {formData.employerType === 'individual' && (
                <div className="p-4 rounded-xl border-2 border-black bg-[#D1FAE5] space-y-3 shadow-[3px_3px_0px_0px_#000000] animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                    <div className="flex items-center gap-1.5 text-xs font-black text-black">
                      <User className="w-4 h-4 text-black stroke-[2.5]" />
                      <span>ข้อมูลบุคคลธรรมดา (นายจ้างบุคคล)</span>
                    </div>
                    <span className="text-[10px] font-black text-black bg-[#FFE500] px-2 py-0.5 rounded border-2 border-black">
                      บังคับกรอกทั้ง 2 ช่อง
                    </span>
                  </div>

                  {/* เลขประจำตัวประชาชน (13 หลัก) */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-black mb-1">
                      เลขประจำตัวประชาชน (13 หลัก) <span className="text-red-600 font-black">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={17}
                      value={formData.individualIdCard || ''}
                      onChange={handleIndividualIdChange}
                      placeholder="x-xxxx-xxxxx-xx-x"
                      className={`w-full px-3 py-2 text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] ${
                        errors.individualIdCard ? 'bg-[#FECACA]' : 'bg-white'
                      } focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[4px_4px_0px_0px_#000000] font-mono font-bold transition`}
                    />
                    {errors.individualIdCard && (
                      <p className="text-[11px] text-red-700 mt-1 font-extrabold">{errors.individualIdCard}</p>
                    )}
                  </div>

                  {/* ชื่อ-นามสกุล นายจ้าง */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-black mb-1">
                      ชื่อ-นามสกุล นายจ้าง <span className="text-red-600 font-black">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.individualName || ''}
                      onChange={handleIndividualNameChange}
                      placeholder="เช่น นายสมชาย ใจดี"
                      className={`w-full px-3 py-2 text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] ${
                        errors.individualName ? 'bg-[#FECACA]' : 'bg-white'
                      } focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[4px_4px_0px_0px_#000000] font-bold transition`}
                    />
                    {errors.individualName && (
                      <p className="text-[11px] text-red-700 mt-1 font-extrabold">{errors.individualName}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Form fields for นิติบุคคล / บริษัท */}
              {formData.employerType === 'company' && (
                <div className="p-4 rounded-xl border-2 border-black bg-[#BFDBFE] space-y-3 shadow-[3px_3px_0px_0px_#000000] animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                    <div className="flex items-center gap-1.5 text-xs font-black text-black">
                      <Building2 className="w-4 h-4 text-black stroke-[2.5]" />
                      <span>ข้อมูลนิติบุคคล / บริษัท (ห้างหุ้นส่วน)</span>
                    </div>
                    <span className="text-[10px] font-black text-black bg-[#FFE500] px-2 py-0.5 rounded border-2 border-black">
                      บังคับกรอกทั้ง 2 ช่อง
                    </span>
                  </div>

                  {/* เลขทะเบียนนิติบุคคล (13 หลัก) */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-black mb-1">
                      เลขทะเบียนนิติบุคคล (13 หลัก) <span className="text-red-600 font-black">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={17}
                      value={formData.companyId || ''}
                      onChange={handleCompanyIdChange}
                      placeholder="x-xxxx-xxxxx-xx-x"
                      className={`w-full px-3 py-2 text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] ${
                        errors.companyId ? 'bg-[#FECACA]' : 'bg-white'
                      } focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[4px_4px_0px_0px_#000000] font-mono font-bold transition`}
                    />
                    {errors.companyId && (
                      <p className="text-[11px] text-red-700 mt-1 font-extrabold">{errors.companyId}</p>
                    )}
                  </div>

                  {/* ชื่อบริษัท / ห้างหุ้นส่วน */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-black mb-1">
                      ชื่อบริษัท / ห้างหุ้นส่วน <span className="text-red-600 font-black">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyName || ''}
                      onChange={handleCompanyNameChange}
                      placeholder="เช่น บริษัท ทรัพย์เจริญการค้า จำกัด"
                      className={`w-full px-3 py-2 text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] ${
                        errors.companyName ? 'bg-[#FECACA]' : 'bg-white'
                      } focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[4px_4px_0px_0px_#000000] font-bold transition`}
                    />
                    {errors.companyName && (
                      <p className="text-[11px] text-red-700 mt-1 font-extrabold">{errors.companyName}</p>
                    )}
                  </div>
                </div>
              )}

              {/* เบอร์โทรศัพท์ติดต่อ (บังคับกรอกทุกกรณี) */}
              <div>
                <label className="block text-xs font-extrabold text-black mb-1.5 flex items-center justify-between">
                  <span>
                    เบอร์โทรศัพท์ติดต่อ <span className="text-red-600 font-black">*</span>
                  </span>
                  <span className="text-[11px] font-bold text-neutral-700">
                    (บังคับกรอกทุกกรณี)
                  </span>
                </label>
                <input
                  type="tel"
                  maxLength={12}
                  value={formData.phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="0xx-xxx-xxxx"
                  className={`w-full px-3.5 py-2 text-sm rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] ${
                    errors.phoneNumber ? 'bg-[#FECACA]' : 'bg-white'
                  } focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[4px_4px_0px_0px_#000000] transition-all font-mono font-bold`}
                />
                {errors.phoneNumber && (
                  <p className="text-[11px] text-red-700 mt-1 font-extrabold">{errors.phoneNumber}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: รายการคนต่างด้าว & ยอดเงิน */}
          <div className="bg-white rounded-xl border-3 border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000000] flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-4 relative">
              <div className="flex items-center gap-2.5 pb-3 border-b-2 border-black">
                <span className="w-9 h-9 rounded-lg bg-[#E9D5FF] text-black border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#000000]">
                  <Users className="w-4 h-4 stroke-[2.5]" />
                </span>
                <h2 className="text-base font-black text-black">
                  3. รายการคนต่างด้าว & ยอดเงิน
                </h2>
              </div>

              {/* ข้อมูลแรงงานต่างด้าว (เลขประจำตัว 13 หลัก, ชื่อ-นามสกุล, สัญชาติ, ประเภทแรงงาน) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-black flex items-center gap-1.5">
                    <span>ข้อมูลแรงงานต่างด้าว</span>
                    <span className="text-[11px] font-bold text-neutral-700">
                      (เลข 13 หลัก, ชื่อ-นามสกุล)
                    </span>
                  </span>
                  <span className="text-[11px] font-mono text-black bg-[#FFE500] border-2 border-black px-2 py-0.5 rounded-md font-black shadow-[2px_2px_0px_0px_#000000]">
                    {formData.workers?.length || 1} คน · รวม {(formData.workers?.length || 1) * (formData.ratePerPerson || 1000)} บาท
                  </span>
                </div>

                {/* Worker Items List */}
                <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
                  {(formData.workers || []).map((worker, idx) => (
                    <div 
                      key={worker.id || idx}
                      className="p-3.5 rounded-xl border-2 border-black bg-[#FFFDF7] space-y-2.5 relative shadow-[3px_3px_0px_0px_#000000]"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-black pb-1.5 border-b-2 border-black">
                        <span className="text-black font-black flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-md bg-[#FFE500] text-black border-2 border-black inline-flex items-center justify-center text-[11px] font-black shadow-[1px_1px_0px_0px_#000000]">
                            {idx + 1}
                          </span>
                          <span>แรงงานคนที่ {idx + 1}</span>
                          {idx > 0 && (
                            <span className="text-[10px] text-black bg-[#6EE7B7] px-1.5 py-0.2 rounded border border-black font-extrabold">
                              คัดลอกสัญชาติ/ประเภทอัตโนมัติ
                            </span>
                          )}
                        </span>
                        {(formData.workers?.length || 0) > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveWorker(idx)}
                            className="text-black bg-[#FCA5A5] hover:bg-[#FF6B6B] p-1 rounded border-2 border-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
                            title="ลบแรงงานคนนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        )}
                      </div>

                      {/* เลขที่คำขอเฉพาะคนนี้ (ถ้ามีหลายเลขคำขอต่อนายจ้างเดียว) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-extrabold text-black">
                            เลขที่คำขอ (สำหรับแรงงานคนนี้)
                          </label>
                          <span className="text-[10px] text-black bg-[#BFDBFE] px-1.5 py-0.5 rounded border border-black font-mono font-bold">
                            {worker.requestNumber ? 'กำหนดเฉพาะคน' : (splitRequestNumbers(formData.requestNumber)[idx] ? `ใช้เลขคำขอลำดับที่ ${idx + 1}` : 'ใช้เลขคำขอหลัก')}
                          </span>
                        </div>
                        <input
                          type="text"
                          maxLength={reqConfig.enabled ? (reqConfig.length || 14) : 30}
                          value={worker.requestNumber !== undefined ? worker.requestNumber : (splitRequestNumbers(formData.requestNumber)[idx] || '')}
                          onChange={(e) => {
                            const maxLen = reqConfig.enabled ? (reqConfig.length || 14) : 30;
                            const clean = reqConfig.allowAlphanumeric
                              ? e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, maxLen)
                              : e.target.value.replace(/\D/g, '').slice(0, maxLen);
                            handleWorkerChange(idx, 'requestNumber', clean);
                          }}
                          placeholder={splitRequestNumbers(formData.requestNumber)[idx] || splitRequestNumbers(formData.requestNumber)[0] || formatRequestConfigSummary(reqConfig)}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border-2 border-black bg-white font-mono font-bold shadow-[2px_2px_0px_0px_#000000] focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[3px_3px_0px_0px_#000000] transition"
                        />
                      </div>

                      {/* เลขประจำตัวคนต่างด้าว 13 หลัก */}
                      <div>
                        <label className="block text-[11px] font-extrabold text-black mb-1">
                          เลขประจำตัวคนต่างด้าว (13 หลัก) <span className="text-red-600 font-black">*</span>
                        </label>
                        <input
                          type="text"
                          maxLength={17}
                          value={worker.idCardNumber}
                          onChange={(e) => handleWorkerChange(idx, 'idCardNumber', formatIdCard(e.target.value))}
                          placeholder="0-xxxx-xxxxx-xx-x"
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] ${
                            errors[`workerId_${idx}`] || (idx === 0 && errors.workerId)
                              ? 'bg-[#FECACA]'
                              : 'bg-white'
                          } focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[3px_3px_0px_0px_#000000] font-mono font-bold transition`}
                        />
                        {(errors[`workerId_${idx}`] || (idx === 0 && errors.workerId)) && (
                          <p className="mt-1 text-[11px] text-red-700 font-extrabold">
                            {errors[`workerId_${idx}`] || errors.workerId}
                          </p>
                        )}
                      </div>

                      {/* ชื่อ-นามสกุล คนต่างด้าว (ล็อคภาษาอังกฤษพิมพ์ใหญ่เท่านั้น) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-extrabold text-black">
                            ชื่อ-นามสกุล คนต่างด้าว <span className="text-red-600 font-black">*</span>
                          </label>
                          <span className="text-[10px] text-black font-extrabold bg-[#E9D5FF] border border-black px-1.5 py-0.5 rounded">
                            ภาษาอังกฤษพิมพ์ใหญ่ (A-Z, @)
                          </span>
                        </div>
                        <input
                          type="text"
                          value={worker.name}
                          onChange={(e) => {
                            const upperVal = e.target.value.toUpperCase().replace(/[^A-Z\s\.\-'@]/g, '');
                            handleWorkerChange(idx, 'name', upperVal);
                          }}
                          placeholder="ระบุตัวพิมพ์ใหญ่ เช่น AUNG SAN"
                          className={`w-full px-3 py-1.5 text-xs rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] ${
                            errors[`workerName_${idx}`] || (idx === 0 && errors.workerName)
                              ? 'bg-[#FECACA]'
                              : 'bg-white'
                          } focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[3px_3px_0px_0px_#000000] uppercase font-mono font-bold tracking-wide transition`}
                        />
                        {(errors[`workerName_${idx}`] || (idx === 0 && errors.workerName)) && (
                          <p className="mt-1 text-[11px] text-red-700 font-extrabold">
                            {errors[`workerName_${idx}`] || errors.workerName}
                          </p>
                        )}
                      </div>

                      {/* สัญชาติ & ประเภทแรงงาน / มติ ครม. รายคน */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* สัญชาติ */}
                        <div>
                          <label className="block text-[11px] font-extrabold text-black mb-1">
                            สัญชาติ <span className="text-red-600 font-black">*</span>
                          </label>
                          <select
                            value={worker.nationality || NATIONALITIES[0]}
                            onChange={(e) => handleWorkerChange(idx, 'nationality', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded-lg border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000000] focus:outline-none focus:bg-[#FFFBEB] transition text-black font-bold cursor-pointer"
                          >
                            {NATIONALITIES.map((nat) => (
                              <option key={nat} value={nat}>
                                {nat}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* ประเภทแรงงานของคนนี้ (ล็อคเฉพาะ 3 ตัวเลือกที่กำหนดเท่านั้น) */}
                        <div>
                          <label className="block text-[11px] font-extrabold text-black mb-1">
                            ประเภทแรงงาน / มติ <span className="text-red-600 font-black">*</span>
                          </label>
                          <select
                            value={normalizeAlienCategory(worker.category || formData.alienCategory)}
                            onChange={(e) => handleWorkerChange(idx, 'category', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded-lg border-2 border-black bg-[#BFDBFE] text-black font-extrabold shadow-[2px_2px_0px_0px_#000000] focus:outline-none focus:bg-[#FFFBEB] transition cursor-pointer"
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
                  className="w-full py-2.5 px-3 rounded-xl border-2 border-black bg-[#FFE500] hover:bg-[#FDE047] text-black text-[15px] font-black flex items-center justify-center gap-1.5 shadow-[4px_4px_0px_0px_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>เพิ่มรายชื่อแรงงาน (คนที่ {(formData.workers?.length || 0) + 1})</span>
                </button>
              </div>

              {/* จำนวนคนต่างด้าว & อัตราต่อคน */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t-2 border-black">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-extrabold text-black">
                      จำนวนคนต่างด้าว (คน) <span className="text-red-600 font-black">*</span>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={formData.alienCount || ''}
                      onChange={(e) => handleCountDirectChange(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 text-center text-sm font-black rounded-lg border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000000] focus:outline-none focus:bg-[#FFFBEB] transition-all font-mono"
                    />
                  </div>
                  {/* Quick counter chips */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => handleCountChange(-1)}
                      className="flex-1 py-1 text-[11px] font-black rounded border-2 border-black bg-white hover:bg-[#FECACA] text-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
                      title="ลด 1 คน"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCountChange(1)}
                      className="flex-1 py-1 text-[11px] font-black rounded border-2 border-black bg-white hover:bg-[#6EE7B7] text-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
                      title="เพิ่ม 1 คน"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCountChange(5)}
                      className="flex-1 py-1 text-[11px] font-black rounded border-2 border-black bg-white hover:bg-[#FFE500] text-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
                      title="เพิ่ม 5 คน"
                    >
                      +5
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-black mb-1.5">
                    อัตราต่อคน (บาท)
                  </label>
                  <input
                    type="text"
                    disabled
                    value="1,000"
                    className="w-full px-3.5 py-2 text-center text-sm font-black rounded-lg border-2 border-black bg-[#E5E7EB] text-black cursor-not-allowed font-mono shadow-[2px_2px_0px_0px_#000000]"
                  />
                  <p className="text-[10px] font-bold text-neutral-700 text-center mt-1.5">อัตราคงที่ตามระเบียบ</p>
                </div>
              </div>

              {/* ยอดรวมทั้งสิ้น Neo-Brutalist Highlight Box */}
              <div className="bg-[#6EE7B7] text-black rounded-xl border-3 border-black p-4.5 shadow-[5px_5px_0px_0px_#000000] relative overflow-hidden">
                <div className="flex items-baseline justify-between relative z-10">
                  <span className="text-xs sm:text-sm font-black text-black">
                    จำนวนเงินรวมทั้งสิ้น:
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-black font-mono tracking-tight">
                    {formatThaiCurrency(totalAmount)}
                  </span>
                </div>
                <div className="mt-2.5 pt-2.5 border-t-2 border-black text-xs text-black font-extrabold relative z-10 flex items-center gap-1.5 flex-wrap">
                  <span>คำอ่าน:</span>
                  <span className="font-black text-black bg-[#FFE500] px-2.5 py-0.5 rounded border-2 border-black shadow-[2px_2px_0px_0px_#000000]">{thaiBahtText}</span>
                </div>
              </div>

              {/* หมายเหตุเพิ่มเติม */}
              <div>
                <label className="block text-xs font-extrabold text-black mb-1.5">
                  หมายเหตุเพิ่มเติม
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000000] focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[4px_4px_0px_0px_#000000] transition-all resize-none font-medium"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Section 4: ข้อมูลเจ้าหน้าที่ผู้รับเงิน / สำนักงานจัดหางาน */}
        <div className="bg-white rounded-xl border-3 border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000000]">
          <div className="flex items-center pb-3.5 border-b-2 border-black mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-[#FDBA74] text-black border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#000000]">
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              </span>
              <h2 className="text-base font-black text-black">
                4. ข้อมูลเจ้าหน้าที่ผู้รับเงิน / สำนักงานจัดหางานที่รับคำขอชำระเงินค่าวางหลักประกัน
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ชื่อ-นามสกุล เจ้าหน้าที่ */}
            <div>
              <label className="block text-xs font-extrabold text-black mb-1.5">
                ชื่อ-นามสกุล เจ้าหน้าที่ผู้รับเงิน <span className="text-red-600 font-black">*</span>
              </label>
              <input
                type="text"
                value={formData.officerName}
                onChange={(e) => handleInputChange('officerName', e.target.value)}
                placeholder="เช่น นายอดิศร วงศ์เจริญรัตน์"
                className={`w-full px-3.5 py-2 text-sm rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] ${
                  errors.officerName ? 'bg-[#FECACA]' : 'bg-white'
                } focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[4px_4px_0px_0px_#000000] transition-all font-bold`}
              />
            </div>

            {/* ตำแหน่ง */}
            <div>
              <label className="block text-xs font-extrabold text-black mb-1.5">
                ตำแหน่ง
              </label>
              <input
                type="text"
                value={formData.officerPosition}
                onChange={(e) => handleInputChange('officerPosition', e.target.value)}
                placeholder="เช่น นักวิชาการแรงงานปฏิบัติการ"
                className="w-full px-3.5 py-2 text-sm rounded-lg border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000000] focus:outline-none focus:bg-[#FFFBEB] focus:shadow-[4px_4px_0px_0px_#000000] transition-all font-bold"
              />
            </div>

            {/* สำนักงานจัดหางาน */}
            <div>
              <label className="block text-xs font-extrabold text-black mb-1.5">
                สำนักงานจัดหางานที่รับคำขอ <span className="text-red-600 font-black">*</span>
              </label>
              <select
                value={formData.employmentOffice}
                onChange={(e) => handleInputChange('employmentOffice', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000000] focus:outline-none focus:bg-[#FFFBEB] transition-all text-black font-bold cursor-pointer"
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
      <div className="px-6 sm:px-8 pt-4 pb-2 bg-[#FAF7F0]">
        <div 
          className={`p-3.5 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_#000000] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
            isGoogleConnected || hasWebhook 
              ? 'bg-[#D1FAE5] text-black' 
              : 'bg-[#FDE68A] text-black'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isGoogleConnected || hasWebhook ? (
              <>
                <div className="w-6 h-6 rounded-md bg-[#22C55E] text-black border-2 border-black flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <div>
                  <span className="font-black text-black">
                    {hasWebhook ? 'โหมด Webhook พร้อมทำงาน:' : 'เชื่อมต่อ Google Sheets แล้ว:'}
                  </span>{' '}
                  <span className="font-bold text-neutral-900">
                    เมื่อกดบันทึก ข้อมูลจะถูกบันทึกและส่งเข้า Google Sheet อัตโนมัติทันที
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-md bg-[#FB923C] text-black border-2 border-black flex items-center justify-center shrink-0">
                  <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div>
                  <span className="font-black text-black">ยังไม่ได้เชื่อมต่อ Google Sheets:</span>{' '}
                  <span className="font-bold text-neutral-900">
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
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg border-2 border-black bg-[#60A5FA] hover:bg-[#3B82F6] text-black font-black text-xs shadow-[2px_2px_0px_0px_#000000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition cursor-pointer shrink-0"
            >
              <span>กดเชื่อมต่อ Google ทันที</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Summary Bar before pressing Save (สรุปข้อมูลก่อนกดบันทึก) */}
      <div className="px-6 sm:px-8 py-4 bg-[#BFDBFE] border-t-3 border-black flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3.5 flex-wrap">
          <span className="text-black flex items-center gap-1.5 font-extrabold">
            <Building2 className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
            <span>นายจ้างที่จะบันทึก:</span>
            <strong className="text-black font-black bg-white px-2.5 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] max-w-xs truncate">
              {currentDeterminedName || 'ยังไม่ได้ระบุ'}
            </strong>
          </span>

          <span className="text-black flex items-center gap-1.5 font-extrabold">
            <Users className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
            <span>จำนวนแรงงาน:</span>
            <strong className="text-black font-mono font-black bg-[#6EE7B7] px-2.5 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000]">
              {formData.workers?.length || 1} ราย
            </strong>
          </span>

          <span className="text-black flex items-center gap-1.5 font-extrabold">
            <span>ยอดรวม:</span>
            <strong className="text-black font-mono font-black bg-[#FFE500] px-2.5 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] text-sm">
              {formatThaiCurrency(totalAmount)}
            </strong>
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5 text-[11px] text-black bg-white border-2 border-black px-3 py-1 rounded-lg font-extrabold shadow-[2px_2px_0px_0px_#000000]">
          <ShieldCheck className="w-3.5 h-3.5 text-black stroke-[2.5]" />
          <span>เมื่อกดปุ่มบันทึก จะมีหน้าต่างสรุปข้อมูลให้ตรวจสอบอีกครั้ง</span>
        </div>
      </div>

      {/* Bottom Action Footer Bar */}
      <div className="px-6 py-4 sm:px-8 sm:py-5 bg-white border-t-3 border-black flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left button: ล้างแบบฟอร์ม */}
        <button
          type="button"
          onClick={handleReset}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-black text-black bg-white hover:bg-[#FECACA] transition-all text-sm font-black shadow-[3px_3px_0px_0px_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-black stroke-[2.5]" />
          <span>ล้างแบบฟอร์ม</span>
        </button>

        {/* Right button: บันทึกข้อมูลหลักประกัน */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl border-3 border-black bg-[#FFE500] hover:bg-[#FDE047] text-black transition-all text-sm sm:text-base font-black shadow-[5px_5px_0px_0px_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_0px_#000000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none cursor-pointer"
          >
            <Check className="w-5 h-5 text-black stroke-[3]" />
            <span>บันทึกข้อมูลหลักประกัน</span>
          </button>
        </div>
      </div>

    </div>
  );
};
