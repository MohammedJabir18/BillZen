export type Language = 'en' | 'ml' | 'ar';

export interface Translations {
  // Navigation / Tabs
  nav_more: string;
  nav_more_title: string;
  tab_cashbook: string;
  tab_products: string;
  tab_customers: string;
  tab_settings: string;

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

  // Appearance
  appearance_title: string;
  appearance_desc: string;
  theme_system: string;
  theme_system_desc: string;
  theme_light: string;
  theme_light_desc: string;
  theme_dark: string;
  theme_dark_desc: string;

  // Onboarding & Business Setup
  welcome_title: string;
  welcome_subtitle: string;
  setup_step_lang: string;
  setup_step_biz: string;
  setup_step_review: string;
  setup_biz_name_hint: string;
  setup_currency_notice: string;
  setup_complete_button: string;
  setup_saving: string;

  // Getting-Started Guide
  guide_title: string;
  guide_slide1_title: string;
  guide_slide1_body: string;
  guide_slide2_title: string;
  guide_slide2_body: string;
  guide_slide3_title: string;
  guide_slide3_body: string;
  guide_action_skip: string;
  guide_action_next: string;
  guide_action_prev: string;
  guide_action_finish: string;
  settings_help_title: string;
  settings_help_desc: string;
  settings_view_guide: string;

  // Backup & Restore
  backup_restore_title: string;
  backup_restore_desc: string;
  backup_export_btn: string;
  backup_export_desc: string;
  backup_restore_btn: string;
  backup_restore_btn_desc: string;
  backup_restoring: string;
  backup_exporting: string;
  backup_modal_title: string;
  backup_modal_warning: string;
  backup_modal_cancel: string;
  backup_modal_confirm: string;

  // Dashboard & Reports
  tab_dashboard: string;
  tab_reports: string;
  today_summary: string;
  this_month_summary: string;
  this_year_summary: string;
  custom_period_summary: string;
  money_received: string;
  money_paid: string;
  net_change: string;
  closing_balance: string;
  opening_balance: string;
  simple_view: string;
  analytics_view: string;
  recent_transactions: string;
  view_all: string;
  cash_breakdown: string;
  cash_movement_explainer: string;
  btn_add_receipt: string;
  btn_add_payment: string;
  cash_flow_notice: string;
  period_today: string;
  period_month: string;
  period_year: string;
  period_custom: string;
  all_accounts: string;
  no_transactions_period: string;
  inflows_outflows: string;
  spending_by_category: string;
  analytics_helper_notice: string;
  inflow_legend: string;
  outflow_legend: string;
  // Dashboard correctness pass — additional keys
  transactions_count: string;
  clear_selection: string;
  chart_net_label: string;
  no_active_accounts: string;
  total_receipts_in_period: string;
  total_payments_in_period: string;
  receipts_minus_payments: string;
  at_end_of_period: string;
  cash_flow_subtitle: string;
  cash_receipt_default: string;
  cash_payment_default: string;
  chart_comparison_subtitle: string;
  category_expenses_subtitle: string;
  no_expenses_period: string;
  account_filtered_label: string;
  balance_loading: string;
  balance_error_retry: string;
  report_title: string;
  report_subtitle: string;
  btn_print_pdf: string;
  btn_export_csv: string;
  search_transactions_hint: string;
  filter_direction_all: string;
  filter_direction_inflow: string;
  filter_direction_outflow: string;
  filter_payment_method_all: string;
  matching_label: string;
  th_date: string;
  th_voucher_name: string;
  th_category: string;
  th_account: string;
  th_inflow: string;
  th_outflow: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    nav_more: 'More',
    nav_more_title: 'All sections',
    tab_cashbook: 'Cashbook',
    tab_products: 'Products',
    tab_customers: 'Customers',
    tab_settings: 'Settings',

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
    msg_product_saved: 'Product saved successfully.',
    msg_customer_saved: 'Customer saved successfully.',
    msg_archived: 'Item archived.',
    msg_restored: 'Item restored to active list.',

    // Appearance
    appearance_title: 'Appearance',
    appearance_desc: 'Customize the visual theme of the application.',
    theme_system: 'System',
    theme_system_desc: 'Follows your operating system appearance automatically.',
    theme_light: 'Light',
    theme_light_desc: 'Clean light surfaces with crisp contrast.',
    theme_dark: 'Dark',
    theme_dark_desc: 'Dark surfaces designed for low-light environments.',

