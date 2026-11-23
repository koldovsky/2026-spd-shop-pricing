package main

import (
	"math/big"
	"net/http"
)

// Pricing constants mirror src/pricing.ts.
var (
	vat              = ratOf("0.20")
	promo            = map[string]*big.Rat{"SKU-3": ratOf("0.15")}
	bulk             = ratOf("0.05")
	cartThresholdEur = ratOf("200")
	cartRate         = ratOf("0.03")
)

const bulkUnits = 10

type quoteLine struct {
	SKU      string `json:"sku"`
	Quantity int64  `json:"quantity"`
}

type pricedLine struct {
	SKU           string `json:"sku"`
	Quantity      int64  `json:"quantity"`
	UnitCents     int64  `json:"unitCents"`
	DiscountCents int64  `json:"discountCents"`
	LineCents     int64  `json:"lineCents"`
}

type quoteResponse struct {
	Currency          string       `json:"currency"`
	Lines             []pricedLine `json:"lines"`
	SubtotalCents     int64        `json:"subtotalCents"`
	CartDiscountCents int64        `json:"cartDiscountCents"`
	TaxCents          int64        `json:"taxCents"`
	TotalCents        int64        `json:"totalCents"`
}

// quoteError carries an HTTP status and message, like PricingError in TS.
type quoteError struct {
	status int
	msg    string
}

func newRat(n int64) *big.Rat { return new(big.Rat).SetInt64(n) }

// quote mirrors src/pricing.ts quote, including the exact rounding order (ADR-007).
// Lines must already have passed validateLines (quantity 1..100); unknown SKUs are still rejected.
func quote(currency string, lines []quoteLine) (*quoteResponse, *quoteError) {
	if qerr := checkCart(currency, len(lines)); qerr != nil {
		return nil, qerr
	}
	rate := Rates[currency]
	priced := make([]pricedLine, 0, len(lines))
	subtotal := new(big.Rat)
	for _, l := range lines {
		p, ok := FindProduct(l.SKU)
		if !ok {
			return nil, &quoteError{http.StatusNotFound, "unknown sku " + l.SKU}
		}
		unit := new(big.Rat).Mul(newRat(p.BaseEurCents), rate)
		gross := new(big.Rat).Mul(unit, newRat(l.Quantity))
		pct := new(big.Rat)
		if pr, ok := promo[l.SKU]; ok {
			pct.Set(pr)
		}
		if l.Quantity >= bulkUnits && bulk.Cmp(pct) > 0 {
			pct.Set(bulk)
		}
		discount := new(big.Rat).Mul(gross, pct)
		line := cents(new(big.Rat).Sub(gross, discount))
		priced = append(priced, pricedLine{l.SKU, l.Quantity, cents(unit), cents(discount), line})
		subtotal.Add(subtotal, newRat(line))
	}
	subtotalEur := new(big.Rat).Quo(subtotal, rate)
	subtotalEur.Quo(subtotalEur, newRat(100))
	cartDiscount := new(big.Rat)
	if subtotalEur.Cmp(cartThresholdEur) >= 0 {
		cartDiscount.Mul(subtotal, cartRate)
	}
	taxable := new(big.Rat).Sub(subtotal, newRat(cents(cartDiscount)))
	tax := new(big.Rat).Mul(taxable, vat)
	total := new(big.Rat).Add(taxable, newRat(cents(tax)))
	return &quoteResponse{
		Currency:          currency,
		Lines:             priced,
		SubtotalCents:     cents(subtotal),
		CartDiscountCents: cents(cartDiscount),
		TaxCents:          cents(tax),
		TotalCents:        cents(total),
	}, nil
}

// checkCart applies the cart-level TS checks in order: empty lines, then currency.
func checkCart(currency string, n int) *quoteError {
	if n == 0 {
		return &quoteError{http.StatusUnprocessableEntity, "at least one line is required"}
	}
	if _, ok := Rates[currency]; !ok {
		return &quoteError{http.StatusUnprocessableEntity, "unsupported currency " + currency}
	}
	return nil
}

func handleQuote(w http.ResponseWriter, r *http.Request) {
	q, qerr := handleQuoteBody(r)
	if qerr != nil {
		writeJSON(w, qerr.status, apiError{qerr.msg})
		return
	}
	writeJSON(w, http.StatusOK, q)
}

func handleQuoteBody(r *http.Request) (*quoteResponse, *quoteError) {
	currency, raw, qerr := decodeQuoteBody(r)
	if qerr != nil {
		return nil, qerr
	}
	if qerr := checkCart(currency, len(raw)); qerr != nil {
		return nil, qerr
	}
	lines, qerr := validateLines(raw)
	if qerr != nil {
		return nil, qerr
	}
	return quote(currency, lines)
}
