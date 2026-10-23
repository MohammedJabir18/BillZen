import type { CashbookParty, CashbookLedgerEntry, CustomerCashHistory, CustomerCashHistoryFilter } from '../types/cashbook';
import { workspaceTransaction } from './web_workspace';
export async function ensureWebCustomerCashbookParty(input: {
    customer_id: string;
    existing_party_id?: string;
}): Promise<CashbookParty> {
    return workspaceTransaction(true, t => {
        const customer = t.customers.find(c => c.id === input.customer_id.trim());
        if (!customer)
            throw Error('CUSTOMER_NOT_FOUND');
        if (!customer.is_active)
            throw Error('CUSTOMER_ARCHIVED');
        const linked = t.cashbook_parties.filter(p => p.customer_id === customer.id);
        let party = input.existing_party_id ? t.cashbook_parties.find(p => p.id === input.existing_party_id!.trim()) : undefined;
        if (input.existing_party_id && !party)
            throw Error('PARTY_NOT_FOUND');
        if (party?.is_archived)
            throw Error('PARTY_ARCHIVED');
        if (party?.customer_id && party.customer_id !== customer.id)
            throw Error('PARTY_LINK_CONFLICT');
        if (!party) {
            if (linked.length === 1 && !linked[0].is_archived)
                party = linked[0];
            else if (linked.length)
                throw Error('PARTY_SELECTION_REQUIRED');
        }
        const now = Date.now();
        const fields = { name: customer.name, phone: customer.phone, email: customer.email, tax_id: customer.tax_identifier, address: [customer.address_line1, customer.address_line2, customer.city, customer.state, customer.postal_code, customer.country].filter(Boolean).join(', ') };
        if (!party) {
            party = { id: crypto.randomUUID(), customer_id: customer.id, party_type: 'customer', is_archived: false, created_at: now, updated_at: now, ...fields };
            t.cashbook_parties.push(party);
        }
        else
            Object.assign(party, fields, { customer_id: customer.id, updated_at: now });
        t.cashbook_audit_events.push({ id: crypto.randomUUID(), voucher_id: null, event_type: 'customer_party_linked', details_json: JSON.stringify({ customer_id: customer.id, party_id: party.id }), created_at: now });
        return party as CashbookParty;
    });
}
export async function getWebCustomerCashHistory(filter: CustomerCashHistoryFilter): Promise<CustomerCashHistory> {
    return workspaceTransaction(false, t => {
        if (!t.customers.some(c => c.id === filter.customer_id))
            throw Error('CUSTOMER_NOT_FOUND');
        const parties = new Set(t.cashbook_parties.filter(p => p.customer_id === filter.customer_id).map(p => p.id));
        const balances = new Map<string, bigint>(t.money_accounts.map(a => [a.id, BigInt(a.opening_balance_minor)]));
        const running = new Map<string, number>();
        const checked = (n: bigint) => { if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < -BigInt(Number.MAX_SAFE_INTEGER))
            throw Error('History total overflow'); return Number(n); };
        const movements = [...t.cashbook_movements].sort((a, b) => a.business_date.localeCompare(b.business_date) || a.sequence_number - b.sequence_number || a.id.localeCompare(b.id));
        for (const m of movements) {
            const n = (balances.get(m.account_id) || 0n) + BigInt(m.amount_minor);
            balances.set(m.account_id, n);
            running.set(m.id, checked(n));
        }
        const vouchers = new Map(t.cashbook_vouchers.map(v => [v.id, v]));
        const entries: CashbookLedgerEntry[] = [];
        let received = 0n, paid = 0n;
        for (const m of movements) {
            const v = vouchers.get(m.voucher_id);
            if (!v || !parties.has(v.party_id))
                continue;
            if (filter.account_id && m.account_id !== filter.account_id)
                continue;
            if (filter.start_date && m.business_date < filter.start_date)
                continue;
            if (filter.end_date && m.business_date > filter.end_date)
                continue;
            entries.push({ voucher: v, movement: m, running_balance_minor: running.get(m.id)! });
            if (m.amount_minor > 0)
                received += BigInt(m.amount_minor);
            else
                paid -= BigInt(m.amount_minor);
        }
        return { entries, received_minor: checked(received), paid_minor: checked(paid), net_movement_minor: checked(received - paid) };
    });
}
