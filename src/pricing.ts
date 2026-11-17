import { Decimal } from "decimal.js";
import { findProduct } from "./catalog.js";

/**
 * Pricing rules (shop-pricing is the only place prices are computed):
 *  1. Convert the EUR base price at a fixed rate.
 *  2. Line discounts: 15% promo on SKU-3; 5% when a line has 10+ units (the larger one applies, not both).
 *  3. Cart discount: 3% on the discounted subtotal when it reaches 200.00 in EUR terms.
 *  4. VAT 20% on the result.
 *  Arithmetic is decimal; rounding happens once per line and once per total, half-even (ADR-007).
 */
export const RATES: Record<string, Decimal> = {
  EUR: new Decimal(1),
  USD: new Decimal("1.0825"),
  UAH: new Decimal("45.6"),
};
const VAT = new Decimal("0.20");
const PROMO: Record<string, Decimal> = { "SKU-3": new Decimal("0.15") };
const BULK_UNITS = 10;
const BULK = new Decimal("0.05");
const CART_THRESHOLD_EUR = new Decimal(200);
const CART = new Decimal("0.03");

Decimal.set({ rounding: Decimal.ROUND_HALF_EVEN });

export class PricingError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export interface QuoteLine { sku: string; quantity: number }
export interface PricedLine { sku: string; quantity: number; unitCents: number; discountCents: number; lineCents: number }
export interface Quote {
  currency: string; lines: PricedLine[];
  subtotalCents: number; cartDiscountCents: number; taxCents: number; totalCents: number;
}

function rate(currency: string): Decimal {
  const r = RATES[currency];
  if (!r) throw new PricingError(`unsupported currency ${currency}`, 422);
  return r;
}

const cents = (d: Decimal) => d.toDecimalPlaces(0).toNumber();

export function unitPrice(sku: string, currency: string): { baseCents: number } {
  const product = findProduct(sku);
  if (!product) throw new PricingError(`unknown sku ${sku}`, 404);
  return { baseCents: cents(new Decimal(product.baseEurCents).mul(rate(currency))) };
}

export function quote(currency: string, lines: QuoteLine[]): Quote {
  if (lines.length === 0) throw new PricingError("at least one line is required", 422);
  const r = rate(currency);
  const priced = lines.map(({ sku, quantity }) => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new PricingError(`quantity for ${sku} must be 1..100`, 422);
    const product = findProduct(sku);
    if (!product) throw new PricingError(`unknown sku ${sku}`, 404);
    const unit = new Decimal(product.baseEurCents).mul(r);
    const gross = unit.mul(quantity);
    const pct = Decimal.max(PROMO[sku] ?? 0, quantity >= BULK_UNITS ? BULK : 0);
    const discount = gross.mul(pct);
    return { sku, quantity, unitCents: cents(unit), discountCents: cents(discount), lineCents: cents(gross.minus(discount)) };
  });
  const subtotal = priced.reduce((s, l) => s.plus(l.lineCents), new Decimal(0));
  const subtotalEur = subtotal.div(r).div(100);
  const cartDiscount = subtotalEur.gte(CART_THRESHOLD_EUR) ? subtotal.mul(CART) : new Decimal(0);
  const taxable = subtotal.minus(cents(cartDiscount));
  const tax = taxable.mul(VAT);
  return {
    currency,
    lines: priced,
    subtotalCents: cents(subtotal),
    cartDiscountCents: cents(cartDiscount),
    taxCents: cents(tax),
    totalCents: cents(taxable.plus(cents(tax))),
  };
}
