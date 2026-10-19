import {describe,it,expect} from 'vitest';
import {canInstallUpdate,shouldCheckForUpdate} from './update_state';
describe('update safety',()=>{
 it('never interrupts offline work or repeats automatic checks within a day',()=>{
  expect(shouldCheckForUpdate(false,0,100000000)).toBe(false);
  expect(shouldCheckForUpdate(true,100000,100001)).toBe(false);
  expect(shouldCheckForUpdate(true,0,100000000)).toBe(true);
 });
 it('blocks installation while writes, dialogs, or dirty forms are active',()=>{
  expect(canInstallUpdate({mutations:0,dialog:false,dirty:false,ready:true})).toBe(true);
  for(const state of [{mutations:1,dialog:false,dirty:false,ready:true},{mutations:0,dialog:true,dirty:false,ready:true},{mutations:0,dialog:false,dirty:true,ready:true},{mutations:0,dialog:false,dirty:false,ready:false}]) expect(canInstallUpdate(state)).toBe(false);
 });
});
