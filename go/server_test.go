package main

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func serve(method, path string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	NewServer().ServeHTTP(rec, httptest.NewRequest(method, path, nil))
	return rec
}

func TestCatalogShape(t *testing.T) {
	rec := serve("GET", "/catalog")
	if rec.Code != 200 {
		t.Fatalf("status %d", rec.Code)
	}
	var got []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 5 || got[0]["sku"] != "SKU-1" || got[0]["name"] != "Mechanical keyboard" || got[4]["sku"] != "SKU-5" {
		t.Fatalf("unexpected catalog %v", got)
	}
	if len(got[0]) != 2 {
		t.Fatalf("catalog item must have only sku and name: %v", got[0])
	}
}

func TestFindProductCaseSensitive(t *testing.T) {
	if p, ok := FindProduct("SKU-4"); !ok || p.BaseEurCents != 3333 {
		t.Fatalf("SKU-4: %v %v", p, ok)
	}
	if _, ok := FindProduct("sku-4"); ok {
		t.Fatal("lookup must be case-sensitive")
	}
}

func TestDefaultPort(t *testing.T) {
	t.Setenv("PORT", "")
	if got := listenAddr(); got != ":8082" {
		t.Fatalf("got %s", got)
	}
	t.Setenv("PORT", "8090")
	if got := listenAddr(); got != ":8090" {
		t.Fatalf("got %s", got)
	}
}

func TestUnroutedIs404(t *testing.T) {
	for _, c := range [][2]string{{"GET", "/quote"}, {"POST", "/catalog"}, {"GET", "/nope"}, {"GET", "/prices/"}, {"GET", "/prices/SKU-1/extra"}} {
		if rec := serve(c[0], c[1]); rec.Code != 404 {
			t.Errorf("%s %s: status %d, want 404", c[0], c[1], rec.Code)
		}
	}
}
