export type Language = 'en' | 'ml' | 'ar';

export interface Translations {
  // Navigation / Tabs
  tab_products: string;
  tab_customers: string;
  tab_settings: string;
  tab_print_probe: string;

  // Catalog Common
  search_placeholder: string;
  filter_all: string;
  filter_active: string;
  filter_archived: string;
  filter_low_stock: string;
  action_add_new: string;
  action_edit: string;
  action_archive: string;
  action_restore: string;
  action_save: string;
  action_cancel: string;
  status_active: string;
  status_archived: string;
  confirm_archive: string;
  empty_state_no_items: string;

  // Products
  product_name: string;
  product_sku: string;
  product_barcode: string;
  product_barcode_hint: string;
  product_category: string;
  product_category_all: string;
  product_unit: string;
  product_selling_price: string;
  product_cost_price: string;
  product_tax_rate: string;
  product_stock_tracking: string;
  product_opening_stock: string;
  product_current_stock: string;
  product_min_threshold: string;
  product_desc: string;
  product_scanner_detected: string;

  // Customers
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_tax_id: string;
  customer_address1: string;
  customer_address2: string;
  customer_city: string;
  customer_state: string;
  customer_postal: string;
  customer_country: string;
  customer_balance: string;

  // Validation & Notifications
  err_sku_required: string;
  err_name_required: string;
  err_invalid_price: string;
  msg_product_saved: string;
  msg_customer_saved: string;
  msg_archived: string;
  msg_restored: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    tab_products: 'Products',
    tab_customers: 'Customers',
    tab_settings: 'Settings',
    tab_print_probe: 'Print Feasibility Probe',

    search_placeholder: 'Search name, SKU, barcode (press Enter for scanner)...',
    filter_all: 'All Statuses',
    filter_active: 'Active Only',
    filter_archived: 'Archived Only',
    filter_low_stock: 'Low Stock Alerts',
    action_add_new: 'Add New',
    action_edit: 'Edit',
    action_archive: 'Archive',
    action_restore: 'Restore',
    action_save: 'Save Changes',
    action_cancel: 'Cancel',
    status_active: 'Active',
    status_archived: 'Archived',
    confirm_archive: 'Are you sure you want to archive this record?',
    empty_state_no_items: 'No records found matching current criteria.',

    product_name: 'Product Name',
    product_sku: 'SKU / Item Code',
    product_barcode: 'Barcode / EAN / UPC',
    product_barcode_hint: 'Scanners emit Enter key to auto-search or scan here',
    product_category: 'Category',
    product_category_all: 'All Categories',
    product_unit: 'Unit (e.g. pcs, kg, bag)',
    product_selling_price: 'Selling Price',
    product_cost_price: 'Cost Price',
    product_tax_rate: 'Tax Rate (%)',
    product_stock_tracking: 'Track Inventory Stock',
    product_opening_stock: 'Opening Stock',
    product_current_stock: 'Current Stock',
    product_min_threshold: 'Min Stock Alert Threshold',
    product_desc: 'Description / Notes',
    product_scanner_detected: 'Barcode Scanned via Keyboard-Wedge!',

    customer_name: 'Customer / Business Name',
    customer_phone: 'Phone Number (International)',
    customer_email: 'Email Address',
    customer_tax_id: 'Tax ID / GSTIN / TRN',
    customer_address1: 'Address Line 1',
    customer_address2: 'Address Line 2 (Building / Suite)',
    customer_city: 'City / District',
    customer_state: 'State / Province',
    customer_postal: 'Postal / PIN Code',
    customer_country: 'Country',
    customer_balance: 'Current Balance / Receivables',

