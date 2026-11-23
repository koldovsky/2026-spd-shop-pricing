package main

import (
	"encoding/json"
	"fmt"
	"html"
	"net/http"
)

type catalogItem struct {
	SKU  string `json:"sku"`
	Name string `json:"name"`
}

// NewServer returns the HTTP handler. Unrouted paths and methods get an
// Express-style 404 (Go's mux would otherwise answer 405 for a known path).
func NewServer() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /catalog", handleCatalog)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, pattern := mux.Handler(r); pattern == "" {
			notFound(w, r)
			return
		}
		mux.ServeHTTP(w, r)
	})
}

func handleCatalog(w http.ResponseWriter, _ *http.Request) {
	items := make([]catalogItem, 0, len(Catalog))
	for _, p := range Catalog {
		items = append(items, catalogItem{p.SKU, p.Name})
	}
	writeJSON(w, http.StatusOK, items)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	body, err := json.Marshal(v)
	if err != nil {
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	w.Write(body)
}

func notFound(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusNotFound)
	fmt.Fprintf(w, "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot %s %s</pre>\n</body>\n</html>\n",
		r.Method, html.EscapeString(r.URL.EscapedPath()))
}
