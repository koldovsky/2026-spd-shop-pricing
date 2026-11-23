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

/** body-parser `json()` default limit (100 kB). */
const val BODY_LIMIT = 100 * 1024

private const val SHAPE = "body must be { currency, lines: [{ sku, quantity }] }"

/**
 * What `express.json()` leaves in `req.body`: null when the type is not `application/json` or the body is empty
 * (the route then sees `{}`); a non-UTF charset or an oversized body fails outside the route (500).
 */
fun parseBody(contentType: String?, body: ByteArray): JsonValue? {
    val parts = contentType?.split(';')?.map { it.trim() } ?: return null
    if (!parts[0].equals("application/json", ignoreCase = true)) return null
    if (body.size > BODY_LIMIT) throw InternalError("request entity too large")
    val charset = parts.drop(1).map { it.split('=', limit = 2) }
        .lastOrNull { it.size == 2 && it[0].trim().equals("charset", ignoreCase = true) }
        ?.get(1)?.trim()?.trim('"')?.lowercase() ?: "utf-8"
    if (!charset.startsWith("utf-")) throw InternalError("unsupported charset")
    if (body.isEmpty()) return null
    val cs = runCatching { java.nio.charset.Charset.forName(charset) }.getOrElse { throw InternalError("unsupported charset") }
    return Json.parseStrict(String(body, cs).removePrefix("﻿"))
}

/** JS `String(value)` / template-literal form, used in error messages. */
fun jsString(v: JsonValue?): String = when (v) {
    null -> "undefined"
    JsonNull -> "null"
    is JsonString -> v.value
    is JsonBool -> v.value.toString()
    is JsonNumber -> jsNumber(v.text.toDouble())
    is JsonObject -> "[object Object]"
    is JsonArray -> v.items.joinToString(",") { if (it == JsonNull) "" else jsString(it) }
}

private fun jsNumber(d: Double): String = when {
    d.isInfinite() -> if (d > 0) "Infinity" else "-Infinity"
    d == 0.0 -> "0"
    d == Math.rint(d) && Math.abs(d) < 1e21 -> java.math.BigDecimal(d).toPlainString()
    Math.abs(d) >= 1e-6 && Math.abs(d) < 1e21 -> d.toString()
    else -> d.toString().replace(".0E", "E").replace("E-", "e-").replace("E", "e+")
}

/** `const { sku, quantity } = line`: properties of a non-object are undefined; null throws (TypeError → 500). */
private fun quoteLine(line: JsonValue): QuoteLine {
    if (line == JsonNull) throw InternalError("cannot destructure null")
    val fields = (line as? JsonObject)?.fields ?: emptyMap()
    val sku = fields["sku"]
    val quantity = (fields["quantity"] as? JsonNumber)?.jsValue
    return QuoteLine(jsString(sku), quantity, sku is JsonString)
}

/** POST /quote — shape 400, then `Pricing.quote` validation; `malformed JSON` for parse errors. */
fun quoteResponse(contentType: String?, body: ByteArray): JsonResponse = try {
    val req = parseBody(contentType, body) as? JsonObject
    val currency = req?.get("currency") as? JsonString
    val lines = req?.get("lines") as? JsonArray
    if (currency == null || lines == null) throw PricingError(SHAPE, 400)
    val q = quote(currency.value, lines.items.map(::quoteLine))
    JsonResponse(200, Json.write(linkedMapOf(
        "currency" to q.currency,
        "lines" to q.lines.map {
            linkedMapOf("sku" to it.sku, "quantity" to it.quantity, "unitCents" to it.unitCents,
                "discountCents" to it.discountCents, "lineCents" to it.lineCents)
        },
        "subtotalCents" to q.subtotalCents, "cartDiscountCents" to q.cartDiscountCents,
        "taxCents" to q.taxCents, "totalCents" to q.totalCents,
    )))
} catch (e: PricingError) {
    errorResponse(e.status, e.message ?: "")
} catch (e: JsonSyntaxError) {
    errorResponse(400, "malformed JSON")
} catch (e: InternalError) {
    errorResponse(500, "internal error")
}
