package main

// Product mirrors src/catalog.ts: base prices in EUR cents.
type Product struct {
	SKU          string
	Name         string
	BaseEurCents int64
}

// Catalog is in code on purpose, in the same order as the TypeScript reference.
var Catalog = []Product{
	{"SKU-1", "Mechanical keyboard", 8990},
	{"SKU-2", "USB-C dock", 12950},
	{"SKU-3", "27-inch monitor", 24900},
	{"SKU-4", "Desk lamp", 3333},
	{"SKU-5", "Laptop stand", 4125},
}

// FindProduct looks a SKU up case-sensitively.
func FindProduct(sku string) (Product, bool) {
	for _, p := range Catalog {
		if p.SKU == sku {
			return p, true
		}
	}
	return Product{}, false
}
