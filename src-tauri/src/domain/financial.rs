use serde::{Deserialize, Serialize};

pub const CURRENCY_MINOR_FACTOR: i64 = 100;
pub const QUANTITY_SCALED_FACTOR: i64 = 1000;
pub const TAX_BASIS_POINTS_FACTOR: i64 = 10000;

pub const MAX_MONEY_MINOR: i64 = 1_000_000_000_00; // ₹1,000,000,000.00 (₹1 Billion)
pub const MAX_QUANTITY_SCALED: i64 = 1_000_000_000; // 1,000,000.000 units
pub const MAX_SAFE_MONEY_MINOR: i64 = 9_007_199_254_740_991; // 2^53 - 1 (Number.MAX_SAFE_INTEGER)

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum FinancialError {
    #[error("Numeric overflow during calculation")]
    Overflow,
    #[error("Quantity out of bounds: {0}")]
    QuantityOutOfBounds(i64),
    #[error("Unit price out of bounds: {0}")]
    UnitPriceOutOfBounds(i64),
    #[error("Discount exceeds gross line amount: discount={discount}, gross={gross}")]
    DiscountExceedsGross { discount: i64, gross: i64 },
    #[error("Tax rate basis points out of bounds: {0}")]
    TaxRateOutOfBounds(i64),
    #[error("Payment exceeds grand total: payment={payment}, total={total}")]
    OverpaymentNotAllowed { payment: i64, total: i64 },
}

/// Half-up midpoint rounding: floor((n + divisor/2) / divisor)
#[inline]
pub fn round_half_up(n: i64, divisor: i64) -> Result<i64, FinancialError> {
    if divisor <= 0 {
        return Err(FinancialError::Overflow);
    }
    let half = divisor / 2;
    let sum = n.checked_add(half).ok_or(FinancialError::Overflow)?;
    Ok(sum / divisor)
}

