import type { Language } from './index';
const en = {
  manage: 'Manage Stock', add: 'Add', reduce: 'Reduce', history: 'History', close: 'Close',
  quantity: 'Quantity', date: 'Business date', reason: 'Reason', current: 'Current stock',
  preview: 'Stock before → after', confirm: 'Confirm adjustment', correction: 'Correct movement',
  correcting: 'Correction: opposite quantity of the original movement', cancelCorrection: 'Cancel correction',
  readOnly: 'Archived or untracked products have read-only stock history.', empty: 'No stock movements yet.',
  loading: 'Loading stock…', loadError: 'Could not load stock. Try again.', retry: 'Retry',
  invalid: 'Enter a positive quantity with up to 3 decimal places.', required: 'Business date and reason are required.',
  insufficient: 'Insufficient stock for this reduction.', maximum: 'Result exceeds the supported stock limit.',
  rejected: 'Adjustment was not saved. Check the refreshed stock and edit the details.',
  failed: 'Could not confirm this adjustment. Retry the same adjustment before making another.',
  pending: 'This adjustment is awaiting confirmation. Its details are locked for a safe retry.',
  saved: 'Stock adjustment saved.', opening: 'Opening stock', adjustment: 'Adjustment', reversal: 'Correction',
  movement: 'Stock movement', resulting: 'Stock after', corrected: 'Corrected', immutable: 'History is permanent. Correct an adjustment by recording its opposite.',
};
type Copy = typeof en;
const ml: Copy = {
  manage: 'സ്റ്റോക്ക് നിയന്ത്രണം', add: 'ചേർക്കുക', reduce: 'കുറയ്ക്കുക', history: 'ചരിത്രം', close: 'അടയ്ക്കുക',
  quantity: 'അളവ്', date: 'വ്യാപാര തീയതി', reason: 'കാരണം', current: 'നിലവിലെ സ്റ്റോക്ക്',
  preview: 'സ്റ്റോക്ക് മുമ്പ് → ശേഷം', confirm: 'മാറ്റം സ്ഥിരീകരിക്കുക', correction: 'മാറ്റം തിരുത്തുക',
  correcting: 'തിരുത്തൽ: പഴയ മാറ്റത്തിന്റെ വിപരീത അളവ്', cancelCorrection: 'തിരുത്തൽ റദ്ദാക്കുക',
  readOnly: 'ആർക്കൈവ് ചെയ്തതോ ട്രാക്ക് ചെയ്യാത്തതോ ആയ ഉൽപ്പന്നങ്ങൾക്ക് ചരിത്രം മാത്രം കാണാം.', empty: 'സ്റ്റോക്ക് മാറ്റങ്ങൾ ഇല്ല.',
  loading: 'സ്റ്റോക്ക് ലോഡ് ചെയ്യുന്നു…', loadError: 'സ്റ്റോക്ക് ലഭിച്ചില്ല. വീണ്ടും ശ്രമിക്കുക.', retry: 'വീണ്ടും ശ്രമിക്കുക',
  invalid: 'മൂന്ന് ദശാംശ സ്ഥാനങ്ങൾ വരെ ഉള്ള പൂജ്യത്തേക്കാൾ വലിയ അളവ് നൽകുക.', required: 'വ്യാപാര തീയതിയും കാരണവും ആവശ്യമാണ്.',
  insufficient: 'കുറയ്ക്കാൻ മതിയായ സ്റ്റോക്ക് ഇല്ല.', maximum: 'പരമാവധി സ്റ്റോക്ക് പരിധി കവിയുന്നു.',
  rejected: 'മാറ്റം സംരക്ഷിച്ചിട്ടില്ല. പുതുക്കിയ സ്റ്റോക്ക് പരിശോധിച്ച് വിവരങ്ങൾ തിരുത്തുക.',
  failed: 'മാറ്റം സ്ഥിരീകരിക്കാനായില്ല. മറ്റൊരു മാറ്റത്തിന് മുമ്പ് ഇതേ മാറ്റം വീണ്ടും ശ്രമിക്കുക.',
  pending: 'ഈ മാറ്റം സ്ഥിരീകരണത്തിനായി കാത്തിരിക്കുന്നു. സുരക്ഷിതമായ പുനഃശ്രമത്തിനായി വിവരങ്ങൾ പൂട്ടിയിരിക്കുന്നു.',
  saved: 'സ്റ്റോക്ക് മാറ്റം സംരക്ഷിച്ചു.', opening: 'ആരംഭ സ്റ്റോക്ക്', adjustment: 'സ്റ്റോക്ക് മാറ്റം', reversal: 'തിരുത്തൽ',
  movement: 'സ്റ്റോക്ക് ഇടപാട്', resulting: 'ശേഷമുള്ള സ്റ്റോക്ക്', corrected: 'തിരുത്തിയത്', immutable: 'ചരിത്രം സ്ഥിരമാണ്. വിപരീത മാറ്റം രേഖപ്പെടുത്തി തിരുത്താം.',
};
const ar: Copy = {
  manage: 'إدارة المخزون', add: 'إضافة', reduce: 'تخفيض', history: 'السجل', close: 'إغلاق',
  quantity: 'الكمية', date: 'تاريخ العمل', reason: 'السبب', current: 'المخزون الحالي',
  preview: 'المخزون قبل ← بعد', confirm: 'تأكيد التعديل', correction: 'تصحيح الحركة',
  correcting: 'التصحيح: الكمية المعاكسة للحركة الأصلية', cancelCorrection: 'إلغاء التصحيح',
  readOnly: 'سجل المنتجات المؤرشفة أو غير المتتبعة للقراءة فقط.', empty: 'لا توجد حركات مخزون بعد.',
  loading: 'جارٍ تحميل المخزون…', loadError: 'تعذر تحميل المخزون. حاول مجددًا.', retry: 'إعادة المحاولة',
  invalid: 'أدخل كمية موجبة بثلاث منازل عشرية كحد أقصى.', required: 'تاريخ العمل والسبب مطلوبان.',
  insufficient: 'المخزون غير كافٍ لهذا التخفيض.', maximum: 'النتيجة تتجاوز الحد الأقصى للمخزون.',
  rejected: 'لم يتم حفظ التعديل. تحقق من المخزون المحدّث وعدّل التفاصيل.',
  failed: 'تعذر تأكيد التعديل. أعد محاولة نفس التعديل قبل إنشاء تعديل آخر.',
  pending: 'هذا التعديل ينتظر التأكيد. تم قفل التفاصيل لإعادة المحاولة بأمان.',
  saved: 'تم حفظ تعديل المخزون.', opening: 'المخزون الافتتاحي', adjustment: 'تعديل', reversal: 'تصحيح',
  movement: 'حركة مخزون', resulting: 'المخزون بعد', corrected: 'تم التصحيح', immutable: 'السجل دائم. يمكن تصحيح التعديل بتسجيل حركة معاكسة.',
};
export const stockTranslations: Record<Language, Copy> = { en, ml, ar };
