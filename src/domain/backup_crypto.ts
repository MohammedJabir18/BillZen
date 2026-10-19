/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) serializer.
 * Produces deterministic, sorted-key, unspaced UTF-8 representations.
 */
export function canonicalizeJson(value: any): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalizeJson).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalizeJson(value[k])).join(',') + '}';
}

/**
 * Computes the SHA-256 hex digest of a canonicalized JSON payload.
 * Works across Browser (Web Crypto), Node.js, and Vitest environments.
 */
export async function computePayloadChecksum(payloadMap: Record<string, any>): Promise<string> {
  const canonical = canonicalizeJson(payloadMap);
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);

  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const hashBuffer = await subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  throw new Error('Web Crypto API (crypto.subtle) is not available in current environment');
}

/**
 * Validates Tier 1 backup envelope format, scope, and checksum.
 */
export async function verifyBackupEnvelope(envelope: Record<string, any>): Promise<{
  valid: boolean;
  error?: string;
  expectedChecksum?: string;
  computedChecksum?: string;
}> {
  if (!envelope || typeof envelope !== 'object') {
    return { valid: false, error: 'Backup envelope must be an object' };
  }

  if (envelope.format_version !== '1.0') {
    return {
      valid: false,
      error: `Unsupported backup format version '${envelope.format_version}': expected '1.0'`,
    };
  }

  if (envelope.scope !== 'workspace') {
    return {
      valid: false,
      error: `Invalid backup scope '${envelope.scope}': expected 'workspace'`,
    };
  }

  const expectedChecksum = envelope.checksum_sha256;
  if (!expectedChecksum || typeof expectedChecksum !== 'string') {
    return { valid: false, error: 'Missing checksum_sha256 in backup envelope' };
  }

  const payload: Record<string, any> = {};
  for (const [k, v] of Object.entries(envelope)) {
    if (k !== 'checksum_sha256') {
      payload[k] = v;
    }
  }

  const computedChecksum = await computePayloadChecksum(payload);
  if (computedChecksum !== expectedChecksum) {
    return {
      valid: false,
      error: `Integrity check failed: checksum mismatch (expected ${expectedChecksum}, computed ${computedChecksum})`,
      expectedChecksum,
      computedChecksum,
    };
  }

  return { valid: true, expectedChecksum, computedChecksum };
}

function normalizeOptStr(s?: string | null): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Computes canonical SHA-256 client intent hash for cashbook voucher idempotency,
 * matching Rust domain::cashbook::compute_client_intent_hash byte-for-byte.
 */
export async function computeClientIntentHash(input: {
  account_id: string;
  amount_minor: number;
  business_date: string;
  category_id?: string | null;
  classification: string;
  direction: string;
  notes?: string | null;
  party_id?: string | null;
  payment_method: string;
  reference_note?: string | null;
}): Promise<string> {
  const canonical = {
    account_id: input.account_id.trim(),
    amount_minor: input.amount_minor,
    business_date: input.business_date.trim(),
    category_id: normalizeOptStr(input.category_id),
    classification: input.classification,
    direction: input.direction,
    notes: normalizeOptStr(input.notes),
    party_id: normalizeOptStr(input.party_id),
    payment_method: input.payment_method,
    reference_note: normalizeOptStr(input.reference_note),
  };
  const jsonStr = JSON.stringify(canonical);
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonStr);

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is not available');
  }
  const hashBuffer = await subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

