package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestQuote(t *testing.T) {
	// want: unit, discount, line of the first line; subtotal, cart discount, tax, total.
	cases := []struct {
		name     string
		currency string
		lines    []quoteLine
		want     [7]int64
	}{
		{"vitest small cart", "EUR", []quoteLine{{"SKU-1", 1}}, [7]int64{8990, 0, 8990, 8990, 0, 1798, 10788}},
		{"vitest promo beats bulk", "EUR", []quoteLine{{"SKU-3", 10}}, [7]int64{24900, 37350, 211650, 211650, 6350, 41060, 246360}},
		{"promo below bulk", "EUR", []quoteLine{{"SKU-3", 9}}, [7]int64{24900, 33615, 190485, 190485, 5715, 36954, 221724}},
		{"vitest cart discount", "EUR", []quoteLine{{"SKU-2", 2}}, [7]int64{12950, 0, 25900, 25900, 777, 5025, 30148}},
		{"trap-cart-discount-tie-even", "EUR", []quoteLine{{"SKU-1", 5}}, [7]int64{8990, 0, 44950, 44950, 1348, 8720, 52322}},
		{"trap-cart-discount-tie-odd", "EUR", []quoteLine{{"SKU-2", 3}}, [7]int64{12950, 0, 38850, 38850, 1166, 7537, 45221}},
		{"trap-line-discount-tie-even", "EUR", []quoteLine{{"SKU-1", 11}}, [7]int64{8990, 4944, 93946, 93946, 2818, 18226, 109354}},
		{"trap-line-total-tie-even", "EUR", []quoteLine{{"SKU-1", 13}}, [7]int64{8990, 5844, 111026, 111026, 3331, 21539, 129234}},
		{"trap-round-unit-first", "USD", []quoteLine{{"SKU-1", 2}}, [7]int64{9732, 0, 19463, 19463, 0, 3893, 23356}},
		{"trap-subtract-rounded", "USD", []quoteLine{{"SKU-1", 16}}, [7]int64{9732, 7785, 147921, 147921, 4438, 28697, 172180}},
		{"bulk 9 units", "EUR", []quoteLine{{"SKU-1", 9}}, [7]int64{8990, 0, 80910, 80910, 2427, 15697, 94180}},
		{"bulk 10 units", "EUR", []quoteLine{{"SKU-1", 10}}, [7]int64{8990, 4495, 85405, 85405, 2562, 16569, 99412}},
		{"threshold below EUR 199.98", "EUR", []quoteLine{{"SKU-4", 6}}, [7]int64{3333, 0, 19998, 19998, 0, 4000, 23998}},
		{"threshold above EUR", "EUR", []quoteLine{{"SKU-5", 5}}, [7]int64{4125, 0, 20625, 20625, 619, 4001, 24007}},
		{"threshold below USD", "USD", []quoteLine{{"SKU-4", 6}}, [7]int64{3608, 0, 21648, 21648, 0, 4330, 25978}},
		{"threshold above USD", "USD", []quoteLine{{"SKU-5", 5}}, [7]int64{4465, 0, 22327, 22327, 670, 4331, 25988}},
		{"threshold below UAH", "UAH", []quoteLine{{"SKU-4", 6}}, [7]int64{151985, 0, 911909, 911909, 0, 182382, 1094291}},
		{"threshold above UAH", "UAH", []quoteLine{{"SKU-5", 5}}, [7]int64{188100, 0, 940500, 940500, 28215, 182457, 1094742}},
		{"quantity 100", "EUR", []quoteLine{{"SKU-5", 100}}, [7]int64{4125, 20625, 391875, 391875, 11756, 76024, 456143}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			q, err := quote(c.currency, c.lines)
			if err != nil {
				t.Fatalf("error %v", err)
			}
			l := q.Lines[0]
			got := [7]int64{l.UnitCents, l.DiscountCents, l.LineCents, q.SubtotalCents, q.CartDiscountCents, q.TaxCents, q.TotalCents}
			if got != c.want {
				t.Fatalf("got %v, want %v", got, c.want)
			}
		})
	}
}

func TestQuoteLinesNotMerged(t *testing.T) {
	q, err := quote("EUR", []quoteLine{{"SKU-1", 5}, {"SKU-1", 5}})
	if err != nil || len(q.Lines) != 2 || q.Lines[0].DiscountCents != 0 || q.SubtotalCents != 89900 {
		t.Fatalf("got %+v %v", q, err)
	}
}

func TestQuoteHTTP(t *testing.T) {
	srv := NewServer()
	req := httptest.NewRequest(http.MethodPost, "/quote", strings.NewReader(`{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1}]}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	var q quoteResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &q); err != nil || q.TotalCents != 10788 || q.Currency != "EUR" {
		t.Fatalf("body %s", rec.Body)
	}
}
