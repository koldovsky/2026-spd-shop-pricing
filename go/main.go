package main

import (
	"log"
	"net/http"
	"os"
)

// listenAddr reads PORT (default 8082) and nothing else.
func listenAddr() string {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}
	return ":" + port
}

func main() {
	addr := listenAddr()
	log.Printf("shop-pricing on %s", addr)
	log.Fatal(http.ListenAndServe(addr, NewServer()))
}
