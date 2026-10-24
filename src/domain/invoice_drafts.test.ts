import {describe,it,expect} from 'vitest';
import {normalizeDraftItems,calculateDraftTotals} from './invoice_drafts';
import type {DraftItemInput} from '../types/invoice_drafts';
const item:DraftItemInput={product_id:null,product_name:' Tea ',product_sku:null,unit:' kg ',cost_price_minor:20,quantity_scaled:1500,unit_price_minor:1001,discount_minor:2,tax_rate_bp:500};
describe('draft normalization and checked totals',()=>{
 it('uses half-up integer amounts for two- and three-decimal currencies',()=>{
  const items=normalizeDraftItems([item,item]);expect(items[0].product_name).toBe('Tea');expect(items[0].unit).toBe('kg');
  expect(calculateDraftTotals(items)).toEqual({subtotal_minor:3004,discount_total_minor:4,taxable_amount_minor:3000,tax_total_minor:150,grand_total_minor:3150,paid_amount_minor:0,balance_due_minor:3150,settlement_status:'unpaid'});
  expect(calculateDraftTotals([{...item,quantity_scaled:1,unit_price_minor:500,discount_minor:0,tax_rate_bp:10000}]).grand_total_minor).toBe(2);
  expect(calculateDraftTotals([]).grand_total_minor).toBe(0);
 });
 it('rejects malformed metadata, numeric bounds and unsafe totals',()=>{
  for(const change of [{product_name:' '},{unit:''},{cost_price_minor:-1},{quantity_scaled:1.1},{tax_rate_bp:10001},{discount_minor:2000},{unit_price_minor:Number.MAX_SAFE_INTEGER}]){
   expect(()=>calculateDraftTotals(normalizeDraftItems([{...item,...change}]))).toThrow();
  }
  expect(()=>normalizeDraftItems(Array(501).fill(item))).toThrow();
 });
});