    // Onboarding & Business Setup
    welcome_title: 'Welcome to BillZen',
    welcome_subtitle: 'Offline Point-of-Sale, Inventory Ledger & Financial Accounting',
    setup_step_lang: 'Language & Regional Presets',
    setup_step_biz: 'Business Information',
    setup_step_review: 'Review & Confirm',
    setup_biz_name_hint: 'Enter your business, shop, or trading name',
    setup_currency_notice: 'Important: Base currency cannot be altered after items or transactions exist.',
    setup_complete_button: 'Complete Setup & Open Store',
    setup_saving: 'Saving business configuration...',

    // Getting-Started Guide
    guide_title: 'BillZen Quick Start Guide',
    guide_slide1_title: '1. Products, Barcodes & Inventory',
    guide_slide1_body: 'Add products with unique SKUs and barcodes. BillZen preserves leading zeros and tracks exact integer stock ledger movements atomically.',
    guide_slide2_title: '2. Customer Directory & Profiles',
    guide_slide2_body: 'Maintain retail and wholesale customer profiles, contact numbers, addresses, and statutory tax identifiers (GSTIN/TRN).',
    guide_slide3_title: '3. Local Durability & Appearance',
    guide_slide3_body: 'All business data is saved locally in SQLite with single-instance protection. Select System, Light, or Dark mode in Settings.',
    guide_action_skip: 'Skip Guide',
    guide_action_next: 'Next',
    guide_action_prev: 'Back',
    guide_action_finish: 'Get Started',
    settings_help_title: 'Help & Getting Started',
    settings_help_desc: 'Review features, shortcuts, and documentation.',
    settings_view_guide: 'View Getting-Started Guide',

    // Backup & Restore
    backup_restore_title: 'Backup & Restore',
    backup_restore_desc: 'Export complete workspace archives or safely restore previous backups with cryptographic verification.',
    backup_export_btn: 'Export Workspace Backup',
    backup_export_desc: 'Generates a versioned 1.0 JSON backup with SHA-256 integrity envelope covering settings, catalog, and cashbook.',
    backup_restore_btn: 'Restore from Backup',
    backup_restore_btn_desc: 'Select a valid BillZen backup JSON archive to replace current workspace data. An automatic recovery copy is preserved.',
    backup_restoring: 'Restoring Workspace...',
    backup_exporting: 'Exporting...',
    backup_modal_title: 'Confirm Workspace Restore',
    backup_modal_warning: 'Warning: Restoring this backup will replace current business data with the backup dataset. An automatic recovery copy of your current database will be saved.',
    backup_modal_cancel: 'Cancel',
    backup_modal_confirm: 'Confirm & Restore',

