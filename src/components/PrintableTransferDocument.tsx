import type { TransferPrintData } from '../types/transfers';
import type { Language } from '../i18n';
import { transferText } from '../i18n/transfers';
import { formatMinorUnits } from '../domain/financial';

export function PrintableTransferDocument({data, language = 'en', isPrintTarget = false}: {
 data: TransferPrintData; language?: Language; isPrintTarget?: boolean;
}) {
 const t = (key: Parameters<typeof transferText>[1]) => transferText(language, key);
 const {transfer: h, outVoucher: out, inVoucher: into} = data;
 return <article id={isPrintTarget ? 'printable-transfer-root' : undefined} dir={language === 'ar' ? 'rtl' : 'ltr'}
   className="bg-white text-black p-5 sm:p-8 print:p-0 max-w-[210mm] mx-auto text-sm break-words" style={{overflowWrap:'anywhere'}}>
  <div className="border-b-2 border-black pb-5 mb-5 flex flex-wrap justify-between gap-4">
   <div><img src="/brand/billzen-icon.svg" alt="BillZen" className="w-10 h-10 mb-2"/>
    <h1 className="text-xl font-bold">{out.business_name_snap}</h1>
    <p className="whitespace-pre-line">{out.business_address_snap}</p><p>{out.business_tax_id_snap}</p><p>{out.business_phone_snap}</p></div>
   <div><h2 className="text-lg font-bold">{t('detail')}</h2><p><bdi>{h.transfer_number}</bdi></p><p>{h.business_date}</p>
    <strong>{h.is_reversed ? t('reversed') : h.is_reversal ? t('reversal') : t('posted')}</strong></div>
  </div>
  <table className="border-collapse border border-black my-5" style={{width:'calc(100% - 2px)',tableLayout:'fixed'}}><tbody>
   <tr><th className="border border-black p-3 text-start">{t('from')}</th><td className="border border-black p-3">{out.account_name_snap}</td></tr>
   <tr><th className="border border-black p-3 text-start">{t('to')}</th><td className="border border-black p-3">{into.account_name_snap}</td></tr>
   <tr><th className="border border-black p-3 text-start">{t('amount')}</th><td className="border border-black p-3 text-lg font-bold"><bdi>{h.currency_code_snap} {formatMinorUnits(h.amount_minor, h.currency_exponent_snap)}</bdi></td></tr>
  </tbody></table>
  {h.reference_note && <p className="whitespace-pre-wrap">{t('reference')}: {h.reference_note}</p>}
  {h.notes && <p className="whitespace-pre-wrap">{t('notes')}: {h.notes}</p>}
  {data.originalNumber && <p>{t('original')}: <bdi>{data.originalNumber}</bdi></p>}
  {data.reversalNumber && <p>{t('reverseNumber')}: <bdi>{data.reversalNumber}</bdi></p>}
  <div className="border-t border-black mt-8 pt-4 text-xs">{t('notice')}</div>
 </article>;
}
