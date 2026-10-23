import { describe, expect, it } from 'vitest';
import { customerPartyError } from './customer_cashbook';

describe('customer link error transport', () => {
  it('recognizes the selection-required browser error without exposing an unhelpful raw code', () => {
    expect(customerPartyError(new Error('PARTY_SELECTION_REQUIRED')).code).toBe('PARTY_SELECTION_REQUIRED');
  });
  it('recognizes the native plain code error', () => {
    expect(customerPartyError('PARTY_SELECTION_REQUIRED').code).toBe('PARTY_SELECTION_REQUIRED');
  });
  it('recognizes the native code prefix and preserves its explanation', () => {
    expect(customerPartyError('PARTY_SELECTION_REQUIRED: Select an existing active party explicitly')).toEqual({ code: 'PARTY_SELECTION_REQUIRED', message: 'Select an existing active party explicitly' });
  });
  it('retains a structured native error code and message', () => {
    expect(customerPartyError('{"code":"PARTY_SELECTION_REQUIRED","message":"Choose a party"}')).toEqual({ code: 'PARTY_SELECTION_REQUIRED', message: 'Choose a party' });
  });
});
