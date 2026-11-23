package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func postQuote(t *testing.T, contentType, body string) (int, string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/quote", strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	rec := httptest.NewRecorder()
	NewServer().ServeHTTP(rec, req)
	var out struct {
		Error string `json:"error"`
	}
	json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out.Error
}

func TestQuoteValidation(t *testing.T) {
	const js = "application/json"
	shape := bodyShapeMsg
	cases := []struct {
		name, ct, body string
		status         int
		msg            string
	}{
		{"malformed", js, `{"currency":`, 400, "malformed JSON"},
		{"top-level null", js, `null`, 400, "malformed JSON"},
		{"top-level string", js, `"x"`, 400, "malformed JSON"},
		{"trailing garbage", js, `{} x`, 400, "malformed JSON"},
		{"empty body", js, ``, 400, shape},
		{"array body", js, `[]`, 400, shape},
		{"text/plain", "text/plain", `{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1}]}`, 400, shape},
		{"no content type", "", `{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1}]}`, 400, shape},
		{"currency number", js, `{"currency":1,"lines":[]}`, 400, shape},
		{"lines object", js, `{"currency":"EUR","lines":{}}`, 400, shape},
		{"empty lines before currency", js, `{"currency":"GBP","lines":[]}`, 422, "at least one line is required"},
		{"currency before lines", js, `{"currency":"GBP","lines":[{"sku":"SKU-9","quantity":0}]}`, 422, "unsupported currency GBP"},
		{"quantity 0", js, `{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":0}]}`, 422, "quantity for SKU-1 must be 1..100"},
		{"quantity 101", js, `{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":101}]}`, 422, "quantity for SKU-1 must be 1..100"},
		{"quantity 1.5", js, `{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1.5}]}`, 422, "quantity for SKU-1 must be 1..100"},
		{"quantity 1e3", js, `{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1e3}]}`, 422, "quantity for SKU-1 must be 1..100"},
		{"quantity string", js, `{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":"1"}]}`, 422, "quantity for SKU-1 must be 1..100"},
		{"quantity null", js, `{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":null}]}`, 422, "quantity for SKU-1 must be 1..100"},
		{"quantity missing, sku missing", js, `{"currency":"EUR","lines":[{}]}`, 422, "quantity for undefined must be 1..100"},
		{"line is string", js, `{"currency":"EUR","lines":["SKU-1"]}`, 422, "quantity for undefined must be 1..100"},
		{"sku null", js, `{"currency":"EUR","lines":[{"sku":null,"quantity":0}]}`, 422, "quantity for null must be 1..100"},
		{"sku array", js, `{"currency":"EUR","lines":[{"sku":["a",null,1],"quantity":0}]}`, 422, "quantity for a,,1 must be 1..100"},
		{"sku object", js, `{"currency":"EUR","lines":[{"sku":{},"quantity":0}]}`, 422, "quantity for [object Object] must be 1..100"},
		{"sku number", js, `{"currency":"EUR","lines":[{"sku":1,"quantity":1}]}`, 404, "unknown sku 1"},
		{"sku 1e21", js, `{"currency":"EUR","lines":[{"sku":1e21,"quantity":1}]}`, 404, "unknown sku 1e+21"},
		{"sku 1.50", js, `{"currency":"EUR","lines":[{"sku":1.50,"quantity":1}]}`, 404, "unknown sku 1.5"},
		{"sku case-sensitive", js, `{"currency":"EUR","lines":[{"sku":"sku-1","quantity":1}]}`, 404, "unknown sku sku-1"},
		{"quantity before sku", js, `{"currency":"EUR","lines":[{"sku":"SKU-9","quantity":0}]}`, 422, "quantity for SKU-9 must be 1..100"},
		{"first failing line wins", js, `{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1},{"sku":"SKU-2","quantity":0},{"sku":"SKU-9","quantity":1}]}`, 422, "quantity for SKU-2 must be 1..100"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			status, msg := postQuote(t, c.ct, c.body)
			if status != c.status || msg != c.msg {
				t.Fatalf("got %d %q, want %d %q", status, msg, c.status, c.msg)
			}
		})
	}
}

func TestQuoteAcceptsIntegerLiterals(t *testing.T) {
	// Boundary values and JS-integer literals: 1, 100, 1.0, 1e2 are all accepted.
	for _, q := range []string{"1", "100", "1.0", "1e2", "100.000"} {
		status, msg := postQuote(t, "application/json; charset=utf-8",
			`{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":`+q+`}]}`)
		if status != http.StatusOK {
			t.Fatalf("quantity %s: got %d %q", q, status, msg)
		}
	}
}

func TestJSQuantityEcho(t *testing.T) {
	if q, ok := jsQuantity(json.Number("1e2")); !ok || q != 100 {
		t.Fatalf("1e2 -> %d %v", q, ok)
	}
	if _, ok := jsQuantity(json.Number("1e400")); ok {
		t.Fatal("1e400 must be rejected")
	}
}