    err_sku_required: 'SKU is mandatory and must be unique',
    err_name_required: 'Name cannot be empty',
    err_invalid_price: 'Selling price must be a valid positive number',
    msg_product_saved: 'Product successfully saved to catalog.',
    msg_customer_saved: 'Customer successfully saved to records.',
    msg_archived: 'Item archived.',
    msg_restored: 'Item restored to active list.',
  },
  ml: {
    tab_products: 'ഉൽപന്നങ്ങൾ',
    tab_customers: 'ഉപഭോക്താക്കൾ',
    tab_settings: 'ക്രമീകരണങ്ങൾ',
    tab_print_probe: 'പ്രിന്റ് പരിശോധന',

    search_placeholder: 'പേര്, SKU, ബാർകോഡ് തിരയുക (സ്കാനറിന് Enter അമർത്തുക)...',
    filter_all: 'എല്ലാം',
    filter_active: 'സജീവം മാത്രം',
    filter_archived: 'ആർക്കൈവ് ചെയ്തവ',
    filter_low_stock: 'കുറഞ്ഞ സ്റ്റോക്ക്',
    action_add_new: 'പുതിയത് ചേർക്കുക',
    action_edit: 'തിരുത്തുക',
    action_archive: 'ആർക്കൈവ് ചെയ്യുക',
    action_restore: 'പുനഃസ്ഥാപിക്കുക',
    action_save: 'സൂക്ഷിക്കുക',
    action_cancel: 'റദ്ദാക്കുക',
    status_active: 'സജീവം',
    status_archived: 'ആർക്കൈവ്ഡ്',
    confirm_archive: 'നിങ്ങൾക്കിത് ആർക്കൈവ് ചെയ്യണമെന്ന് ഉറപ്പാണോ?',
    empty_state_no_items: 'വിവരങ്ങൾ ഒന്നും കണ്ടെത്താനായില്ല.',

    product_name: 'ഉൽപന്നത്തിന്റെ പേര്',
    product_sku: 'എസ്.കെ.യു (SKU)',
    product_barcode: 'ബാർകോഡ്',
    product_barcode_hint: 'സ്കാനർ ഇൻപുട്ട് സ്വയമേവ തിരിച്ചറിയപ്പെടും',
    product_category: 'വിഭാഗം',
    product_category_all: 'എല്ലാ വിഭാഗങ്ങളും',
    product_unit: 'യൂണിറ്റ് (ഉദാ: pcs, kg, bag)',
    product_selling_price: 'വിൽപന വില',
    product_cost_price: 'വാങ്ങിയ വില',
    product_tax_rate: 'നികുതി ശതമാനം (%)',
    product_stock_tracking: 'സ്റ്റോക്ക് ട്രാക്കിംഗ്',
    product_opening_stock: 'പ്രാരംഭ സ്റ്റോക്ക്',
    product_current_stock: 'നിലവിലെ സ്റ്റോക്ക്',
    product_min_threshold: 'കുറഞ്ഞ സ്റ്റോക്ക് പരിധി',
    product_desc: 'വിവരണം',
    product_scanner_detected: 'ബാർകോഡ് സ്കാൻ ചെയ്തു!',

    customer_name: 'ഉപഭോക്താവിന്റെ പേര്',
    customer_phone: 'ഫോൺ നമ്പർ',
    customer_email: 'ഇമെയിൽ',
    customer_tax_id: 'നികുതി നമ്പർ (GSTIN/TRN)',
    customer_address1: 'വിലാസം ലൈൻ 1',
    customer_address2: 'വിലാസം ലൈൻ 2',
    customer_city: 'നഗരം',
    customer_state: 'സംസ്ഥാനം',
    customer_postal: 'പിൻകോഡ്',
    customer_country: 'രാജ്യം',
    customer_balance: 'നിലവിലെ കുടിശ്ശിക',

    err_sku_required: 'SKU നിർബന്ധമാണ്',
    err_name_required: 'പേര് നൽകേണ്ടതുണ്ട്',
    err_invalid_price: 'സാധുവായ വില നൽകുക',
    msg_product_saved: 'ഉൽപന്നം വിജയകരമായി സൂക്ഷിച്ചു.',
    msg_customer_saved: 'ഉപഭോക്താവിനെ വിജയകരമായി സൂക്ഷിച്ചു.',
    msg_archived: 'ആർക്കൈവ് ചെയ്തു.',
    msg_restored: 'പുനഃസ്ഥാപിച്ചു.',
  },
  ar: {
    tab_products: 'المنتجات',
    tab_customers: 'العملاء',
    tab_settings: 'الإعدادات',
    tab_print_probe: 'فحص الطباعة',

    search_placeholder: 'ابحث عن الاسم أو الرمز أو الباركود...',
    filter_all: 'كل الحالات',
    filter_active: 'النشطة فقط',
    filter_archived: 'المؤرشفة',
    filter_low_stock: 'تنبيهات انخفاض المخزون',
    action_add_new: 'إضافة جديد',
    action_edit: 'تعديل',
    action_archive: 'أرشفة',
    action_restore: 'استعادة',
    action_save: 'حفظ التغييرات',
    action_cancel: 'إلغاء',
    status_active: 'نشط',
    status_archived: 'مؤرشف',
    confirm_archive: 'هل أنت متأكد من أرشفة هذا السجل؟',
    empty_state_no_items: 'لم يتم العثور على سجلات مطابقة.',

    product_name: 'اسم المنتج',
    product_sku: 'رمز الصنف (SKU)',
    product_barcode: 'الباركود',
    product_barcode_hint: 'الماسح الضوئي يرسل مفتاح Enter تلقائياً',
    product_category: 'الفئة',
    product_category_all: 'جميع الفئات',
    product_unit: 'الوحدة (مثال: حبة، كغ، كيس)',
    product_selling_price: 'سعر البيع',
    product_cost_price: 'سعر التكلفة',
    product_tax_rate: 'نسبة الضريبة (%)',
    product_stock_tracking: 'تتبع المخزون',
    product_opening_stock: 'المخزون الافتتاحي',
    product_current_stock: 'المخزون الحالي',
    product_min_threshold: 'حد التنبيه الأدنى',
    product_desc: 'الوصف / ملاحظات',
    product_scanner_detected: 'تم مسح الباركود بنجاح!',

    customer_name: 'اسم العميل / المؤسسة',
    customer_phone: 'رقم الهاتف',
    customer_email: 'البريد الإلكتروني',
    customer_tax_id: 'الرقم الضريبي (TRN/VAT)',
    customer_address1: 'العنوان سطر 1',
    customer_address2: 'العنوان سطر 2',
    customer_city: 'المدينة',
    customer_state: 'المنطقة / المحافظة',
    customer_postal: 'الرمز البريدي',
    customer_country: 'الدولة',
    customer_balance: 'الرصيد المستحق',

    err_sku_required: 'رمز الصنف مطلوب ويجب أن يكون فريداً',
    err_name_required: 'الاسم مطلوب',
    err_invalid_price: 'يجب إدخال سعر بيع صحيح',
    msg_product_saved: 'تم حفظ المنتج بنجاح في الكتالوج.',
    msg_customer_saved: 'تم حفظ العميل بنجاح.',
    msg_archived: 'تمت الأرشفة.',
    msg_restored: 'تمت الاستعادة.',
  },
};
