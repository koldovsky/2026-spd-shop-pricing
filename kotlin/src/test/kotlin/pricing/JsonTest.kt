package pricing

import java.math.BigDecimal
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class JsonTest {
    private fun obj(text: String) = Json.parseStrict(text) as JsonObject
    private fun num(text: String) = (Json.parse(text) as JsonNumber).jsValue
    private fun assertNum(expected: String, text: String) =
        assertEquals(0, BigDecimal(expected).compareTo(num(text)), text)

    @Test fun `parses a quote body`() {
        val body = obj("""{"currency":"EUR","lines":[{"sku":"SKU-1","quantity":2}]}""")
        assertEquals(JsonString("EUR"), body["currency"])
        val line = (body["lines"] as JsonArray).items.single() as JsonObject
        assertEquals(JsonString("SKU-1"), line["sku"])
        assertEquals(JsonNumber("2"), line["quantity"])
    }

    @Test fun `literals and whitespace`() {
        assertEquals(
            JsonArray(listOf(JsonBool(true), JsonBool(false), JsonNull, JsonObject(emptyMap()), JsonArray(emptyList()))),
            Json.parseStrict(" \t\r\n[ true , false,null,{ },[]]\n "),
        )
    }

    @Test fun `last duplicate key wins and keeps first position`() {
        val o = obj("""{"a":1,"b":2,"a":3}""")
        assertEquals(listOf("a", "b"), o.fields.keys.toList())
        assertEquals(JsonNumber("3"), o["a"])
    }

    @Test fun `string escapes including surrogate pairs and lone surrogates`() {
        val o = obj("""{"s":"\"\\\/\b\f\n\r\t\u0041\uD83D\uDE00\ud800"}""")
        assertEquals("\"\\/\b\u000C\n\r\tA\uD83D\uDE00\uD800", (o["s"] as JsonString).value)
        assertEquals(JsonString("é€"), Json.parse("\"é€\""))
    }

    @Test fun `numbers follow the JS double view`() {
        assertNum("100", "1e2")
        assertNum("100", "1E+2")
        assertNum("1", "1.0")
        assertNum("100", "100.0000000000000001")
        assertNum("0", "-0")
        assertNum("1.5", "1.5")
        assertNum("-3", "-3")
        assertNum("1E+21", "1e21")
        assertNum("0", "1e-400")
        assertNull(num("1e400"))
        assertNull(num("-1e400"))
    }

    @Test fun `strict top level must be object or array`() {
        for (t in listOf("1", "\"x\"", "true", "null", "", "   ")) {
            assertFailsWith<JsonSyntaxError>(t) { Json.parseStrict(t) }
        }
    }

    @Test fun `rejects malformed input`() {
        val bad = listOf(
            "{", "[1,]", "{\"a\":1,}", "{'a':1}", "{a:1}", "[01]", "[1.]", "[.5]", "[+1]", "[1e]", "[-]",
            "[NaN]", "[Infinity]", "[tru]", "[\"a\u0001\"]", "[\"\\x\"]", "[\"\\u12G4\"]", "[\"\\u12\"]", "[\"abc",
            "{} x", "[1]]", "{\"a\" 1}", "[1 2]", "\u00A0[]", "[]\u00A0", "[,1]", "{,}",
        )
        for (t in bad) assertFailsWith<JsonSyntaxError>(t) { Json.parseStrict(t) }
    }

    @Test fun `writer escapes like JSON stringify`() {
        assertEquals(
            "\"a\\\"\\\\\\n\\u001f\\ud800\uD83D\uDE00/\u007f\"",
            Json.write("a\"\\\n\u001f\uD800\uD83D\uDE00/\u007f"),
        )
        assertEquals("""{"n":[1,-2,10788]}""", Json.write(mapOf("n" to listOf(1, -2L, BigDecimal("10788.00")))))
        assertFailsWith<ArithmeticException> { Json.write(BigDecimal("1.5")) }
    }
}
