package pricing

/** Base prices in EUR cents, same products and order as the TS catalog. */
data class Product(val sku: String, val name: String, val baseEurCents: Long)

val CATALOG: List<Product> = listOf(
    Product("SKU-1", "Mechanical keyboard", 8990),
    Product("SKU-2", "USB-C dock", 12950),
    Product("SKU-3", "27-inch monitor", 24900),
    Product("SKU-4", "Desk lamp", 3333),
    Product("SKU-5", "Laptop stand", 4125),
)

fun findProduct(sku: String): Product? = CATALOG.find { it.sku == sku }

fun catalogJson(): String =
    Json.write(CATALOG.map { linkedMapOf("sku" to it.sku, "name" to it.name) })
