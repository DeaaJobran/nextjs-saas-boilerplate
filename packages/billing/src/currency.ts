const zeroDecimalCurrencies = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

const threeDecimalCurrencies = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

export function normalizeCurrency(currency: string) {
  const normalized = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("Currency codes must use three ISO-style letters.");
  }

  return normalized;
}

export function currencyDecimalPrecision(currency: string) {
  const normalized = normalizeCurrency(currency);

  if (zeroDecimalCurrencies.has(normalized)) {
    return 0;
  }

  if (threeDecimalCurrencies.has(normalized)) {
    return 3;
  }

  return 2;
}

export function currencyMinorUnitFactor(currency: string) {
  return 10 ** currencyDecimalPrecision(currency);
}

export function roundCurrencyAmountToMinor(
  currency: string,
  amountMajor: number,
) {
  if (!Number.isFinite(amountMajor)) {
    throw new Error("Currency amount must be finite.");
  }

  return Math.round(amountMajor * currencyMinorUnitFactor(currency));
}

export function formatCurrency(input: {
  amountMinor: number;
  currency: string;
  locale: string;
}) {
  const currency = normalizeCurrency(input.currency);
  const amount = input.amountMinor / currencyMinorUnitFactor(currency);

  return new Intl.NumberFormat(input.locale, {
    currency,
    style: "currency",
  }).format(amount);
}

export type ExchangeRate = {
  baseCurrency: string;
  quoteCurrency: string;
  rateMicroUnits: number;
};

export type CurrencyConversionInput = {
  amountMinor: number;
  baseCurrency: string;
  quoteCurrency: string;
  rate: ExchangeRate;
};

export function convertCurrency({
  amountMinor,
  baseCurrency,
  quoteCurrency,
  rate,
}: CurrencyConversionInput) {
  const base = normalizeCurrency(baseCurrency);
  const quote = normalizeCurrency(quoteCurrency);

  if (
    normalizeCurrency(rate.baseCurrency) !== base ||
    normalizeCurrency(rate.quoteCurrency) !== quote
  ) {
    throw new Error("Exchange rate does not match the requested currencies.");
  }

  const majorBase = amountMinor / currencyMinorUnitFactor(base);
  const majorQuote = (majorBase * rate.rateMicroUnits) / 1_000_000;

  return roundCurrencyAmountToMinor(quote, majorQuote);
}
