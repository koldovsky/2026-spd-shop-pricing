package pricing

import java.math.BigDecimal
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class PricingTest {
    private fun line(sku: String, qty: Int) = QuoteLine(sku, BigDecimal(qty))
    private fun one(currency: String, sku: String, qty: Int) = quote(currency, listOf(line(sku, qty)))

    private fun assertError(status: Int, message: String, block: () -> Unit) {
        val e = assertFailsWith<PricingError> { block() }
        assertEquals(status, e.status)
        assertEquals(message, e.message)
    }

    // src/pricing.test.ts restated

    @Test
    fun `unit price in EUR is the base price`() = assertEquals(24900, unitPrice("SKU-3", "EUR"))

    @Test
    fun `unit price converts at the fixed rate and rounds half-even`() = assertEquals(3608, unitPrice("SKU-4", "USD"))

    @Test
    fun `small cart with VAT and no cart discount`() {
        val q = one("EUR", "SKU-1", 1)
        assertEquals(listOf(8990L, 0L, 1798L, 10788L), listOf(q.subtotalCents, q.cartDiscountCents, q.taxCents, q.totalCents))
        assertEquals(PricedLine("SKU-1", BigDecimal(1), 8990, 0, 8990), q.lines.single())
    }

    @Test
    fun `larger line discount wins, not both`() = assertEquals(37350, one("EUR", "SKU-3", 10).lines[0].discountCents)

    @Test
    fun `cart discount from 200 EUR`() = assertEquals(777, one("EUR", "SKU-2", 2).cartDiscountCents)

    // Bulk boundary

    @Test
    fun `9 units get no bulk discount, 10 units get 5 percent`() {
        assertEquals(0, one("EUR", "SKU-1", 9).lines[0].discountCents)
        val ten = one("EUR", "SKU-1", 10).lines[0]
        assertEquals(4495, ten.discountCents)
        assertEquals(85405, ten.lineCents)
    }

    @Test
    fun `promo applies below the bulk threshold`() = assertEquals(3735, one("EUR", "SKU-3", 1).lines[0].discountCents)

    // Cart threshold just below and above 200 EUR in each currency

    @Test
    fun `cart threshold in EUR`() {
        assertEquals(0, one("EUR", "SKU-1", 2).cartDiscountCents) // 179.80
        val q = quote("EUR", listOf(line("SKU-1", 1), line("SKU-2", 1))) // 219.40
        assertEquals(listOf(21940L, 658L, 4256L, 25538L), listOf(q.subtotalCents, q.cartDiscountCents, q.taxCents, q.totalCents))
    }

    @Test
    fun `cart threshold in USD`() {
        assertEquals(0, one("USD", "SKU-1", 2).cartDiscountCents)
        val q = quote("USD", listOf(line("SKU-1", 1), line("SKU-2", 1)))
        assertEquals(23750, q.subtotalCents)
        assertEquals(712, q.cartDiscountCents) // 712.5 -> 712 half-even
    }

    @Test
    fun `cart threshold in UAH`() {
        assertEquals(0, one("UAH", "SKU-1", 2).cartDiscountCents)
        val q = quote("UAH", listOf(line("SKU-1", 1), line("SKU-2", 1)))
        assertEquals(1000464, q.subtotalCents)
        assertEquals(30014, q.cartDiscountCents)
    }

    // Rounding traps

    @Test
    fun `trap - cart discount ties round half-even`() = assertEquals(1348, one("EUR", "SKU-1", 5).cartDiscountCents) // 1348.5

    @Test
    fun `trap - unit is not rounded before multiplying`() {
        val l = one("USD", "SKU-1", 2).lines[0] // 9731.675 * 2 = 19463.35
        assertEquals(9732, l.unitCents)
        assertEquals(19463, l.lineCents)
    }

    @Test
    fun `trap - line is rounded once, not gross minus rounded discount`() {
        val l = one("USD", "SKU-5", 11).lines[0] // 49118.4375 - 2455.921875 = 46662.515625
        assertEquals(2456, l.discountCents)
        assertEquals(46663, l.lineCents)
    }

    // Validation and its order

    @Test
    fun `quantity 1 and 100 are accepted, 0 and 101 rejected`() {
        assertEquals(1, one("EUR", "SKU-1", 1).lines.size)
        assertEquals(1, one("USD", "SKU-5", 100).lines.size)
        assertError(422, "quantity for SKU-1 must be 1..100") { one("EUR", "SKU-1", 0) }
        assertError(422, "quantity for SKU-1 must be 1..100") { one("EUR", "SKU-1", 101) }
    }

    @Test
    fun `integral decimals are integers, fractions and non-numbers are not`() {
        assertEquals(8990, quote("EUR", listOf(QuoteLine("SKU-1", BigDecimal("1.0")))).subtotalCents)
        assertError(422, "quantity for SKU-1 must be 1..100") { quote("EUR", listOf(QuoteLine("SKU-1", BigDecimal("1.5")))) }
        assertError(422, "quantity for SKU-1 must be 1..100") { quote("EUR", listOf(QuoteLine("SKU-1", null))) }
    }

    @Test
    fun `errors and their order`() {
        assertError(422, "at least one line is required") { quote("GBP", emptyList()) }
        assertError(422, "unsupported currency GBP") { quote("GBP", listOf(line("SKU-9", 0))) }
        assertError(422, "quantity for SKU-9 must be 1..100") { quote("EUR", listOf(line("SKU-9", 0))) }
        assertError(404, "unknown sku SKU-9") { quote("EUR", listOf(line("SKU-1", 1), line("SKU-9", 1))) }
        assertError(404, "unknown sku SKU-9") { unitPrice("SKU-9", "GBP") }
        assertError(422, "unsupported currency eur") { unitPrice("SKU-1", "eur") }
    }
}
