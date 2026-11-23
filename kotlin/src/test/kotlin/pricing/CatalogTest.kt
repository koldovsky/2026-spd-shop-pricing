package pricing

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class CatalogTest {
    @Test
    fun `catalog lists the five products in order with sku and name only`() {
        assertEquals(
            """[{"sku":"SKU-1","name":"Mechanical keyboard"},{"sku":"SKU-2","name":"USB-C dock"},""" +
                """{"sku":"SKU-3","name":"27-inch monitor"},{"sku":"SKU-4","name":"Desk lamp"},""" +
                """{"sku":"SKU-5","name":"Laptop stand"}]""",
            catalogJson(),
        )
    }

    @Test
    fun `finds products by exact sku`() {
        assertEquals(24900, findProduct("SKU-3")?.baseEurCents)
        assertNull(findProduct("sku-3"))
    }

    @Test
    fun `writer escapes strings and keeps integer literals`() {
        assertEquals("""{"a":"q\"\n\u0001","n":10788}""", Json.write(mapOf("a" to "q\"\n\u0001", "n" to 10788.toBigDecimal())))
    }
}
