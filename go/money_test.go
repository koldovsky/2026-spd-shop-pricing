package main

import "testing"

func TestCentsHalfEven(t *testing.T) {
	cases := map[string]int64{
		"0.5": 1, "1.5": 2, "2.5": 3, "3.5": 4, // ties go to even, both ways
		"2.4999": 2, "2.5001": 3, "0": 0, "7": 7,
		"-0.5": -1, "-1.5": -2, "-2.5": -3, "-2.6": -3, "-2.4": -2,
	}
	for in, want := range cases {
		if got := cents(ratOf(in)); got != want {
			t.Errorf("cents(%s) = %d, want %d", in, got, want)
		}
	}
}

func TestCentsUnitConversion(t *testing.T) {
	r := ratOf("3333")
	r.Mul(r, Rates["USD"])
	if got := cents(r); got != 3608 {
		t.Fatalf("3333 x 1.0825 = %d, want 3608", got)
	}
}
