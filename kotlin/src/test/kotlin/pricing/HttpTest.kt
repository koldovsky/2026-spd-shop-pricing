package pricing

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class HttpTest {
    private fun ok(sku: String, currency: String, cents: Long) =
        JsonResponse(200, """{"sku":"$sku","currency":"$currency","baseCents":$cents}""")

    private fun err(status: Int, msg: String) = JsonResponse(status, """{"error":"$msg"}""")

    @Test fun `prices in every currency`() {
        assertEquals(ok("SKU-1", "EUR", 8990), pricesResponse("SKU-1", "currency=EUR"))
        assertEquals(ok("SKU-1", "USD", 9732), pricesResponse("SKU-1", "currency=USD"))
        assertEquals(ok("SKU-4", "UAH", 151985), pricesResponse("SKU-4", "currency=UAH"))
    }

    @Test fun `missing currency defaults to EUR`() {
        assertEquals(ok("SKU-1", "EUR", 8990), pricesResponse("SKU-1", null))
        assertEquals(ok("SKU-1", "EUR", 8990), pricesResponse("SKU-1", "currency[]=USD"))
        assertEquals(ok("SKU-1", "EUR", 8990), pricesResponse("SKU-1", "Currency=USD"))
    }

    @Test fun `unknown sku is 404 before unsupported currency`() {
        assertEquals(err(404, "unknown sku SKU-9"), pricesResponse("SKU-9", "currency=GBP"))
        assertEquals(err(404, "unknown sku sku-1"), pricesResponse("sku-1", "currency=EUR"))
    }

    @Test fun `unsupported currency is 422`() {
        assertEquals(err(422, "unsupported currency GBP"), pricesResponse("SKU-1", "currency=GBP"))
        assertEquals(err(422, "unsupported currency usd"), pricesResponse("SKU-1", "currency=usd"))
        assertEquals(err(422, "unsupported currency "), pricesResponse("SKU-1", "currency="))
        assertEquals(err(422, "unsupported currency "), pricesResponse("SKU-1", "currency"))
    }

    @Test fun `repeated currency is joined with commas`() {
        assertEquals(err(422, "unsupported currency EUR,USD"), pricesResponse("SKU-1", "currency=EUR&currency=USD"))
        assertEquals(err(422, "unsupported currency EUR,"), pricesResponse("SKU-1", "currency=EUR&currency="))
    }

    @Test fun `query is decoded like node querystring`() {
        assertEquals(ok("SKU-1", "USD", 9732), pricesResponse("SKU-1", "%63urrency=U%53D"))
        assertEquals(ok("SKU-1", "USD", 9732), pricesResponse("SKU-1", "a=1&&currency=USD"))
        assertEquals(err(422, "unsupported currency a b"), pricesResponse("SKU-1", "currency=a+b"))
        assertEquals(err(422, "unsupported currency a&b"), pricesResponse("SKU-1", "currency=a%26b"))
        assertEquals(err(422, "unsupported currency %ZZ"), pricesResponse("SKU-1", "currency=%ZZ"))
        assertEquals(err(422, "unsupported currency US%"), pricesResponse("SKU-1", "currency=US%"))
        assertEquals(err(422, "unsupported currency €"), pricesResponse("SKU-1", "currency=%E2%82%AC"))
    }

    @Test fun `path segment is percent-decoded`() {
        assertEquals(ok("SKU-4", "UAH", 151985), pricesResponse("SKU%2D4", "currency=UAH"))
        assertEquals(err(404, "unknown sku SKU 1"), pricesResponse("SKU%201", null))
        assertEquals(err(404, "unknown sku €"), pricesResponse("%E2%82%AC", null))
        assertEquals(err(404, "unknown sku SKU/1"), pricesResponse("SKU%2F1", null))
        assertEquals(err(404, "unknown sku a+b"), pricesResponse("a+b", null))
    }

    @Test fun `malformed path escape is an internal error`() {
        assertEquals(err(500, "internal error"), pricesResponse("%ZZ", null))
        assertEquals(err(500, "internal error"), pricesResponse("%C0", null))
        assertFailsWith<InternalError> { decodePathSegment("SKU%") }
    }
}
