import {useEffect, useRef, useState, type FormEvent} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeftRight, X} from 'lucide-react';
import {CashbookDialog} from './CashbookDialog';
import {PrintableTransferDocument} from './PrintableTransferDocument';
import {useBackHandler} from '../hooks/useBackHandler';
import {getCashbookTransfers, postCashbookTransfer, reverseCashbookTransfer} from '../adapters/transfers';
import {generateIdempotencyKey, getCashbookLedger} from '../adapters/cashbook';
import {getTodayBusinessDate, parseToMinorUnits, formatMinorUnits} from '../domain/financial';
import {normalizeTransferIntent} from '../domain/transfers';
import {preparePrintStyles, cleanupPrintStyles} from '../utils/print';
import {transferText} from '../i18n/transfers';
import type {Language} from '../i18n';
import type {ActivePrintDocument, BusinessSettings} from '../types';
import type {CashbookVoucher, MoneyAccount} from '../types/cashbook';
import type {CreateTransferInput, TransferResult, TransferPrintData} from '../types/transfers';

const overlay='fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-6';
const panel='bg-surface border border-border-subtle rounded-2xl shadow-xl w-full max-w-xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 space-y-4 text-text-main';
const field='w-full min-w-0 bg-surface-subtle text-text-main border border-border-subtle rounded-lg p-3';
const button='px-4 py-2.5 min-h-11 rounded-lg border border-border-subtle text-sm font-semibold disabled:opacity-50';
type Props={settings:BusinessSettings;language:Language;accounts:MoneyAccount[];selectedVoucher:CashbookVoucher|null;onCloseDetail:()=>void;onSetActivePrintDocument?:(doc:ActivePrintDocument)=>void};
export function TransferControls({settings,language,accounts,selectedVoucher,onCloseDetail,onSetActivePrintDocument}:Props){
 const t=(key:Parameters<typeof transferText>[1])=>transferText(language,key);
 const client=useQueryClient();
 const [open,setOpen]=useState(false),[from,setFrom]=useState(''),[to,setTo]=useState(''),[amount,setAmount]=useState('');
 const [date,setDate]=useState(getTodayBusinessDate(settings.timezone)),[reference,setReference]=useState(''),[notes,setNotes]=useState('');
 const [intent,setIntent]=useState<CreateTransferInput|null>(null),[attempted,setAttempted]=useState(false);
 const [warning,setWarning]=useState<Extract<TransferResult,{status:'requires_confirmation'}>|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[reverseConfirm,setReverseConfirm]=useState(false);
 const lock=useRef(false),requestKey=useRef(generateIdempotencyKey());
 const headers=useQuery({queryKey:['cashbook_transfers'],queryFn:()=>getCashbookTransfers()});
 const header=headers.data?.find(h=>h.out_voucher_id===selectedVoucher?.id||h.in_voucher_id===selectedVoucher?.id);
 const legs=useQuery({queryKey:['cashbook_ledger','transfer-document'],queryFn:()=>getCashbookLedger({classification:'transfer',include_archived:true}),enabled:Boolean(selectedVoucher)});
 const out=legs.data?.entries.find(e=>e.voucher.id===header?.out_voucher_id)?.voucher;
 const into=legs.data?.entries.find(e=>e.voucher.id===header?.in_voucher_id)?.voucher;
 const document:TransferPrintData|undefined=header&&out&&into?{transfer:header,outVoucher:out,inVoucher:into,
  originalNumber:headers.data?.find(h=>h.id===header.reversal_for_transfer_id)?.transfer_number,
  reversalNumber:headers.data?.find(h=>h.id===header.reversed_by_transfer_id)?.transfer_number}:undefined;
 const active=accounts.filter(a=>!a.is_archived&&a.currency_code===settings.currency_code&&a.currency_exponent===settings.currency_exponent);
 const money=(n:number)=>`${settings.currency_code} ${formatMinorUnits(n,settings.currency_exponent)}`;
 const close=()=>{if(lock.current)return;setOpen(false);setError('');};
 const closeDetail=()=>{if(lock.current)return;setReverseConfirm(false);setWarning(null);setError('');onCloseDetail();};
 useBackHandler(open,()=>{if(warning){setWarning(null);return;}close();});
 useBackHandler(Boolean(selectedVoucher),()=>{if(reverseConfirm&&!lock.current){setReverseConfirm(false);setWarning(null);return;}closeDetail();});
 useEffect(()=>{
  if(!document)return;
  onSetActivePrintDocument?.({type:'transfer',data:document,language,format:'a4'});preparePrintStyles('a4');
  return ()=>{onSetActivePrintDocument?.(null);cleanupPrintStyles();};
 },[header,out,into,language,onSetActivePrintDocument]);
 const invalidate=()=>{for(const key of ['cashbook_transfers','cashbook_accounts','money_accounts','cashbook_ledger','customer_cash_history'])void client.invalidateQueries({queryKey:[key]});};
 const review=(e:FormEvent)=>{
  e.preventDefault();setError('');
  try{
   const input:CreateTransferInput={idempotency_key:requestKey.current,from_account_id:from,to_account_id:to,amount_minor:parseToMinorUnits(amount,settings.currency_exponent),business_date:date,reference_note:reference,notes};
   normalizeTransferIntent(input);
   if(!active.some(a=>a.id===from)||!active.some(a=>a.id===to))throw Error(t('validation'));
   setIntent(input);
  }catch{setError(t('validation'));}
 };
 const submit=async(reversing:boolean,confirmed=false)=>{
  if(lock.current||(!reversing&&!intent)|| (reversing&&!header))return;
  lock.current=true;setBusy(true);if(!reversing)setAttempted(true);setError('');
  try{
   const result=reversing?await reverseCashbookTransfer({transfer_id:header!.id,confirmed_negative_balance:confirmed}):await postCashbookTransfer({...intent!,confirmed_negative_balance:confirmed});
   if(result.status==='requires_confirmation'){if(!reversing)setAttempted(false);setWarning(result);return;}
   setWarning(null);invalidate();setSuccess(`${t(reversing?'reversed':'success')}: ${result.transfer.transfer_number}`);
   if(reversing){setReverseConfirm(false);}else{
    setOpen(false);setIntent(null);setAttempted(false);setAmount('');setReference('');setNotes('');requestKey.current=generateIdempotencyKey();
   }
  }catch(e){setError(`${t('failed')} ${typeof e==='string'?e:e instanceof Error?e.message:''}`);}
  finally{lock.current=false;setBusy(false);}
 };
 const warningView=warning&&<div role="alert" className="p-4 rounded-lg border border-amber-500 bg-amber-500/10 space-y-2" data-testid="transfer-warning">
  <p>{t('negative')}</p><p>{t('current')}: <bdi>{money(warning.current_balance_minor)}</bdi></p><p>{t('projected')}: <bdi>{money(warning.projected_balance_minor)}</bdi></p><p className="text-sm">{t('recheck')}</p>
 </div>;
 return <>
  <button type="button" data-testid="action-transfer-money" onClick={()=>{setOpen(true);setSuccess('');if(!attempted){setFrom(active[0]?.id||'');setTo(active[1]?.id||'');setDate(getTodayBusinessDate(settings.timezone));}}}
   className={`${button} inline-flex justify-center items-center gap-2 bg-surface-subtle text-text-main`}><ArrowLeftRight className="w-4 h-4"/>{t('title')}</button>
  {success&&<p className="text-sm text-brand-emerald p-2 break-words" role="status">{success}</p>}
  {open&&<div className={overlay}><CashbookDialog label={t('title')} className={panel}>
   <div data-testid="transfer-entry" className="space-y-4">
    <div className="flex items-start justify-between gap-3"><h2 className="text-xl font-bold">{t('title')}</h2><button type="button" className={button} onClick={close} disabled={busy} aria-label={t('close')}><X className="w-4 h-4"/></button></div>
    <p className="text-sm text-text-muted">{t('notice')}</p>
    {error&&<p role="alert" className="text-brand-coral break-words">{error}</p>}
    {!intent?<form onSubmit={review} className="space-y-4">
     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{([[from,setFrom,'from'],[to,setTo,'to']] as const).map(([value,setter,key])=><label key={key} className="min-w-0 space-y-1 block">{t(key)}<select className={field} data-testid={`transfer-${key}`} value={value} onChange={e=>setter(e.target.value)} required><option value="">{t('choose')}</option>{active.map(a=><option key={a.id} value={a.id}>{a.account_name}</option>)}</select></label>)}</div>
     <label className="block space-y-1">{t('amount')} ({settings.currency_code})<input className={field} data-testid="transfer-amount" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} required/></label>
     <label className="block space-y-1">{t('date')}<input className={field} type="date" data-testid="transfer-date" value={date} onChange={e=>setDate(e.target.value)} required/></label>
     <label className="block space-y-1">{t('reference')}<input className={field} maxLength={500} value={reference} onChange={e=>setReference(e.target.value)}/></label>
     <label className="block space-y-1">{t('notes')}<textarea className={field} maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
     <button className={`${button} bg-brand-primary text-white w-full`} data-testid="transfer-preview">{t('preview')}</button>
    </form>:<div className="space-y-4">
     <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-subtle rounded-lg p-4 break-words">{([['from',accounts.find(a=>a.id===intent.from_account_id)?.account_name],['to',accounts.find(a=>a.id===intent.to_account_id)?.account_name],['amount',money(intent.amount_minor)],['date',intent.business_date]] as const).map(([key,value])=><div key={key}><dt className="text-sm text-text-muted">{t(key)}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
     <div data-testid="transfer-projections" className="border border-border-subtle rounded-lg p-4 space-y-2 text-sm">
      {([['from',intent.from_account_id,-intent.amount_minor],['to',intent.to_account_id,intent.amount_minor]] as const).map(([key,id,delta])=>{
       const a=accounts.find(a=>a.id===id);const balance=a?.current_balance_minor??a?.opening_balance_minor??0;
       return <p key={key}>{t(key)}: {a?.account_name} — <bdi>{money(balance)} → {money(balance+delta)}</bdi></p>;
      })}
      <p>{t('company')}: <bdi>{money(accounts.reduce((sum,a)=>sum+(a.current_balance_minor??a.opening_balance_minor),0))}</bdi></p>
     </div>
     <p className="text-sm text-text-muted">{t('recheck')}</p>{warningView}
     <div className="flex flex-wrap gap-2"><button className={button} data-testid="transfer-edit" disabled={busy||attempted} onClick={()=>{setIntent(null);setWarning(null);requestKey.current=generateIdempotencyKey();}}>{t('edit')}</button>
      <button className={`${button} bg-brand-primary text-white flex-1`} data-testid="transfer-confirm" disabled={busy} onClick={()=>void submit(false,Boolean(warning))}>{busy?t('loading'):warning?t('allow'):t('confirm')}</button></div>
    </div>}
   </div>
  </CashbookDialog></div>}
  {selectedVoucher&&<div className={overlay}><CashbookDialog label={t('detail')} className={`${panel} max-w-3xl`}>
   <div data-testid="transfer-detail" className="space-y-4">
    <div className="flex flex-wrap justify-between gap-2"><h2 className="text-xl font-bold">{t('detail')}</h2><button className={button} data-testid="transfer-detail-close" onClick={closeDetail} disabled={busy}>{t('close')}</button></div>
    {error&&<p role="alert" className="text-brand-coral break-words">{error}</p>}
    {document?<>
     <div className="rounded-lg overflow-hidden border border-border-subtle"><PrintableTransferDocument data={document} language={language}/></div>
     <div className="flex flex-wrap gap-2"><button className={button} data-testid="transfer-print" onClick={()=>{onSetActivePrintDocument?.({type:'transfer',data:document,language,format:'a4'});preparePrintStyles('a4');requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));}}>{t('print')}</button>
     {!header!.is_reversed&&!header!.is_reversal&&<button className={button} data-testid="transfer-reverse" onClick={()=>{setReverseConfirm(true);setWarning(null);setError('');}}>{t('reverse')}</button>}</div>
     {reverseConfirm&&<div className="space-y-3 border border-border-subtle rounded-lg p-4"><p>{t('reverseNotice')}</p>{warningView}<button className={`${button} bg-brand-coral text-white`} data-testid="transfer-reverse-confirm" disabled={busy} onClick={()=>void submit(true,Boolean(warning))}>{busy?t('loading'):warning?t('allow'):t('reverseConfirm')}</button></div>}
    </>:<p role="status">{t('loading')}{(headers.isError||legs.isError||(!headers.isPending&&!legs.isPending))&&<button className={button} onClick={()=>{void headers.refetch();void legs.refetch();}}>{t('retry')}</button>}</p>}
   </div>
  </CashbookDialog></div>}
 </>;
}
