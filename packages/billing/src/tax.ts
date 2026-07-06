import { normalizeCurrency } from "./currency";
import type { BillingTaxBehavior } from "./types";

export type TaxCalculationLine = {
  amountMinor: number;
  currency: string;
  description: string;
  quantity: number;
  taxBehavior: BillingTaxBehavior;
};

export type TaxRateRule = {
  country: string;
  inclusive: boolean;
  percentageBasisPoints: number;
  region?: string;
  taxType: string;
};

export type TaxCustomer = {
  billingCountry?: string;
  billingRegion?: string;
  reverseCharge?: boolean;
  taxExempt?: boolean;
  taxId?: string;
};

export type TaxCalculationInput = {
  customer: TaxCustomer;
  lines: TaxCalculationLine[];
  rules: TaxRateRule[];
};

export type TaxCalculationResult = {
  lines: Array<
    TaxCalculationLine & {
      taxMinor: number;
      totalMinor: number;
      taxBreakdown: Array<{
        amountMinor: number;
        percentageBasisPoints: number;
        taxType: string;
      }>;
    }
  >;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export type TaxProvider = {
  calculateTax(input: TaxCalculationInput): Promise<TaxCalculationResult>;
  key: string;
};

function matchesCustomer(rule: TaxRateRule, customer: TaxCustomer) {
  const country = customer.billingCountry?.trim().toUpperCase();
  const region = customer.billingRegion?.trim().toUpperCase();

  if (!country || rule.country.trim().toUpperCase() !== country) {
    return false;
  }

  if (!rule.region) {
    return true;
  }

  return rule.region.trim().toUpperCase() === region;
}

function calculateLineTax(line: TaxCalculationLine, rule?: TaxRateRule) {
  normalizeCurrency(line.currency);

  if (!rule || line.taxBehavior === "unspecified") {
    return {
      taxBreakdown: [],
      taxMinor: 0,
      totalMinor: line.amountMinor,
    };
  }

  const rate = rule.percentageBasisPoints / 10_000;
  const taxMinor =
    line.taxBehavior === "inclusive" || rule.inclusive
      ? Math.round(line.amountMinor - line.amountMinor / (1 + rate))
      : Math.round(line.amountMinor * rate);
  const totalMinor =
    line.taxBehavior === "inclusive" || rule.inclusive
      ? line.amountMinor
      : line.amountMinor + taxMinor;

  return {
    taxBreakdown: [
      {
        amountMinor: taxMinor,
        percentageBasisPoints: rule.percentageBasisPoints,
        taxType: rule.taxType,
      },
    ],
    taxMinor,
    totalMinor,
  };
}

export function createManualTaxProvider(): TaxProvider {
  return {
    async calculateTax(input) {
      const rule =
        input.customer.taxExempt || input.customer.reverseCharge
          ? undefined
          : input.rules.find((candidate) =>
              matchesCustomer(candidate, input.customer),
            );
      const lines = input.lines.map((line) => {
        const calculated = calculateLineTax(line, rule);

        return {
          ...line,
          ...calculated,
        };
      });

      return {
        lines,
        subtotalMinor: lines.reduce(
          (total, line) => total + line.amountMinor,
          0,
        ),
        taxMinor: lines.reduce((total, line) => total + line.taxMinor, 0),
        totalMinor: lines.reduce((total, line) => total + line.totalMinor, 0),
      };
    },
    key: "manual",
  };
}
