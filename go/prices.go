package main

import (
	"math/big"
	"net/http"
	"strings"
)

type priceResponse struct {
	SKU       string `json:"sku"`
	Currency  string `json:"currency"`
	BaseCents int64  `json:"baseCents"`
}

type apiError struct {
	Error string `json:"error"`
}

// unitPrice mirrors src/pricing.ts unitPrice: SKU first (404), then currency (422).
// On success status is 0.
func unitPrice(sku, currency string) (baseCents int64, status int, msg string) {
	p, ok := FindProduct(sku)
	if !ok {
		return 0, http.StatusNotFound, "unknown sku " + sku
	}
	rate, ok := Rates[currency]
	if !ok {
		return 0, http.StatusUnprocessableEntity, "unsupported currency " + currency
	}
	return cents(new(big.Rat).Mul(new(big.Rat).SetInt64(p.BaseEurCents), rate)), 0, ""
}

// queryCurrency matches Express 5 String(req.query.currency ?? "EUR"): absent
// key -> EUR, repeated key -> values joined with ",". Keys match exactly.
func queryCurrency(r *http.Request) string {
	vals, ok := r.URL.Query()["currency"]
	if !ok {
		return "EUR"
	}
	return strings.Join(vals, ",")
}

func handlePrice(w http.ResponseWriter, r *http.Request) {
	sku := r.PathValue("sku")
	currency := queryCurrency(r)
	base, status, msg := unitPrice(sku, currency)
	if status != 0 {
		writeJSON(w, status, apiError{msg})
		return
	}
	writeJSON(w, http.StatusOK, priceResponse{sku, currency, base})
}
