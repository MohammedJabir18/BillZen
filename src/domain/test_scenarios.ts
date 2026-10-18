import type { InvoiceDTO } from '../types';
import { SAMPLE_TWO_LINE_INVOICE_DTO } from './invoice_view_model';

export const MULTIPAGE_INVOICE_DTO: InvoiceDTO = {
  invoice_number: 'INV-2026-MULTI',
  business_date: '18/10/2026',
  status: 'finalized',
  is_sample: true,
  business_name: 'BillZen Wholesale Distribution Centre',
  business_legal_name: 'BillZen Trading Private Limited',
  business_tax_id: '32AAAAA0000A1Z5',
  business_address: 'Plot 45, Industrial Development Area, Kalamassery, Kochi - 683109',
  business_phone: '+91 9876543210',
  customer_name: 'St. George Supermarket & Departmental Stores',
  customer_tax_id: '32BBBBB1111B1Z2',
  customer_address: 'Main Bazaar Road, Ernakulam, Kerala - 682011',
  currency_code: 'INR',
  currency_symbol: '₹',
  currency_exponent: 2,
  locale: 'en-IN',
  paid_amount_minor: 0,
  notes: 'Multi-page commercial invoice for wholesale shipment. Page headers must repeat cleanly.',
  items: Array.from({ length: 22 }, (_, i) => ({
    id: `multi-item-${i + 1}`,
    name: `Wholesale Commodity Batch #${i + 1} - Standard Grade`,
    name_malayalam: `മൊത്തവ്യാപാര ചരക്ക് ബാച്ച് #${i + 1}`,
    name_arabic: `دفعة السلع بالجملة #${i + 1}`,
    sku: `SKU-WHL-${(i + 1).toString().padStart(3, '0')}`,
    hsn: '2106.90',
    quantity_scaled: (i + 1) * 1000, // (i + 1) units
    unit: 'pk',
    unit_price_minor: 15000, // ₹150.00
    discount_minor: i % 2 === 0 ? 500 : 0, // ₹5.00 discount on even items
    tax_rate_bp: 1800, // 18% GST
  })),
};

export const KWD_THREE_DECIMAL_INVOICE_DTO: InvoiceDTO = {
  invoice_number: 'INV-KW-2026-001',
  business_date: '18/10/2026',
  status: 'finalized',
  is_sample: false,
  business_name: 'Kuwait Central General Trading & Contracting',
  business_legal_name: 'Kuwait Central Trading W.L.L.',
  business_tax_id: '310123456789003',
  business_address: 'Salem Al Mubarak Street, Salmiya, Block 4, Kuwait',
  business_phone: '+965 22000000',
  customer_name: 'Al-Sabah Trading & Hospitality Group',
  customer_tax_id: '310987654321003',
  customer_address: 'Arabian Gulf Street, Kuwait City, Kuwait',
  currency_code: 'KWD',
  currency_symbol: 'KD ',
  currency_exponent: 3,
  locale: 'en-KW',
  paid_amount_minor: 3281,
  notes: 'GCC 3-decimal tax invoice with VAT and Arabic description.',
  items: [
    {
      id: 'kwd-item-1',
      name: 'Cardamom Extra Bold Grade A (ഹരിത ഏലം)',
      name_malayalam: 'പ്രീമിയം ഗ്രേഡ് എ ഹരിത ഏലം',
      name_arabic: 'هيل ممتاز درجة أولى حبة عريضة',
      sku: 'SKU-KWD-CARD-01',
      hsn: '0908.31',
      quantity_scaled: 1500, // 1.500 kg
      unit: 'kg',
      unit_price_minor: 2250, // 2.250 KD
      discount_minor: 250, // 0.250 KD
      tax_rate_bp: 500, // 5% VAT (500 bp)
    },
  ],
};

export const LONG_CONTENT_INVOICE_DTO: InvoiceDTO = {
  invoice_number: 'INV-LONG-2026-9999',
  business_date: '18/10/2026',
  status: 'finalized',
  is_sample: true,
  business_name: 'International Trading & Commercial Corporation of Specialised Industrial Commodities & Technical Instrumentation Services',
  business_legal_name: 'International Trading & Commercial Corporation Liability Partnership Incorporated',
  business_tax_id: '32AAAAAAAAAAAAZ9',
  business_address: 'Building 14-B, Technopark Phase III Campus, Special Economic Zone Industrial Corridor, Attipra Village, Thiruvananthapuram, Kerala - 695583, Republic of India',
  business_phone: '+91 471 2700000 / +91 9876543210',
  customer_name: 'South Asian Trans-Regional Infrastructure Development Corporation & Heavy Machinery Engineering Consortium',
  customer_tax_id: '32BBBBBBBBBBBBZ1',
  customer_address: 'Suite 902, Tower C, International Financial Technology Centre, Knowledge City Expressway, Cyber Hills, Hyderabad, Telangana - 500081, India',
  currency_code: 'INR',
  currency_symbol: '₹',
  currency_exponent: 2,
  locale: 'en-IN',
  paid_amount_minor: 1250000,
  notes: 'Long content stress test verifying that multi-line text wraps gracefully without overlapping table cells or page boundaries.',
  items: [
    {
      id: 'long-item-1',
      name: 'High-Precision Automated Digital Multimeter with Integrated Thermal Imaging, Bluetooth Telemetry Logging Module and Calibrated Traceability Certificate',
      name_malayalam: 'തെർമൽ ഇമേജിംഗും ബ്ലൂടൂത്ത് ഡാറ്റാ ലോഗിംഗും ഉൾക്കൊള്ളുന്ന അതീവ കൃത്യതയുള്ള ഡിജിറ്റൽ മൾട്ടിമീറ്റർ ഉപകരണ സംവിധാനം',
      name_arabic: 'جهاز قياس متعدد رقمي عالي الدقة مع تصوير حراري مدمج ووحدة تسجيل عن بعد ومعايرة معتمدة',
      sku: 'SKU-INSTRUMENT-LONG-ALPHA-999',
      hsn: '9030.31.00',
      quantity_scaled: 5000, // 5.000 units
      unit: 'units',
      unit_price_minor: 250000, // ₹2,500.00
      discount_minor: 10000, // ₹100.00
      tax_rate_bp: 1800, // 18% GST
    },
  ],
};

export function getInvoiceForScenario(scenario: string | null): InvoiceDTO {
  switch (scenario) {
    case 'multipage':
      return MULTIPAGE_INVOICE_DTO;
    case 'kwd_3decimal':
      return KWD_THREE_DECIMAL_INVOICE_DTO;
    case 'long_text':
      return LONG_CONTENT_INVOICE_DTO;
    default:
      return SAMPLE_TWO_LINE_INVOICE_DTO;
  }
}
