import express from "express";
import { CATALOG } from "./catalog.js";
import { PricingError, quote, unitPrice } from "./pricing.js";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/catalog", (_req, res) => {
    res.json(CATALOG.map(({ sku, name }) => ({ sku, name })));
  });

  app.get("/prices/:sku", (req, res) => {
    const currency = String(req.query.currency ?? "EUR");
    res.json({ sku: req.params.sku, currency, ...unitPrice(req.params.sku, currency) });
  });

  app.post("/quote", (req, res) => {
    const { currency, lines } = req.body ?? {};
    if (typeof currency !== "string" || !Array.isArray(lines)) {
      throw new PricingError("body must be { currency, lines: [{ sku, quantity }] }", 400);
    }
    res.json(quote(currency, lines));
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof PricingError) return res.status(err.status).json({ error: err.message });
    if (err instanceof SyntaxError) return res.status(400).json({ error: "malformed JSON" });
    console.error(err);
    res.status(500).json({ error: "internal error" });
  });
  return app;
}
