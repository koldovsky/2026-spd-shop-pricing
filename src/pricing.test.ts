import { describe, expect, it } from "vitest";
import { quote, unitPrice } from "./pricing.js";

describe("unit prices", () => {
  it("returns the base price in EUR", () => {
    expect(unitPrice("SKU-3", "EUR")).toEqual({ baseCents: 24900 });
  });
  it("converts at the fixed rate and rounds half-even", () => {
    // 3333 * 1.0825 = 3607.9725 -> 3608
    expect(unitPrice("SKU-4", "USD").baseCents).toBe(3608);
  });
});

describe("quote", () => {
  it("prices a small cart with VAT and no cart discount", () => {
    const q = quote("EUR", [{ sku: "SKU-1", quantity: 1 }]);
    expect(q).toMatchObject({ subtotalCents: 8990, cartDiscountCents: 0, taxCents: 1798, totalCents: 10788 });
  });
  it("uses the larger line discount, not both", () => {
    const q = quote("EUR", [{ sku: "SKU-3", quantity: 10 }]);
    expect(q.lines[0].discountCents).toBe(37350); // 15% of 249000, not 20%
  });
  it("adds the 3% cart discount from 200.00 EUR", () => {
    const q = quote("EUR", [{ sku: "SKU-2", quantity: 2 }]); // 259.00
    expect(q.cartDiscountCents).toBe(777);
  });
  it("rejects quantity 0", () => {
    expect(() => quote("EUR", [{ sku: "SKU-1", quantity: 0 }])).toThrow(/1..100/);
  });
  it("rejects an unknown currency", () => {
    expect(() => quote("GBP", [{ sku: "SKU-1", quantity: 1 }])).toThrow(/unsupported/);
  });
});
