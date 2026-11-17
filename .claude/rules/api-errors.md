---
paths:
  - "src/**/*.ts"
---
<!-- owner: @koldovsky · review-by: 2027-02-19 -->
# API errors (local copy — shop-pricing version)

- Errors are JSON `{ "error": "<message>" }`.
- 400 for anything the client sent wrong, including business rule violations.
- Unknown SKU is 404.
