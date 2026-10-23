import type {CreateTransferInput} from '../types/transfers';
import {MAX_MONEY_MINOR} from './financial';
export const TRANSFER_INTERNAL_PREFIX='__billzen_transfer__:';
export function normalizeTransferIntent(input:CreateTransferInput){
 const text=(value:string,max:number)=>{const s=value.trim();if(!s||new TextEncoder().encode(s).length>max||/[\x00-\x1f\x7f]/.test(s))throw Error('Invalid transfer text');return s;};
 const key=text(input.idempotency_key,256);if(key.startsWith(TRANSFER_INTERNAL_PREFIX))throw Error('Reserved transfer identity');
 const from=text(input.from_account_id,256),to=text(input.to_account_id,256);
 if(from===to)throw Error('Choose two different accounts');
 if(!Number.isSafeInteger(input.amount_minor)||input.amount_minor<=0||input.amount_minor>MAX_MONEY_MINOR)throw Error('Invalid transfer amount');
 const date=text(input.business_date,10);const parsed=new Date(date+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw Error('Invalid transfer date');
 const optional=(s?:string|null)=>s?.trim()?text(s,2000):null;
 // Alphabetical keys match serde_json canonical object ordering. Public key/confirmation are not payload.
 return {amount_minor:input.amount_minor,business_date:date,from_account_id:from,notes:optional(input.notes),reference_note:optional(input.reference_note),to_account_id:to};
}
export async function transferIntentHash(input:CreateTransferInput):Promise<string>{
 const bytes=new TextEncoder().encode(JSON.stringify(normalizeTransferIntent(input)));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
}