/// 128-bit Half-up midpoint rounding to prevent intermediate overflow
#[inline]
pub fn round_half_up_128(n: i128, divisor: i128) -> Result<i128, FinancialError> {
    if divisor <= 0 {
        return Err(FinancialError::Overflow);
    }
    let half = divisor / 2;
    let sum = n.checked_add(half).ok_or(FinancialError::Overflow)?;
    Ok(sum / divisor)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LineItemCalculation {
    pub quantity_scaled: i64,
    pub unit_price_minor: i64,
    pub discount_minor: i64,
    pub tax_rate_bp: i64,
    pub gross_minor: i64,
    pub taxable_minor: i64,
    pub tax_minor: i64,
    pub line_total_minor: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct InvoiceTotalsCalculation {
    pub subtotal_minor: i64,
    pub discount_total_minor: i64,
    pub taxable_amount_minor: i64,
    pub tax_total_minor: i64,
    pub grand_total_minor: i64,
    pub paid_amount_minor: i64,
    pub balance_due_minor: i64,
    pub settlement_status: String,
}

pub fn calculate_line_item(
    quantity_scaled: i64,
    unit_price_minor: i64,
    discount_minor: i64,
    tax_rate_bp: i64,
) -> Result<LineItemCalculation, FinancialError> {
    if quantity_scaled <= 0 || quantity_scaled > MAX_QUANTITY_SCALED {
        return Err(FinancialError::QuantityOutOfBounds(quantity_scaled));
    }
    if unit_price_minor < 0 || unit_price_minor > MAX_MONEY_MINOR {
        return Err(FinancialError::UnitPriceOutOfBounds(unit_price_minor));
    }
    if !(0..=TAX_BASIS_POINTS_FACTOR).contains(&tax_rate_bp) {
        return Err(FinancialError::TaxRateOutOfBounds(tax_rate_bp));
    }
    if discount_minor < 0 {
        return Err(FinancialError::Overflow);
    }

    // 1. Gross Minor calculated with i128 to prevent 64-bit intermediate overflow
    let product_128 = (quantity_scaled as i128) * (unit_price_minor as i128);
    let gross_128 = round_half_up_128(product_128, QUANTITY_SCALED_FACTOR as i128)?;
    if gross_128 > MAX_SAFE_MONEY_MINOR as i128 {
        return Err(FinancialError::Overflow);
    }
    let gross_minor = gross_128 as i64;

    if discount_minor > gross_minor {
        return Err(FinancialError::DiscountExceedsGross {
            discount: discount_minor,
            gross: gross_minor,
        });
    }

    // 2. Taxable Minor = Gross Minor - Discount Minor
    let taxable_minor = gross_minor
        .checked_sub(discount_minor)
        .ok_or(FinancialError::Overflow)?;

    // 3. Tax Minor in i128
    let tax_product_128 = (taxable_minor as i128) * (tax_rate_bp as i128);
    let tax_128 = round_half_up_128(tax_product_128, TAX_BASIS_POINTS_FACTOR as i128)?;
    if tax_128 > MAX_SAFE_MONEY_MINOR as i128 {
        return Err(FinancialError::Overflow);
    }
    let tax_minor = tax_128 as i64;

    // 4. Line Total = Taxable Minor + Tax Minor
    let line_total_minor = taxable_minor
        .checked_add(tax_minor)
        .ok_or(FinancialError::Overflow)?;
    if line_total_minor > MAX_SAFE_MONEY_MINOR {
        return Err(FinancialError::Overflow);
    }

    Ok(LineItemCalculation {
        quantity_scaled,
        unit_price_minor,
        discount_minor,
        tax_rate_bp,
        gross_minor,
        taxable_minor,
        tax_minor,
        line_total_minor,
    })
}

pub fn calculate_invoice_totals(
    items: &[LineItemCalculation],
    paid_amount_minor: i64,
) -> Result<InvoiceTotalsCalculation, FinancialError> {
    if paid_amount_minor < 0 {
        return Err(FinancialError::Overflow);
    }

    let mut subtotal_minor: i64 = 0;
    let mut discount_total_minor: i64 = 0;
    let mut taxable_amount_minor: i64 = 0;
    let mut tax_total_minor: i64 = 0;
    let mut grand_total_minor: i64 = 0;

    for item in items {
        subtotal_minor = subtotal_minor
            .checked_add(item.gross_minor)
            .ok_or(FinancialError::Overflow)?;
        if subtotal_minor > MAX_SAFE_MONEY_MINOR {
            return Err(FinancialError::Overflow);
        }
        discount_total_minor = discount_total_minor
            .checked_add(item.discount_minor)
            .ok_or(FinancialError::Overflow)?;
        if discount_total_minor > MAX_SAFE_MONEY_MINOR {
            return Err(FinancialError::Overflow);
        }
        taxable_amount_minor = taxable_amount_minor
            .checked_add(item.taxable_minor)
            .ok_or(FinancialError::Overflow)?;
        if taxable_amount_minor > MAX_SAFE_MONEY_MINOR {
            return Err(FinancialError::Overflow);
        }
        tax_total_minor = tax_total_minor
            .checked_add(item.tax_minor)
            .ok_or(FinancialError::Overflow)?;
        if tax_total_minor > MAX_SAFE_MONEY_MINOR {
            return Err(FinancialError::Overflow);
        }
        grand_total_minor = grand_total_minor
            .checked_add(item.line_total_minor)
            .ok_or(FinancialError::Overflow)?;
        if grand_total_minor > MAX_SAFE_MONEY_MINOR {
            return Err(FinancialError::Overflow);
        }
    }

    if paid_amount_minor > grand_total_minor {
        return Err(FinancialError::OverpaymentNotAllowed {
            payment: paid_amount_minor,
            total: grand_total_minor,
        });
    }

    let balance_due_minor = grand_total_minor
        .checked_sub(paid_amount_minor)
        .ok_or(FinancialError::Overflow)?;

    // Single settlement state for zero-total invoices is "fully_paid"
    let settlement_status = if grand_total_minor == 0 {
        "fully_paid".to_string()
    } else if paid_amount_minor == 0 {
        "unpaid".to_string()
    } else if paid_amount_minor == grand_total_minor {
        "fully_paid".to_string()
    } else {
        "partially_paid".to_string()
    };

    Ok(InvoiceTotalsCalculation {
        subtotal_minor,
        discount_total_minor,
        taxable_amount_minor,
        tax_total_minor,
        grand_total_minor,
        paid_amount_minor,
        balance_due_minor,
        settlement_status,
    })
}

pub fn format_minor_units(minor: i64, exponent: i32) -> String {
    let exponent = if !(0..=6).contains(&exponent) { 2 } else { exponent };
    let is_negative = minor < 0;
    let abs_minor = minor.unsigned_abs();
    let divisor = 10_u64.pow(exponent as u32);
    let whole = abs_minor / divisor;
    let fraction = abs_minor % divisor;
    if is_negative {
        format!("-{}.{:0width$}", whole, fraction, width = exponent as usize)
    } else {
        format!("{}.{:0width$}", whole, fraction, width = exponent as usize)
    }
}

pub fn parse_to_minor_units(value_str: &str, exponent: i32) -> Result<i64, FinancialError> {
    let exponent = if !(0..=6).contains(&exponent) { 2 } else { exponent };
    let trimmed = value_str.trim();
    if trimmed.is_empty() {
        return Ok(0);
    }

    let (is_negative, rest) = if let Some(stripped) = trimmed.strip_prefix('-') {
        (true, stripped)
    } else if let Some(stripped) = trimmed.strip_prefix('+') {
        (false, stripped)
    } else {
        (false, trimmed)
    };

    if rest.is_empty() {
        return Err(FinancialError::Overflow);
    }

    let (whole_str, fraction_str) = match rest.split_once('.') {
        Some((w, f)) => (w, Some(f)),
        None => (rest, None),
    };

    // Grouping validation
    let raw_whole = if whole_str.contains(',') {
        let parts: Vec<&str> = whole_str.split(',').collect();
        if parts.iter().any(|p| p.is_empty()) {
            return Err(FinancialError::Overflow);
        }
        if parts[0].is_empty() || parts[0].len() > 3 || !parts[0].chars().all(|c| c.is_ascii_digit()) {
            return Err(FinancialError::Overflow);
        }
        let is_standard = parts[1..].iter().all(|p| p.len() == 3 && p.chars().all(|c| c.is_ascii_digit()));
        let is_indian = if parts.len() >= 2 {
            let last = parts.last().unwrap();
            let middle = &parts[1..parts.len() - 1];
            last.len() == 3 && last.chars().all(|c| c.is_ascii_digit())
                && middle.iter().all(|p| p.len() == 2 && p.chars().all(|c| c.is_ascii_digit()))
                && parts[0].len() <= 2
        } else {
            false
        };

        if !is_standard && !is_indian {
            return Err(FinancialError::Overflow);
        }

        whole_str.replace(',', "")
    } else {
        if !whole_str.chars().all(|c| c.is_ascii_digit()) || whole_str.is_empty() {
            return Err(FinancialError::Overflow);
        }
        whole_str.to_string()
    };

    let whole: i64 = raw_whole.parse().map_err(|_| FinancialError::Overflow)?;

    let fraction = if let Some(f) = fraction_str {
        if !f.chars().all(|c| c.is_ascii_digit()) {
            return Err(FinancialError::Overflow);
        }
        if f.len() > exponent as usize {
            return Err(FinancialError::Overflow); // Excess precision rejected
        }
        let padded = format!("{:0<width$}", f, width = exponent as usize);
        padded.parse::<i64>().map_err(|_| FinancialError::Overflow)?
    } else {
        0
    };

    let multiplier = 10_i64.pow(exponent as u32);
    let total_minor = whole
        .checked_mul(multiplier)
        .and_then(|w| w.checked_add(fraction))
        .ok_or(FinancialError::Overflow)?;

    if total_minor > MAX_SAFE_MONEY_MINOR {
        return Err(FinancialError::Overflow);
    }

    Ok(if is_negative { -total_minor } else { total_minor })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_worked_example_1_standard_unit() {
        // 2 units @ ₹100.00 with ₹10.00 discount and 18% tax, ₹100.00 paid
        let line = calculate_line_item(2000, 10000, 1000, 1800).expect("Line calculation failed");
        assert_eq!(line.gross_minor, 20000);
        assert_eq!(line.taxable_minor, 19000);
        assert_eq!(line.tax_minor, 3420);
        assert_eq!(line.line_total_minor, 22420);

        let totals = calculate_invoice_totals(&[line], 10000).expect("Totals calculation failed");
        assert_eq!(totals.subtotal_minor, 20000);
        assert_eq!(totals.discount_total_minor, 1000);
        assert_eq!(totals.taxable_amount_minor, 19000);
        assert_eq!(totals.tax_total_minor, 3420);
        assert_eq!(totals.grand_total_minor, 22420);
        assert_eq!(totals.paid_amount_minor, 10000);
        assert_eq!(totals.balance_due_minor, 12420);
        assert_eq!(totals.settlement_status, "partially_paid");
    }

    #[test]
    fn test_worked_example_2_fractional_quantity() {
        // 1.375 kg @ ₹245.50/kg with ₹5.00 discount and 5% tax
        let line = calculate_line_item(1375, 24550, 500, 500).expect("Line calculation failed");
        assert_eq!(line.gross_minor, 33756);
        assert_eq!(line.taxable_minor, 33256);
        assert_eq!(line.tax_minor, 1663);
        assert_eq!(line.line_total_minor, 34919);

        let totals = calculate_invoice_totals(&[line], 34919).expect("Totals calculation failed");
        assert_eq!(totals.grand_total_minor, 34919);
        assert_eq!(totals.balance_due_minor, 0);
        assert_eq!(totals.settlement_status, "fully_paid");
    }

    #[test]
    fn test_worked_example_3_three_decimal_currency_kwd() {
        // 1.500 kg @ 2.250 KWD/kg (2250 fils) with 0.250 KWD discount (250 fils) and 5% tax (500 bp)
        let line = calculate_line_item(1500, 2250, 250, 500).expect("Line calculation failed");
        assert_eq!(line.gross_minor, 3375);
        assert_eq!(line.taxable_minor, 3125);
        assert_eq!(line.tax_minor, 156);
        assert_eq!(line.line_total_minor, 3281);

        let totals = calculate_invoice_totals(&[line], 3281).expect("Totals calculation failed");
        assert_eq!(totals.grand_total_minor, 3281);
        assert_eq!(totals.balance_due_minor, 0);
        assert_eq!(totals.settlement_status, "fully_paid");
        assert_eq!(format_minor_units(totals.grand_total_minor, 3), "3.281");
    }

    #[test]
    fn test_zero_total_invoice_settlement_status() {
        // Zero total invoice has single settlement status 'fully_paid'
        let line = calculate_line_item(1000, 10000, 10000, 1800).expect("Line calculation failed");
        assert_eq!(line.gross_minor, 10000);
        assert_eq!(line.taxable_minor, 0);
        assert_eq!(line.tax_minor, 0);
        assert_eq!(line.line_total_minor, 0);

        let totals = calculate_invoice_totals(&[line], 0).expect("Totals calculation failed");
        assert_eq!(totals.grand_total_minor, 0);
        assert_eq!(totals.paid_amount_minor, 0);
        assert_eq!(totals.balance_due_minor, 0);
        assert_eq!(totals.settlement_status, "fully_paid");
    }

    #[test]
    fn test_overpayment_rejected() {
        let line = calculate_line_item(1000, 10000, 0, 0).expect("Line calculation failed");
        let err = calculate_invoice_totals(&[line], 15000).expect_err("Overpayment should be rejected");
        assert_eq!(
            err,
            FinancialError::OverpaymentNotAllowed {
                payment: 15000,
                total: 10000
            }
        );
    }

    #[test]
    fn test_formatting_and_parsing_negative_minor_units() {
        assert_eq!(format_minor_units(-50, 2), "-0.50");
        assert_eq!(format_minor_units(-1234, 2), "-12.34");
        assert_eq!(format_minor_units(-5, 3), "-0.005");

        assert_eq!(parse_to_minor_units("-0.50", 2).unwrap(), -50);
        assert_eq!(parse_to_minor_units("-50", 2).unwrap(), -5000);
        assert_eq!(parse_to_minor_units("-12.34", 2).unwrap(), -1234);
        assert_eq!(parse_to_minor_units("-0.005", 3).unwrap(), -5);
    }

    #[test]
    fn test_thousands_grouping_and_excess_precision_rejection() {
        // 1. Valid standard 3-digit comma grouping
        assert_eq!(parse_to_minor_units("1,000.00", 2).unwrap(), 100000);
        assert_eq!(parse_to_minor_units("1,000,000.50", 2).unwrap(), 100000050);

        // 2. Valid Indian lakh/crore grouping
        assert_eq!(parse_to_minor_units("1,00,000.00", 2).unwrap(), 10000000);
        assert_eq!(parse_to_minor_units("12,34,567.89", 2).unwrap(), 123456789);

        // 3. Reject non-numeric characters (reproducing "12abc.34")
        assert!(parse_to_minor_units("12abc.34", 2).is_err());
        assert!(parse_to_minor_units("abc", 2).is_err());

        // 4. Reject excess precision (reproducing "1.999" for exponent 2)
        assert!(parse_to_minor_units("1.999", 2).is_err());
        assert!(parse_to_minor_units("1.0001", 3).is_err());

        // 5. Reject invalid comma placements
        assert!(parse_to_minor_units("12,34.56", 2).is_err());
        assert!(parse_to_minor_units(",100.00", 2).is_err());
        assert!(parse_to_minor_units("100,.00", 2).is_err());
        assert!(parse_to_minor_units("1,,000.00", 2).is_err());
    }

    #[test]
    fn test_boundary_rejection_gross_exceeds_safe_limit() {
        // Reproduces user case: 999999900 qty * 99999999991 unit price exceeds MAX_SAFE_MONEY_MINOR
        let err = calculate_line_item(999999900, 99999999991, 0, 0)
            .expect_err("Should reject line item exceeding MAX_SAFE_MONEY_MINOR");
        assert_eq!(err, FinancialError::Overflow);
    }

    #[test]
    fn test_boundary_success_large_quantity_and_price() {
        // 900,000 units @ ₹100,000.00 within MAX_SAFE_MONEY_MINOR
        let line = calculate_line_item(900000000, 10000000, 0, 1800)
            .expect("Should succeed for values within MAX_SAFE_MONEY_MINOR");
        assert_eq!(line.gross_minor, 9000000000000);
        assert_eq!(line.tax_minor, 1620000000000);
        assert_eq!(line.line_total_minor, 10620000000000);

        let totals = calculate_invoice_totals(&[line], 10620000000000).expect("Totals calculation failed");
        assert_eq!(totals.grand_total_minor, 10620000000000);
        assert_eq!(totals.settlement_status, "fully_paid");
    }

    #[test]
    fn test_boundary_multi_item_accumulation_overflow_rejection() {
        let line1 = calculate_line_item(500000000, 10000000000, 0, 0).unwrap();
        let line2 = calculate_line_item(500000000, 10000000000, 0, 0).unwrap();
        let err = calculate_invoice_totals(&[line1, line2], 0)
            .expect_err("Should reject invoice total exceeding MAX_SAFE_MONEY_MINOR");
        assert_eq!(err, FinancialError::Overflow);
    }
}
