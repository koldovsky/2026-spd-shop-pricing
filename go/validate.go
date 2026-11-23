package main

import (
	"bytes"
	"encoding/json"
	"io"
	"math"
	"mime"
	"net/http"
	"strconv"
	"strings"
)

const bodyShapeMsg = "body must be { currency, lines: [{ sku, quantity }] }"

var errMalformed = &quoteError{http.StatusBadRequest, "malformed JSON"}

// decodeQuoteBody mirrors express.json() (strict) followed by the destructuring in
// src/app.ts: it returns the currency and the raw line values, or the error TS would send.
func decodeQuoteBody(r *http.Request) (string, []any, *quoteError) {
	shape := &quoteError{http.StatusBadRequest, bodyShapeMsg}
	mt, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if mt != "application/json" {
		return "", nil, shape // express.json skips the body: req.body is undefined
	}
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		return "", nil, errMalformed
	}
	if len(raw) == 0 {
		return "", nil, shape // body-parser yields {} for an empty body
	}
	// Strict mode: the first non-whitespace character must open an object or array.
	trimmed := bytes.TrimLeft(raw, " \t\n\r")
	if len(trimmed) == 0 || (trimmed[0] != '{' && trimmed[0] != '[') || !json.Valid(raw) {
		return "", nil, errMalformed
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var body any
	if err := dec.Decode(&body); err != nil {
		return "", nil, errMalformed
	}
	obj, _ := body.(map[string]any)
	currency, okC := obj["currency"].(string)
	lines, okL := obj["lines"].([]any)
	if !okC || !okL {
		return "", nil, shape
	}
	return currency, lines, nil
}

// validateLines applies the per-line TS checks in order (quantity, then SKU);
// the first failing line wins. Callers check empty lines and currency first.
func validateLines(raw []any) ([]quoteLine, *quoteError) {
	out := make([]quoteLine, 0, len(raw))
	for _, item := range raw {
		obj, _ := item.(map[string]any) // non-objects destructure to undefined fields
		skuVal, hasSku := obj["sku"]
		sku := "undefined"
		if hasSku {
			sku = jsString(skuVal)
		}
		qty, ok := jsQuantity(obj["quantity"])
		if !ok {
			return nil, &quoteError{http.StatusUnprocessableEntity, "quantity for " + sku + " must be 1..100"}
		}
		s, isStr := skuVal.(string)
		if _, found := FindProduct(s); !isStr || !found {
			return nil, &quoteError{http.StatusNotFound, "unknown sku " + sku}
		}
		out = append(out, quoteLine{SKU: s, Quantity: qty})
	}
	return out, nil
}

// jsQuantity applies Number.isInteger(q) && 1 <= q <= 100 to a decoded JSON value.
// The literal is converted the way JS does (to a double) only for this check.
func jsQuantity(v any) (int64, bool) {
	n, ok := v.(json.Number)
	if !ok {
		return 0, false
	}
	f, err := strconv.ParseFloat(string(n), 64)
	if err != nil || f != math.Trunc(f) || f < 1 || f > 100 {
		return 0, false
	}
	return int64(f), true
}

// jsString renders a decoded JSON value like a JS template literal does.
func jsString(v any) string {
	switch t := v.(type) {
	case nil:
		return "null"
	case string:
		return t
	case bool:
		return strconv.FormatBool(t)
	case json.Number:
		f, err := strconv.ParseFloat(string(t), 64)
		if err != nil && !math.IsInf(f, 0) {
			return string(t)
		}
		return jsNumber(f)
	case []any:
		parts := make([]string, len(t))
		for i, e := range t {
			if e != nil {
				parts[i] = jsString(e)
			}
		}
		return strings.Join(parts, ",")
	default:
		return "[object Object]"
	}
}

// jsNumber formats a double like JS Number.prototype.toString.
func jsNumber(f float64) string {
	switch {
	case math.IsInf(f, 1):
		return "Infinity"
	case math.IsInf(f, -1):
		return "-Infinity"
	case f == 0:
		return "0"
	}
	if a := math.Abs(f); a >= 1e21 || a < 1e-6 {
		s := strconv.FormatFloat(f, 'e', -1, 64) // e.g. 1e+21, 1.5e-07
		mant, exp, _ := strings.Cut(s, "e")
		sign, digits := exp[:1], strings.TrimLeft(exp[1:], "0")
		return mant + "e" + sign + digits
	}
	return strconv.FormatFloat(f, 'f', -1, 64)
}
