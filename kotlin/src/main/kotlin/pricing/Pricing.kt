package pricing

import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode

/**
 * Pricing rules, mirrored from the TS service (src/pricing.ts):
 *  1. Convert the EUR base price at a fixed rate.
 *  2. Line discounts: 15% promo on SKU-3; 5% when a line has 10+ units (the larger one applies, not both).
 *  3. Cart discount: 3% on the discounted subtotal when it reaches 200.00 in EUR terms.
 *  4. VAT 20% on the result.
 * Rounding happens once per line and once per total, half-even (ADR-007).
 */
val RATES: Map<String, BigDecimal> = mapOf(
    "EUR" to BigDecimal.ONE,
    "USD" to BigDecimal("1.0825"),
    "UAH" to BigDecimal("45.6"),
)
private val VAT = BigDecimal("0.20")
private val PROMO: Map<String, BigDecimal> = mapOf("SKU-3" to BigDecimal("0.15"))
private const val BULK_UNITS = 10
private val BULK = BigDecimal("0.05")
private val CART_THRESHOLD_EUR = BigDecimal(200)
private val CART = BigDecimal("0.03")
private val HUNDRED = BigDecimal(100)

/** decimal.js default: 20 significant digits, half-even; used for division only (products are exact). */
private val DIV = MathContext(20, RoundingMode.HALF_EVEN)

class PricingError(message: String, val status: Int) : RuntimeException(message)

/** [quantity] is null when the request value is not a number; [sku] is the JS string form of the value. */
data class QuoteLine(val sku: String, val quantity: BigDecimal?)

data class PricedLine(val sku: String, val quantity: BigDecimal, val unitCents: Long, val discountCents: Long, val lineCents: Long)

data class Quote(
    val currency: String,
    val lines: List<PricedLine>,
    val subtotalCents: Long,
    val cartDiscountCents: Long,
    val taxCents: Long,
    val totalCents: Long,
)

private fun rate(currency: String): BigDecimal =
    RATES[currency] ?: throw PricingError("unsupported currency $currency", 422)

private fun cents(d: BigDecimal): Long = d.setScale(0, RoundingMode.HALF_EVEN).longValueExact()

private fun isInteger(q: BigDecimal): Boolean = q.signum() == 0 || q.stripTrailingZeros().scale() <= 0

fun unitPrice(sku: String, currency: String): Long {
    val product = findProduct(sku) ?: throw PricingError("unknown sku $sku", 404)
    return cents(BigDecimal(product.baseEurCents).multiply(rate(currency)))
}

fun quote(currency: String, lines: List<QuoteLine>): Quote {
    if (lines.isEmpty()) throw PricingError("at least one line is required", 422)
    val r = rate(currency)
    val priced = lines.map { (sku, quantity) ->
        if (quantity == null || !isInteger(quantity) || quantity < BigDecimal.ONE || quantity > HUNDRED) {
            throw PricingError("quantity for $sku must be 1..100", 422)
        }
        val product = findProduct(sku) ?: throw PricingError("unknown sku $sku", 404)
        val unit = BigDecimal(product.baseEurCents).multiply(r)
        val gross = unit.multiply(quantity)
        val bulk = if (quantity >= BigDecimal(BULK_UNITS)) BULK else BigDecimal.ZERO
        val pct = (PROMO[sku] ?: BigDecimal.ZERO).max(bulk)
        val discount = gross.multiply(pct)
        PricedLine(sku, quantity, cents(unit), cents(discount), cents(gross.subtract(discount)))
    }
    val subtotal = priced.fold(BigDecimal.ZERO) { s, l -> s.add(BigDecimal(l.lineCents)) }
    val subtotalEur = subtotal.divide(r, DIV).divide(HUNDRED, DIV)
    val cartDiscount = if (subtotalEur >= CART_THRESHOLD_EUR) subtotal.multiply(CART) else BigDecimal.ZERO
    val taxable = subtotal.subtract(BigDecimal(cents(cartDiscount)))
    val tax = taxable.multiply(VAT)
    return Quote(
        currency = currency,
        lines = priced,
        subtotalCents = cents(subtotal),
        cartDiscountCents = cents(cartDiscount),
        taxCents = cents(tax),
        totalCents = cents(taxable.add(BigDecimal(cents(tax)))),
    )
}