    // Dashboard & Reports
    tab_dashboard: 'Dashboard',
    tab_reports: 'Reports',
    today_summary: "Today's Summary",
    this_month_summary: "This Month's Summary",
    this_year_summary: "This Year's Summary",
    custom_period_summary: 'Custom Period Summary',
    money_received: 'Money Received',
    money_paid: 'Money Paid',
    net_change: 'Net Cash Change',
    closing_balance: 'Closing Balance',
    opening_balance: 'Opening Balance',
    simple_view: 'Simple View',
    analytics_view: 'Detailed Analytics',
    recent_transactions: 'Recent Transactions',
    view_all: 'View All ↗',
    cash_breakdown: 'Account Balances',
    cash_movement_explainer: 'Cash Movement Explanation',
    btn_add_receipt: '＋ Add Receipt',
    btn_add_payment: '＋ Add Payment',
    cash_flow_notice: 'Receipts − Payments = Net cash change. This is not business profit.',
    period_today: 'Today',
    period_month: 'This Month',
    period_year: 'This Year',
    period_custom: 'Custom Range',
    all_accounts: 'All Accounts',
    no_transactions_period: 'No transactions in this period.',
    inflows_outflows: 'Receipts vs Payments',
    spending_by_category: 'Spending by Category',
    analytics_helper_notice: 'Loans and capital injections are classified separately and never treated as sales revenue or business profit.',
    inflow_legend: 'Receipts',
    outflow_legend: 'Payments',
    transactions_count: 'transactions',
    clear_selection: 'Clear selection',
    chart_net_label: 'Net',
    no_active_accounts: 'No active accounts configured',
    total_receipts_in_period: 'Total receipts in period',
    total_payments_in_period: 'Total payments in period',
    receipts_minus_payments: 'Receipts − Payments',
    at_end_of_period: 'At end of selected period',
    cash_flow_subtitle: 'Breakdown of cash flow in selected period',
    cash_receipt_default: 'Cash Receipt',
    cash_payment_default: 'Cash Payment',
    chart_comparison_subtitle: 'Comparison of inflows and outflows',
    category_expenses_subtitle: 'Outflows distributed by category',
    no_expenses_period: 'No expenses in this period',
    account_filtered_label: 'filtered',
    balance_loading: 'Loading…',
    balance_error_retry: 'Failed to load. Retry',
    report_title: 'Transaction Reports',
    report_subtitle: 'Review by date range, account, and counterparty',
    btn_print_pdf: 'Print / Save PDF',
    btn_export_csv: 'Export CSV',
    search_transactions_hint: 'Search name, voucher #, notes...',
    filter_direction_all: 'All Transactions',
    filter_direction_inflow: 'Receipts Only',
    filter_direction_outflow: 'Payments Only',
    filter_payment_method_all: 'All Payment Methods',
    matching_label: 'Filtered',
    th_date: 'Date',
    th_voucher_name: 'Voucher / Name',
    th_category: 'Category',
    th_account: 'Account',
    th_inflow: 'Receipt (+)',
    th_outflow: 'Payment (−)',
  },
  ml: {
    nav_more: 'കൂടുതൽ',
    nav_more_title: 'എല്ലാ വിഭാഗങ്ങളും',
    tab_cashbook: 'ക്യാഷ്ബുക്ക്',
    tab_products: 'ഉൽപന്നങ്ങൾ',
    tab_customers: 'ഉപഭോക്താക്കൾ',
    tab_settings: 'ക്രമീകരണങ്ങൾ',

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

    // Appearance
    appearance_title: 'തീം / രൂപം',
    appearance_desc: 'ആപ്ലിക്കേഷന്റെ തീം തിരഞ്ഞെടുക്കുക.',
    theme_system: 'സിസ്റ്റം',
    theme_system_desc: 'ഫോണിന്റെ അല്ലെങ്കിൽ കമ്പ്യൂട്ടറിന്റെ തീം അനുസരിച്ച് പ്രവർത്തിക്കുന്നു.',
    theme_light: 'ലൈറ്റ്',
    theme_light_desc: 'വ്യക്തമായ വെളുത്ത പശ്ചാത്തലം.',
    theme_dark: 'ഡാർക്ക്',
    theme_dark_desc: 'കണ്ണുകൾക്ക് ആശ്വാസം നൽകുന്ന ഇരുണ്ട പശ്ചാത്തലം.',

    // Onboarding & Business Setup
    welcome_title: 'ബിൽസെനിലേക്ക് സ്വാഗതം',
    welcome_subtitle: 'ഓഫ്‌ലൈൻ ബില്ലിംഗ്, ഇൻവെന്ററി, കണക്കുകൾ',
    setup_step_lang: 'ഭാഷയും മേഖലയും',
    setup_step_biz: 'സ്ഥാപനത്തിന്റെ വിവരങ്ങൾ',
    setup_step_review: 'സ്ഥിരീകരിക്കുക',
    setup_biz_name_hint: 'സ്ഥാപനത്തിന്റെ അല്ലെങ്കിൽ കടയുടെ പേര് നൽകുക',
    setup_currency_notice: 'ശ്രദ്ധിക്കുക: ഉൽപന്നങ്ങളോ ഇടപാടുകളോ ചേർത്തുകഴിഞ്ഞാൽ അടിസ്ഥാന കറൻസി മാറ്റാനാകില്ല.',
    setup_complete_button: 'സജ്ജീകരണം പൂർത്തിയാക്കി തുറക്കുക',
    setup_saving: 'വിവരങ്ങൾ സൂക്ഷിക്കുന്നു...',

    // Getting-Started Guide
    guide_title: 'തുടക്കക്കാർക്കുള്ള സഹായം',
    guide_slide1_title: '1. ഉൽപന്നങ്ങളും ബാർകോഡും സ്റ്റോക്കും',
    guide_slide1_body: 'SKU, ബാർകോഡ് എന്നിവ നൽകി ഉൽപന്നങ്ങൾ ചേർക്കാം. ബാർകോഡിലെ പൂജ്യങ്ങൾ നഷ്ടപ്പെടാതെ സൂക്ഷിക്കുകയും സ്റ്റോക്ക് കണക്കുകൾ കൃത്യമായി രേഖപ്പെടുത്തുകയും ചെയ്യുന്നു.',
    guide_slide2_title: '2. ഉപഭോക്തൃ വിവരങ്ങളും പ്രൊഫൈലുകളും',
    guide_slide2_body: 'ഉപഭോക്താക്കളുടെ വിവരങ്ങൾ, വിലാസം, ഫോൺ നമ്പർ, നികുതി നമ്പർ (GSTIN/TRN) എന്നിവ കൃത്യമായി സൂക്ഷിക്കാം.',
    guide_slide3_title: '3. ഓഫ്‌ലൈൻ സുരക്ഷയും തീമും',
    guide_slide3_body: 'എല്ലാ വിവരങ്ങളും നിങ്ങളുടെ ഉപകരണത്തിൽ മാത്രം സുരക്ഷിതമായി സൂക്ഷിക്കുന്നു. ക്രമീകരണങ്ങളിൽ സിസ്റ്റം, ലൈറ്റ്, ഡാർക്ക് മോഡുകൾ തിരഞ്ഞെടുക്കാം.',
    guide_action_skip: 'ഒഴിവാക്കുക',
    guide_action_next: 'അടുത്തത്',
    guide_action_prev: 'പിന്നോട്ട്',
    guide_action_finish: 'ആരംഭിക്കുക',
    settings_help_title: 'സഹായവും മാർഗ്ഗനിർദ്ദേശങ്ങളും',
    settings_help_desc: 'സവിശേഷതകളും ഉപയോഗ ക്രമങ്ങളും മനസ്സിലാക്കാം.',
    settings_view_guide: 'മാർഗ്ഗനിർദ്ദേശം കാണുക',

    // Backup & Restore
    backup_restore_title: 'ബാക്കപ്പും പുനഃസ്ഥാപനവും',
    backup_restore_desc: 'മുഴുവൻ വർക്ക്‌സ്‌പേസ് ഡാറ്റയും സുരക്ഷിതമായി ഫയലിലേക്ക് ബാക്കപ്പ് ചെയ്യുകയോ പുനഃസ്ഥാപിക്കുകയോ ചെയ്യുക.',
    backup_export_btn: 'ബാക്കപ്പ് ഡൗൺലോഡ് ചെയ്യുക',
    backup_export_desc: 'ക്രമീകരണങ്ങൾ, കാറ്റലോഗ്, ക്യാഷ്ബുക്ക് എന്നിവ ഉൾക്കൊള്ളുന്ന സുരക്ഷിതമായ SHA-256 JSON ഫയൽ നിർമ്മിക്കുന്നു.',
    backup_restore_btn: 'ഫയലിൽ നിന്ന് പുനഃസ്ഥാപിക്കുക',
    backup_restore_btn_desc: 'മുൻപ് എടുത്ത BillZen ബാക്കപ്പ് ഫയൽ തിരഞ്ഞെടുക്കുക. നിലവിലെ ഡാറ്റയുടെ റിക്കവറി കോപ്പി സ്വയമേവ സൂക്ഷിക്കുന്നതാണ്.',
    backup_restoring: 'ഡാറ്റ പുനഃസ്ഥാപിക്കുന്നു...',
    backup_exporting: 'ബാക്കപ്പ് തയ്യാറാക്കുന്നു...',
    backup_modal_title: 'വർക്ക്‌സ്‌പേസ് പുനഃസ്ഥാപനം സ്ഥിരീകരിക്കുക',
    backup_modal_warning: 'മുന്നറിയിപ്പ്: ബാക്കപ്പ് പുനഃസ്ഥാപിച്ചാൽ നിലവിലെ ഡാറ്റ ബാക്കപ്പിലെ വിവരങ്ങൾ ഉപയോഗിച്ച് മാറ്റിസ്ഥാപിക്കപ്പെടും. എന്നാൽ നിലവിലെ ഡാറ്റയുടെ ഒരു റിക്കവറി കോപ്പി സ്വയമേവ സൂക്ഷിക്കുന്നതാണ്.',
    backup_modal_cancel: 'റദ്ദാക്കുക',
    backup_modal_confirm: 'സ്ഥിരീകരിച്ച് പുനഃസ്ഥാപിക്കുക',

    // Dashboard & Reports
    tab_dashboard: 'ഡാഷ്‌ബോർഡ്',
    tab_reports: 'റിപ്പോർട്ടുകൾ',
    today_summary: 'ഇന്നത്തെ കണക്ക്',
    this_month_summary: 'ഈ മാസത്തെ കണക്ക്',
    this_year_summary: 'ഈ വർഷത്തെ കണക്ക്',
    custom_period_summary: 'തിരഞ്ഞെടുത്ത ദിവസങ്ങളിലെ കണക്ക്',
    money_received: 'വന്ന പണം',
    money_paid: 'പോയ പണം',
    net_change: 'പണത്തിലെ മാറ്റം',
    closing_balance: 'ബാക്കി പണം',
    opening_balance: 'ആരംഭത്തിലെ പണം',
    simple_view: 'ലളിതമായ കാഴ്ച',
    analytics_view: 'വിശദമായ വിശകലനം',
    recent_transactions: 'അവസാന ഇടപാടുകൾ',
    view_all: 'എല്ലാം കാണുക ↗',
    cash_breakdown: 'അക്കൗണ്ട് വിവരങ്ങൾ',
    cash_movement_explainer: 'പണത്തിന്റെ കണക്ക്',
    btn_add_receipt: '＋ വരവ് ചേർക്കുക',
    btn_add_payment: '＋ ചെലവ് ചേർക്കുക',
    cash_flow_notice: 'വരവ് − ചെലവ് = പണത്തിലെ മാറ്റം. ഇത് ബിസിനസിന്റെ ലാഭം എന്നർത്ഥമല്ല.',
    period_today: 'ഇന്ന്',
    period_month: 'ഈ മാസം',
    period_year: 'ഈ വർഷം',
    period_custom: 'മറ്റൊരു തീയതി',
    all_accounts: 'എല്ലാ അക്കൗണ്ടുകളും',
    no_transactions_period: 'ഈ കാലയളവിൽ ഇടപാടുകളില്ല.',
    inflows_outflows: 'വരവും ചെലവും',
    spending_by_category: 'പണം എവിടെയാണ് ചെലവായത്?',
    analytics_helper_notice: 'വായ്പയും ഉടമ ചേർത്ത പണവും വരവിൽ ഉൾപ്പെടാം. അവയെ വിൽപ്പനയോ ലാഭമോ ആയി കാണിക്കില്ല.',
    inflow_legend: 'വരവ്',
    outflow_legend: 'ചെലവ്',
    transactions_count: 'ഇടപാടുകൾ',
    clear_selection: 'തിരഞ്ഞെടുത്തത് മാറ്റുക',
    chart_net_label: 'ബാക്കി',
    no_active_accounts: 'സജീവമായ അക്കൗണ്ടുകൾ ലഭ്യമല്ല',
    total_receipts_in_period: 'വരവായി രേഖപ്പെടുത്തിയ തുക',
    total_payments_in_period: 'ചെലവായി രേഖപ്പെടുത്തിയ തുക',
    receipts_minus_payments: 'വരവ് − ചെലവ്',
    at_end_of_period: 'ഈ കാലയളവിന്റെ അവസാനം',
    cash_flow_subtitle: 'ഈ കാലയളവിലെ മാറ്റം എളുപ്പത്തിൽ',
    cash_receipt_default: 'വരവ് രസീത്',
    cash_payment_default: 'ചെലവ് രസീത്',
    chart_comparison_subtitle: 'തിരഞ്ഞെടുത്ത കാലയളവിലെ cash flow',
    category_expenses_subtitle: 'Category അനുസരിച്ചുള്ള തുക',
    no_expenses_period: 'ഈ കാലയളവിൽ ചെലവുകളില്ല',
    account_filtered_label: 'തിരഞ്ഞെടുത്തത്',
    balance_loading: 'കണക്കാക്കുന്നു…',
    balance_error_retry: 'ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക',
    report_title: 'ഇടപാടുകളുടെ റിപ്പോർട്ട്',
    report_subtitle: 'തീയതി, account, വിശദാംശങ്ങൾ അനുസരിച്ച് പരിശോധിക്കുക',
    btn_print_pdf: 'Print / Save PDF',
    btn_export_csv: 'Export CSV',
    search_transactions_hint: 'പേര് / receipt no. തിരയുക…',
    filter_direction_all: 'വരവും ചെലവും',
    filter_direction_inflow: 'വരവ് മാത്രം',
    filter_direction_outflow: 'ചെലവ് മാത്രം',
    filter_payment_method_all: 'എല്ലാ payment രീതികളും',
    matching_label: 'Filter-ൽ ലഭിച്ചത്',
    th_date: 'തീയതി',
    th_voucher_name: 'വൗച്ചർ / പേര്',
    th_category: 'Category',
    th_account: 'Account',
    th_inflow: 'വരവ്',
    th_outflow: 'ചെലവ്',
  },
  ar: {
    nav_more: 'المزيد',
    nav_more_title: 'جميع الأقسام',
    tab_cashbook: 'دفتر النقدية',
    tab_products: 'المنتجات',
    tab_customers: 'العملاء',
    tab_settings: 'الإعدادات',

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

    // Appearance
    appearance_title: 'المظهر',
    appearance_desc: 'تخصيص المظهر المرئي للتطبيق.',
    theme_system: 'تلقائي (النظام)',
    theme_system_desc: 'يتطابق تلقائياً مع مظهر نظام التشغيل.',
    theme_light: 'فاتح',
    theme_light_desc: 'مظهر فاتح ناصع مع تباين واضح.',
    theme_dark: 'داكن',
    theme_dark_desc: 'مظهر داكن مصمم للإضاءة المنخفضة.',

    // Onboarding & Business Setup
    welcome_title: 'مرحباً بك في بيل زن',
    welcome_subtitle: 'نظام فواتير ومخزون ومحاسبة مالية بدون إنترنت',
    setup_step_lang: 'اللغة والإعدادات الإقليمية',
    setup_step_biz: 'بيانات المؤسسة',
    setup_step_review: 'مراجعة وتأكيد',
    setup_biz_name_hint: 'أدخل الاسم التجاري للمؤسسة أو المتجر',
    setup_currency_notice: 'تنبيه: لا يمكن تغيير العملة الأساسية بعد إنشاء منتجات أو معاملات.',
    setup_complete_button: 'إكمال الإعداد والبدء',
    setup_saving: 'جاري حفظ الإعدادات...',

    // Getting-Started Guide
    guide_title: 'دليل البدء السريع',
    guide_slide1_title: '1. المنتجات والباركود والمخزون',
    guide_slide1_body: 'أضف المنتجات برموز صنف وباركود فريدة. يحافظ بيل زن على الأصفار الأولى في الباركود ويتتبع حركة المخزون بدقة.',
    guide_slide2_title: '2. دليل العملاء والملفات التعريفية',
    guide_slide2_body: 'إدارة سجلات العملاء وبيانات الاتصال والعناوين والأرقام الضريبية الرسمية (الرقم الضريبي/TRN).',
    guide_slide3_title: '3. التخزين المحلي والمظهر',
    guide_slide3_body: 'جميع البيانات محفوظة محلياً في قاعدة SQLite مع حماية التشغيل الأحادي. اختر بين الوضع الفاتح أو الداكن من الإعدادات.',
    guide_action_skip: 'تخطي الدليل',
    guide_action_next: 'التالي',
    guide_action_prev: 'السابق',
    guide_action_finish: 'ابدأ الآن',
    settings_help_title: 'المساعدة ودليل البدء',
    settings_help_desc: 'مراجعة الميزات والاختصارات والدليل الإرشادي.',
    settings_view_guide: 'عرض دليل البدء',

    // Backup & Restore
    backup_restore_title: 'النسخ الاحتياطي والاستعادة',
    backup_restore_desc: 'تصدير أرشيف مساحة العمل بالكامل أو استعادة نسخ احتياطية سابقة بأمان مع التحقق المشفر.',
    backup_export_btn: 'تصدير نسخة احتياطية',
    backup_export_desc: 'ينشئ نسخة احتياطية بصيغة JSON 1.0 مع تجزئة تكامل SHA-256 تغطي كافة البيانات.',
    backup_restore_btn: 'استعادة من ملف',
    backup_restore_btn_desc: 'حدد ملف نسخة احتياطية لاستبدال البيانات الحالية. يتم حفظ نسخة استرداد احتياطية تلقائياً.',
    backup_restoring: 'جاري استعادة البيانات...',
    backup_exporting: 'جاري التصدير...',
    backup_modal_title: 'تأكيد استعادة مساحة العمل',
    backup_modal_warning: 'تحذير: استعادة هذه النسخة الاحتياطية سيستبدل البيانات الحالية بالكامل. سيتم حفظ نسخة استرداد احتياطية تلقائياً من قاعدة بياناتك الحالية.',
    backup_modal_cancel: 'إلغاء',
    backup_modal_confirm: 'تأكيد والاستعادة',

    // Dashboard & Reports
    tab_dashboard: 'لوحة التحكم',
    tab_reports: 'التقارير',
    today_summary: 'ملخص اليوم',
    this_month_summary: 'ملخص هذا الشهر',
    this_year_summary: 'ملخص هذا العام',
    custom_period_summary: 'ملخص الفترة المحددة',
    money_received: 'المقبوضات',
    money_paid: 'المدفوعات',
    net_change: 'صافي التغير النقدي',
    closing_balance: 'الرصيد الختامي',
    opening_balance: 'الرصيد الافتتاحي',
    simple_view: 'عرض بسيط',
    analytics_view: 'تحليل مفصل',
    recent_transactions: 'أحدث المعاملات',
    view_all: 'عرض الكل ↗',
    cash_breakdown: 'أرصدة الحسابات',
    cash_movement_explainer: 'حركة النقد',
    btn_add_receipt: '＋ إضافة قبض',
    btn_add_payment: '＋ إضافة صرف',
    cash_flow_notice: 'المقبوضات - المدفوعات = صافي التدفق النقدي. هذا لا يعبر عن أرباح المنشأة.',
    period_today: 'اليوم',
    period_month: 'هذا الشهر',
    period_year: 'هذا العام',
    period_custom: 'فترة مخصصة',
    all_accounts: 'جميع الحسابات',
    no_transactions_period: 'لا توجد معاملات في هذه الفترة.',
    inflows_outflows: 'المقبوضات والمدفوعات',
    spending_by_category: 'المصروفات حسب التصنيف',
    analytics_helper_notice: 'قد تشمل المقبوضات القروض ورأس المال المودع. ولا تظهر كأرباح أو مبيعات.',
    inflow_legend: 'المقبوضات',
    outflow_legend: 'المدفوعات',
    transactions_count: 'معاملة',
    clear_selection: 'إلغاء التحديد',
    chart_net_label: 'الصافي',
    no_active_accounts: 'لا توجد حسابات نشطة مهيأة',
    total_receipts_in_period: 'إجمالي المقبوضات في الفترة',
    total_payments_in_period: 'إجمالي المدفوعات في الفترة',
    receipts_minus_payments: 'المقبوضات - المدفوعات',
    at_end_of_period: 'الرصيد في نهاية الفترة المحددة',
    cash_flow_subtitle: 'تفاصيل حركة النقد لهذه الفترة',
    cash_receipt_default: 'سند قبض نقدي',
    cash_payment_default: 'سند صرف نقدي',
    chart_comparison_subtitle: 'مقارنة المقبوضات والمدفوعات',
    category_expenses_subtitle: 'المصروفات موزعة حسب البند',
    no_expenses_period: 'لا توجد مصروفات في هذه الفترة',
    account_filtered_label: 'محدد',
    balance_loading: 'جار التحميل...',
    balance_error_retry: 'فشل التحميل. إعادة المحاولة',
    report_title: 'تقرير المعاملات',
    report_subtitle: 'مراجعة حسب التاريخ، الحساب، والتفاصيل',
    btn_print_pdf: 'طباعة / حفظ PDF',
    btn_export_csv: 'تصدير CSV',
    search_transactions_hint: 'البحث بالاسم / رقم السند...',
    filter_direction_all: 'الكل',
    filter_direction_inflow: 'مقبوضات فقط',
    filter_direction_outflow: 'مدفوعات فقط',
    filter_payment_method_all: 'جميع طرق الدفع',
    matching_label: 'المطابقة في التصفية',
    th_date: 'التاريخ',
    th_voucher_name: 'السند / الاسم',
    th_category: 'التصنيف',
    th_account: 'الحساب',
    th_inflow: 'المقبوضات',
    th_outflow: 'المدفوعات',
  },
};
