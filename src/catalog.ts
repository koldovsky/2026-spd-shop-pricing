/** Base prices in EUR cents. The catalog is in code on purpose: the demo is about the pricing rules. */
export interface Product { sku: string; name: string; baseEurCents: number }

export const CATALOG: Product[] = [
  { sku: "SKU-1", name: "Mechanical keyboard", baseEurCents: 8990 },
  { sku: "SKU-2", name: "USB-C dock", baseEurCents: 12950 },
  { sku: "SKU-3", name: "27-inch monitor", baseEurCents: 24900 },
  { sku: "SKU-4", name: "Desk lamp", baseEurCents: 3333 },
  { sku: "SKU-5", name: "Laptop stand", baseEurCents: 4125 },
];

export function findProduct(sku: string): Product | undefined {
  return CATALOG.find((p) => p.sku === sku);
}
