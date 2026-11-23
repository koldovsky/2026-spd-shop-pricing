package pricing

import java.io.ByteArrayOutputStream
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction

/** Thrown where Express would fail outside the route (bad path escape); the error handler maps it to 500. */
class InternalError(message: String) : RuntimeException(message)

/** A response before it is written: status, JSON body. */
data class JsonResponse(val status: Int, val body: String)

fun errorResponse(status: Int, message: String) = JsonResponse(status, Json.write(mapOf("error" to message)))

private fun hex(c: Char): Int = Character.digit(c, 16)

/** Percent-decode into bytes; [lenient] keeps malformed escapes as literal text (Node querystring). */
private fun percentBytes(s: String, plusIsSpace: Boolean, lenient: Boolean): ByteArray {
    val out = ByteArrayOutputStream()
    var i = 0
    while (i < s.length) {
        val c = s[i]
        if (c == '%' && i + 2 < s.length && hex(s[i + 1]) >= 0 && hex(s[i + 2]) >= 0) {
            out.write(hex(s[i + 1]) * 16 + hex(s[i + 2])); i += 3; continue
        }
        if (c == '%' && !lenient) throw InternalError("URI malformed")
        if (c == '+' && plusIsSpace) out.write(' '.code) else out.write(c.toString().toByteArray(Charsets.UTF_8))
        i++
    }
    return out.toByteArray()
}

/** JS decodeURIComponent: malformed escapes or invalid UTF-8 throw. */
fun decodePathSegment(s: String): String {
    val decoder = Charsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
    return try {
        decoder.decode(java.nio.ByteBuffer.wrap(percentBytes(s, plusIsSpace = false, lenient = false))).toString()
    } catch (e: CharacterCodingException) {
        throw InternalError("URI malformed")
    }
}

/** Node querystring.unescape: `+` is a space, malformed escapes stay, invalid UTF-8 becomes U+FFFD. */
fun decodeQueryComponent(s: String): String = String(percentBytes(s, plusIsSpace = true, lenient = true), Charsets.UTF_8)

/**
 * Express 5 "simple" query parser (Node querystring): split on `&`, first `=` separates key and value,
 * keys are decoded too, repeated keys collect into an array. Returns the values of [name] in order.
 */
fun queryValues(rawQuery: String?, name: String): List<String> {
    if (rawQuery.isNullOrEmpty()) return emptyList()
    return rawQuery.split('&').filter { it.isNotEmpty() }.mapNotNull { pair ->
        val eq = pair.indexOf('=')
        val key = decodeQueryComponent(if (eq < 0) pair else pair.substring(0, eq))
        if (key != name) null else decodeQueryComponent(if (eq < 0) "" else pair.substring(eq + 1))
    }
}

/** `String(req.query.currency ?? "EUR")`: missing → EUR, an array is joined with commas. */
fun currencyParam(rawQuery: String?): String =
    queryValues(rawQuery, "currency").takeIf { it.isNotEmpty() }?.joinToString(",") ?: "EUR"

/** GET /prices/:sku — SKU is checked before currency (404 before 422). */
fun pricesResponse(rawSku: String, rawQuery: String?): JsonResponse = try {
    val sku = decodePathSegment(rawSku)
    val currency = currencyParam(rawQuery)
    val base = unitPrice(sku, currency)
    JsonResponse(200, Json.write(linkedMapOf("sku" to sku, "currency" to currency, "baseCents" to base)))
} catch (e: PricingError) {
    errorResponse(e.status, e.message ?: "")
} catch (e: InternalError) {
    errorResponse(500, "internal error")
}
