package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPrices(t *testing.T) {
	cases := []struct {
		path   string
		status int
		want   map[string]any
	}{
		{"/prices/SKU-3?currency=EUR", 200, map[string]any{"sku": "SKU-3", "currency": "EUR", "baseCents": 24900.0}},
		{"/prices/SKU-4?currency=USD", 200, map[string]any{"sku": "SKU-4", "currency": "USD", "baseCents": 3608.0}},
		{"/prices/SKU-4", 200, map[string]any{"sku": "SKU-4", "currency": "EUR", "baseCents": 3333.0}},
		{"/prices/SKU%2D4?currency=UAH", 200, map[string]any{"sku": "SKU-4", "currency": "UAH", "baseCents": 151985.0}},
		{"/prices/SKU-4?currency[]=USD", 200, map[string]any{"sku": "SKU-4", "currency": "EUR", "baseCents": 3333.0}},
		{"/prices/SKU-1?Currency=USD", 200, map[string]any{"sku": "SKU-1", "currency": "EUR", "baseCents": 8990.0}},
		{"/prices/SKU-9?currency=EUR", 404, map[string]any{"error": "unknown sku SKU-9"}},
		{"/prices/sku-1", 404, map[string]any{"error": "unknown sku sku-1"}},
		{"/prices/SKU-9?currency=GBP", 404, map[string]any{"error": "unknown sku SKU-9"}},
		{"/prices/SKU%201", 404, map[string]any{"error": "unknown sku SKU 1"}},
		{"/prices/SKU-1?currency=GBP", 422, map[string]any{"error": "unsupported currency GBP"}},
		{"/prices/SKU-1?currency=", 422, map[string]any{"error": "unsupported currency "}},
		{"/prices/SKU-1?currency=EUR&currency=USD", 422, map[string]any{"error": "unsupported currency EUR,USD"}},
	}
	srv := NewServer()
	for _, c := range cases {
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, c.path, nil))
		if rec.Code != c.status {
			t.Errorf("%s: status %d, want %d", c.path, rec.Code, c.status)
			continue
		}
		var got map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("%s: %v", c.path, err)
		}
		if len(got) != len(c.want) {
			t.Errorf("%s: body %v, want %v", c.path, got, c.want)
		}
		for k, v := range c.want {
			if got[k] != v {
				t.Errorf("%s: %s = %v, want %v", c.path, k, got[k], v)
			}
		}
	}
}
