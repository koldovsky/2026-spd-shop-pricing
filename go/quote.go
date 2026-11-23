package main

import (
	"encoding/json"
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
// Validation here is minimal; the full TS validation order is slice 4.
func quote(currency string, lines []quoteLine) (*quoteResponse, *quoteError) {
	if len(lines) == 0 {
		return nil, &quoteError{http.StatusUnprocessableEntity, "at least one line is required"}
	}
	rate, ok := Rates[currency]
	if !ok {
		return nil, &quoteError{http.StatusUnprocessableEntity, "unsupported currency " + currency}
	}
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

func handleQuote(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Currency *string     `json:"currency"`
		Lines    []quoteLine `json:"lines"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, apiError{"malformed JSON"})
		return
	}
	if body.Currency == nil || body.Lines == nil {
		writeJSON(w, http.StatusBadRequest, apiError{"body must be { currency, lines: [{ sku, quantity }] }"})
		return
	}
	q, qerr := quote(*body.Currency, body.Lines)
	if qerr != nil {
		writeJSON(w, qerr.status, apiError{qerr.msg})
		return
	}
	writeJSON(w, http.StatusOK, q)
}
