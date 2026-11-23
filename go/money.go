package main

import "math/big"

// Rates mirror RATES in src/pricing.ts: EUR -> currency, exact decimals.
var Rates = map[string]*big.Rat{
	"EUR": ratOf("1"),
	"USD": ratOf("1.0825"),
	"UAH": ratOf("45.6"),
}

func ratOf(s string) *big.Rat {
	r, ok := new(big.Rat).SetString(s)
	if !ok {
		panic("bad decimal " + s)
	}
	return r
}

// cents rounds r half-even to an integer (ADR-007). No floats involved.
func cents(r *big.Rat) int64 {
	num, den := r.Num(), r.Denom()
	q, m := new(big.Int).QuoRem(num, den, new(big.Int)) // truncated toward zero
	twice := new(big.Int).Abs(m)
	twice.Lsh(twice, 1)
	if c := twice.Cmp(den); c >= 0 {
		if num.Sign() < 0 {
			q.Sub(q, big.NewInt(1))
		} else {
			q.Add(q, big.NewInt(1))
		}
	}
	return q.Int64()
}
