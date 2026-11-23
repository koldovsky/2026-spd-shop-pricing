package pricing

import kotlin.test.Test
import kotlin.test.assertEquals

class QuoteHttpTest {
    private val json = "application/json"
    private val shape = "body must be { currency, lines: [{ sku, quantity }] }"

    private fun post(body: String, type: String? = json) = quoteResponse(type, body.toByteArray())
    private fun err(status: Int, msg: String) = JsonResponse(status, Json.write(mapOf("error" to msg)))

    @Test fun `single line quote serializes integers in TS key order`() {
        assertEquals(
            JsonResponse(200, """{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1,"unitCents":8990,""" +
                """"discountCents":0,"lineCents":8990}],"subtotalCents":8990,"cartDiscountCents":0,""" +
                """"taxCents":1798,"totalCents":10788}"""),
            post("""{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1}]}"""),
        )
    }

    @Test fun `cart discount tie rounds half even over HTTP`() {
        val res = post("""{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":5}]}""")
        assertEquals(200, res.status)
        assert(res.body.contains("\"cartDiscountCents\":1348")) { res.body }
    }

    @Test fun `quantity 1e2 and 1 point 0 are integers`() {
        assertEquals(200, post("""{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1e2}]}""").status)
        val res = post("""{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1.0}]}""")
        assert(res.body.contains("\"quantity\":1,")) { res.body }
    }

    @Test fun `content type rules`() {
        val body = """{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":1}]}"""
        assertEquals(200, post(body, "Application/JSON; charset=UTF-8").status)
        assertEquals(err(400, shape), post(body, "text/plain"))
        assertEquals(err(400, shape), post(body, null))
        assertEquals(err(500, "internal error"), post(body, "application/json; charset=latin1"))
    }

    @Test fun `empty body is shape error, blank or scalar body is malformed`() {
        assertEquals(err(400, shape), post(""))
        assertEquals(err(400, "malformed JSON"), post("  "))
        assertEquals(err(400, "malformed JSON"), post("\"x\""))
        assertEquals(err(400, "malformed JSON"), post("{\"currency\":"))
    }

    @Test fun `body over 100 kB fails outside the route`() {
        assertEquals(500, post("[" + " ".repeat(BODY_LIMIT) + "]").status)
    }

    @Test fun `shape needs a string currency and an array of lines`() {
        assertEquals(err(400, shape), post("[1]"))
        assertEquals(err(400, shape), post("""{"currency":1,"lines":[]}"""))
        assertEquals(err(400, shape), post("""{"currency":"EUR","lines":{}}"""))
    }

    @Test fun `pricing validation order empty lines then currency then quantity then sku`() {
        assertEquals(err(422, "at least one line is required"), post("""{"currency":"XXX","lines":[]}"""))
        assertEquals(err(422, "unsupported currency XXX"), post("""{"currency":"XXX","lines":[5]}"""))
        assertEquals(err(422, "quantity for SKU-9 must be 1..100"), post("""{"currency":"EUR","lines":[{"sku":"SKU-9"}]}"""))
        assertEquals(err(404, "unknown sku SKU-9"), post("""{"currency":"EUR","lines":[{"sku":"SKU-9","quantity":100}]}"""))
    }

    @Test fun `non string values use JS stringification`() {
        assertEquals(err(422, "quantity for undefined must be 1..100"), post("""{"currency":"EUR","lines":[5]}"""))
        assertEquals(err(422, "quantity for 1.5 must be 1..100"), post("""{"currency":"EUR","lines":[{"sku":1.5,"quantity":"3"}]}"""))
        assertEquals(err(404, "unknown sku SKU-1"), post("""{"currency":"EUR","lines":[{"sku":["SKU-1"],"quantity":1}]}"""))
        assertEquals("[object Object]", jsString(JsonObject(emptyMap())))
        assertEquals("1e-7", jsString(JsonNumber("1e-7")))
        assertEquals("1e+21", jsString(JsonNumber("1e21")))
        assertEquals("a,,2", jsString(Json.parse("""["a",null,2]""")))
    }

    @Test fun `null line is a TS quirk answered with 500`() {
        assertEquals(err(500, "internal error"), post("""{"currency":"EUR","lines":[null]}"""))
    }
}
