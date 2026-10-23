import type { Language } from './index';
const messages = {
  history: ['Cash history', 'പണ ഇടപാട് ചരിത്രം', 'سجل النقد'],
  receive: ['Receive money', 'പണം സ്വീകരിക്കുക', 'استلام مبلغ'],
  received: ['Cash received', 'ലഭിച്ച പണം', 'النقد المستلم'],
  paid: ['Cash paid', 'നൽകിയ പണം', 'النقد المدفوع'],
  net: ['Net cash movement', 'അറ്റ പണ നീക്കം', 'صافي حركة النقد'],
  notice: ['Cash movements only. Customer amount due is unavailable until invoice integration.', 'പണ ഇടപാടുകൾ മാത്രം. ഇൻവോയ്സ് സംയോജനം വരെ ഉപഭോക്താവ് നൽകാനുള്ള തുക ലഭ്യമല്ല.', 'حركات نقدية فقط. المبلغ المستحق على العميل غير متاح حتى ربط الفواتير.'],
  allAccounts: ['All accounts', 'എല്ലാ അക്കൗണ്ടുകളും', 'جميع الحسابات'],
  allParties: ['All parties', 'എല്ലാ കക്ഷികളും', 'جميع الأطراف'],
  party: ['Cashbook party', 'കാഷ്ബുക്ക് കക്ഷി', 'طرف دفتر النقد'],
  choose: ['Choose an existing party', 'നിലവിലുള്ള കക്ഷിയെ തിരഞ്ഞെടുക്കുക', 'اختر طرفًا موجودًا'],
  link: ['Link selected party', 'തിരഞ്ഞെടുത്ത കക്ഷിയെ ബന്ധിപ്പിക്കുക', 'ربط الطرف المحدد'],
  selection: ['Several or archived links exist. Select an active party explicitly; historical links stay in cash history.', 'ഒന്നിലധികം അല്ലെങ്കിൽ ആർക്കൈവ് ചെയ്ത ബന്ധങ്ങളുണ്ട്. സജീവ കക്ഷിയെ തിരഞ്ഞെടുക്കുക; പഴയ ഇടപാടുകൾ നിലനിൽക്കും.', 'توجد روابط متعددة أو مؤرشفة. اختر طرفًا نشطًا صراحةً؛ تبقى الروابط التاريخية في سجل النقد.'],
  linkedElsewhere: ['Linked to another customer', 'മറ്റൊരു ഉപഭോക്താവുമായി ബന്ധിപ്പിച്ചിരിക്കുന്നു', 'مرتبط بعميل آخر'],
  archived: ['Archived', 'ആർക്കൈവ് ചെയ്തത്', 'مؤرشف'],
  close: ['Close', 'അടയ്ക്കുക', 'إغلاق'],
  loading: ['Loading…', 'ലോഡ് ചെയ്യുന്നു…', 'جارٍ التحميل…'],
  retry: ['Retry', 'വീണ്ടും ശ്രമിക്കുക', 'إعادة المحاولة'],
  empty: ['No cash movements in this range.', 'ഈ കാലയളവിൽ പണ ഇടപാടുകളില്ല.', 'لا توجد حركات نقدية في هذا النطاق.'],
  start: ['Start date', 'ആരംഭ തീയതി', 'تاريخ البدء'],
  end: ['End date', 'അവസാന തീയതി', 'تاريخ الانتهاء'],
  invalidRange: ['Choose a valid date range.', 'ശരിയായ തീയതി പരിധി തിരഞ്ഞെടുക്കുക.', 'اختر نطاق تاريخ صالحًا.'],
  reversal: ['Reversal', 'റിവേഴ്സൽ', 'عكس القيد'],
  reversed: ['Reversed original', 'റിവേഴ്സ് ചെയ്ത അസൽ', 'الأصل المعكوس'],
  reports: ['View in Reports', 'റിപ്പോർട്ടിൽ കാണുക', 'عرض في التقارير'],
  confirm: ['Confirm customer and account before posting.', 'രേഖപ്പെടുത്തുന്നതിന് മുമ്പ് ഉപഭോക്താവും അക്കൗണ്ടും ഉറപ്പാക്കുക.', 'تحقق من العميل والحساب قبل الترحيل.'],
  description: ['Manage customer contacts and linked cash history', 'ഉപഭോക്തൃ വിവരങ്ങളും പണ ഇടപാട് ചരിത്രവും നിയന്ത്രിക്കുക', 'إدارة جهات اتصال العملاء وسجل النقد المرتبط'],
} as const;
export function customerCashText(language: Language, key: keyof typeof messages): string {
  return messages[key][language === 'ar' ? 2 : language === 'ml' ? 1 : 0];
}
