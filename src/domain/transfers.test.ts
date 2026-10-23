import {describe,it,expect} from 'vitest';
import {normalizeTransferIntent,transferIntentHash} from './transfers';
const base={idempotency_key:'retry',from_account_id:' cash ',to_account_id:'bank',amount_minor:200000,business_date:'2026-10-23'};
describe('transfer intent',()=>{
 it('normalizes IDs and optional strings without confirmation in identity',()=>{expect(normalizeTransferIntent({...base,confirmed_negative_balance:true,notes:'  '})).toEqual(normalizeTransferIntent({...base,confirmed_negative_balance:false}));expect(normalizeTransferIntent(base).from_account_id).toBe('cash');});
 it('rejects same account and unsafe amounts',()=>{for(const amount_minor of [0,-1,NaN,1.5,100000000001])expect(()=>normalizeTransferIntent({...base,amount_minor})).toThrow();expect(()=>normalizeTransferIntent({...base,to_account_id:'cash'})).toThrow();});
 it('rejects impossible calendar dates and reserved keys',()=>{expect(()=>normalizeTransferIntent({...base,business_date:'2026-02-30'})).toThrow();expect(()=>normalizeTransferIntent({...base,idempotency_key:'__billzen_transfer__:x'})).toThrow();});
});

it('matches the Rust canonical transfer hash',async()=>{expect(await transferIntentHash(base)).toBe('a2ac11e537b543f107e622db93ca0f53abea36ad2b1b4de0464a296d4c236143');});
