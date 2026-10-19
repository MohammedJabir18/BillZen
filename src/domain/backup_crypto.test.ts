import { describe, it, expect } from 'vitest';
import {
  canonicalizeJson,
  computePayloadChecksum,
  verifyBackupEnvelope,
} from './backup_crypto';

describe('backup_crypto', () => {
  it('canonicalizeJson deterministically sorts keys regardless of insertion order', () => {
    const objA = { z: 1, a: 2, m: { y: 10, x: 20 } };
    const objB = { m: { x: 20, y: 10 }, a: 2, z: 1 };

    expect(canonicalizeJson(objA)).toBe(canonicalizeJson(objB));
    expect(canonicalizeJson(objA)).toBe('{"a":2,"m":{"x":20,"y":10},"z":1}');
  });

  it('computes consistent SHA-256 checksum across identical logical payloads', async () => {
    const payload1 = {
      format_version: '1.0',
      scope: 'workspace',
      app_version: '0.1.0',
      generated_at: 1729000000000,
      business_settings: { business_name: 'Test Store', currency_code: 'INR' },
      products: [],
      money_accounts: [{ id: 'acc-1', account_name: 'Cash' }],
    };

    const payload2 = {
      money_accounts: [{ account_name: 'Cash', id: 'acc-1' }],
      products: [],
      business_settings: { currency_code: 'INR', business_name: 'Test Store' },
      generated_at: 1729000000000,
      app_version: '0.1.0',
      scope: 'workspace',
      format_version: '1.0',
    };

    const hash1 = await computePayloadChecksum(payload1);
    const hash2 = await computePayloadChecksum(payload2);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it('verifyBackupEnvelope validates valid envelope and rejects altered envelope', async () => {
    const payload = {
      format_version: '1.0',
      scope: 'workspace',
      app_version: '0.1.0',
      generated_at: 1729000000000,
      business_settings: { business_name: 'Verified Retail' },
    };

    const checksum = await computePayloadChecksum(payload);
    const envelope = {
      checksum_sha256: checksum,
      ...payload,
    };

    // Valid check
    const validRes = await verifyBackupEnvelope(envelope);
    expect(validRes.valid).toBe(true);

    // Corrupted checksum
    const corruptedRes = await verifyBackupEnvelope({
      ...envelope,
      checksum_sha256: '0000000000000000000000000000000000000000000000000000000000000000',
    });
    expect(corruptedRes.valid).toBe(false);
    expect(corruptedRes.error).toContain('checksum mismatch');

    // Altered payload content
    const alteredRes = await verifyBackupEnvelope({
      ...envelope,
      business_settings: { business_name: 'Tampered Retail' },
    });
    expect(alteredRes.valid).toBe(false);
    expect(alteredRes.error).toContain('checksum mismatch');

    // Invalid version
    const invalidVerRes = await verifyBackupEnvelope({
      ...envelope,
      format_version: '2.0',
    });
    expect(invalidVerRes.valid).toBe(false);
    expect(invalidVerRes.error).toContain('Unsupported backup format version');
  });

  it('computeClientIntentHash matches Rust canonical client intent hash', async () => {
    const { computeClientIntentHash } = await import('./backup_crypto');
    const input = {
      account_id: 'acc-1',
      amount_minor: 100000,
      business_date: '2026-10-19',
      category_id: 'cat-1',
      classification: 'operating_income',
      direction: 'inflow',
      notes: 'Test note',
      party_id: 'party-1',
      payment_method: 'cash',
      reference_note: 'REF123',
    };

    const hash = await computeClientIntentHash(input);
    expect(hash).toBe('f650430e5ff7780b9ae71bdc3759be88911cb6d12be3245496514cc2cedbc716');

    // Altered input produces different hash
    const hashDiff = await computeClientIntentHash({ ...input, amount_minor: 100001 });
    expect(hashDiff).not.toBe(hash);

    // Whitespace in optional fields normalizes identically to null/empty
    const hashEmptyNote = await computeClientIntentHash({ ...input, notes: '   ' });
    const hashNullNote = await computeClientIntentHash({ ...input, notes: null });
    expect(hashEmptyNote).toBe(hashNullNote);
  });
});

