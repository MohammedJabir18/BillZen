# BillZen Design System & Visual Guidelines

**Vibe**: Utilitarian, focused, high-density desktop billing & accounting workspace.  
**Inspiration**: Linear, Bloomberg Terminal, Apple Pages document precision.  
**Rules**: Zero marketing slop, no generic decorative illustrations, zero animated totals that slow entry, immediate keyboard response, 100% accessible contrast.

---

## 1. Color Palette (Dark & Light)

### Light Theme (Default for billing / POS)
- **Background**: `#F9FAFB` (Gray 50)
- **Surface / Card**: `#FFFFFF` (Pure white)
- **Border / Divider**: `#E5E7EB` (Gray 200)
- **Text Primary**: `#111827` (Gray 900 - high contrast)
- **Text Secondary**: `#4B5563` (Gray 600)
- **Accent Primary**: `#0F172A` (Slate 900 - deep authoritative slate)
- **Success / Paid**: `#059669` (Emerald 600)
- **Warning / Unpaid Credit**: `#D97706` (Amber 600)
- **Danger / Stock Low**: `#DC2626` (Red 600)

### Dark Theme
- **Background**: `#090D16` (Deep charcoal navy)
- **Surface**: `#131B2E` (Layered navy slate)
- **Border**: `#1E293B` (Slate 800)
- **Text Primary**: `#F8FAFC` (Slate 50)
- **Text Secondary**: `#94A3B8` (Slate 400)
- **Accent Primary**: `#38BDF8` (Sky 400)

---

## 2. Typography
- **Primary Interface**: Inter / System UI Font (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`)
- **Monospace / Financial Figures**: JetBrains Mono / Roboto Mono (`ui-monospace, "SF Mono", Menlo, Consolas, monospace`)
  - All numerical currency amounts, quantities, SKUs, and invoice numbers **MUST** use tabular figures (`font-mono tabular-nums`).

---

## 3. Keyboard-First POS Ergonomics
- `F1`: Focus search / Product barcode lookup.
- `F2`: Add new line item.
- `F4`: Select / Switch customer.
- `F9` / `Ctrl+Enter`: Finalize and print invoice.
- `Esc`: Close modal / cancel current input.
- Arrow keys (`Up` / `Down`): Navigate line items table.

---

## 4. A4 Print Standard Specification
- **Physical Size**: $210\text{mm} \times 297\text{mm}$ (portrait).
- **Margins**: $12\text{mm}$ all sides.
- **Header**: Business logo / name, tax registration (GSTIN), address, contact details.
- **Invoice Metadata**: Invoice number, date, due date, customer billing address.
- **Table Structure**:
  - Border: $1\text{px}$ solid `#CBD5E1`.
  - Columns: `#`, `Item Description & SKU`, `Unit Price (₹)`, `Qty`, `Discount (₹)`, `Tax (%)`, `Total (₹)`.
- **Footer**: Grand totals summary, payment received, balance due, terms and conditions, authorized signature box.
