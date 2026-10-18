#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CurrencySpec {
    pub code: &'static str,
    pub symbol: &'static str,
    pub exponent: i32,
    pub country: &'static str,
    pub default_locale: &'static str,
}

pub const SUPPORTED_CURRENCIES: &[CurrencySpec] = &[
    CurrencySpec {
        code: "INR",
        symbol: "₹",
        exponent: 2,
        country: "India",
        default_locale: "en-IN",
    },
    CurrencySpec {
        code: "AED",
        symbol: "AED",
        exponent: 2,
        country: "United Arab Emirates",
        default_locale: "en-AE",
    },
    CurrencySpec {
        code: "SAR",
        symbol: "SAR",
        exponent: 2,
        country: "Saudi Arabia",
        default_locale: "en-SA",
    },
    CurrencySpec {
        code: "QAR",
        symbol: "QAR",
        exponent: 2,
        country: "Qatar",
        default_locale: "en-QA",
    },
    CurrencySpec {
        code: "KWD",
        symbol: "KWD",
        exponent: 3,
        country: "Kuwait",
        default_locale: "en-KW",
    },
    CurrencySpec {
        code: "BHD",
        symbol: "BHD",
        exponent: 3,
        country: "Bahrain",
        default_locale: "en-BH",
    },
    CurrencySpec {
        code: "OMR",
        symbol: "OMR",
        exponent: 3,
        country: "Oman",
        default_locale: "en-OM",
    },
    CurrencySpec {
        code: "USD",
        symbol: "$",
        exponent: 2,
        country: "United States",
        default_locale: "en-US",
    },
    CurrencySpec {
        code: "EUR",
        symbol: "€",
        exponent: 2,
        country: "European Union",
        default_locale: "en-IE",
    },
    CurrencySpec {
        code: "GBP",
        symbol: "£",
        exponent: 2,
        country: "United Kingdom",
        default_locale: "en-GB",
    },
];

pub fn validate_currency(code: &str, exponent: i32) -> Result<&'static CurrencySpec, String> {
    let spec = SUPPORTED_CURRENCIES
        .iter()
        .find(|c| c.code.eq_ignore_ascii_case(code))
        .ok_or_else(|| {
            format!(
                "Unsupported currency code: '{}'. Supported codes: INR, AED, SAR, QAR, KWD, BHD, OMR, USD, EUR, GBP",
                code
            )
        })?;

    if spec.exponent != exponent {
        return Err(format!(
            "Invalid exponent {} for currency '{}'. Expected exponent is {}.",
            exponent, spec.code, spec.exponent
        ));
    }

    Ok(spec)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_currencies() {
        assert_eq!(validate_currency("INR", 2).unwrap().code, "INR");
        assert_eq!(validate_currency("KWD", 3).unwrap().code, "KWD");
        assert_eq!(validate_currency("SAR", 2).unwrap().code, "SAR");
    }

    #[test]
    fn test_invalid_exponent_rejected() {
        let err = validate_currency("INR", 3).unwrap_err();
        assert!(err.contains("Invalid exponent 3 for currency 'INR'"));

        let err2 = validate_currency("KWD", 2).unwrap_err();
        assert!(err2.contains("Invalid exponent 2 for currency 'KWD'"));
    }

    #[test]
    fn test_unknown_currency_rejected() {
        let err = validate_currency("XYZ", 2).unwrap_err();
        assert!(err.contains("Unsupported currency code: 'XYZ'"));
    }
}
