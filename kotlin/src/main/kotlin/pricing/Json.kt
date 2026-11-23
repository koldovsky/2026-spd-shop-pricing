package pricing

import java.math.BigDecimal
import java.math.BigInteger

/** Parsed request JSON, mirroring what `JSON.parse` hands to Express (`req.body`). */
sealed interface JsonValue

data class JsonObject(val fields: Map<String, JsonValue>) : JsonValue {
    operator fun get(key: String): JsonValue? = fields[key]
}

data class JsonArray(val items: List<JsonValue>) : JsonValue
data class JsonString(val value: String) : JsonValue
data class JsonBool(val value: Boolean) : JsonValue
data object JsonNull : JsonValue

/** Number literal kept as text; [jsValue] is the exact value of the JS double, null for ±Infinity. */
data class JsonNumber(val text: String) : JsonValue {
    val jsValue: BigDecimal? get() = text.toDouble().let { if (it.isInfinite()) null else BigDecimal(it) }
}

/** Raised for anything `JSON.parse` or body-parser strict mode rejects; the API answers `malformed JSON`. */
class JsonSyntaxError(message: String) : RuntimeException(message)

object Json {
    /** body-parser strict mode: the first non-whitespace character must open an object or an array. */
    fun parseStrict(text: String): JsonValue {
        val first = text.firstOrNull { !isWs(it) }
        if (first != '{' && first != '[') throw JsonSyntaxError("top-level value must be an object or array")
        return parse(text)
    }

    fun parse(text: String): JsonValue = Parser(text).run {
        val v = value()
        ws()
        if (pos != s.length) fail("unexpected trailing input")
        v
    }

    private fun isWs(c: Char) = c == ' ' || c == '\t' || c == '\n' || c == '\r'

    private class Parser(val s: String) {
        var pos = 0

        fun fail(msg: String): Nothing = throw JsonSyntaxError("$msg at position $pos")

        fun ws() { while (pos < s.length && isWs(s[pos])) pos++ }

        fun peek(): Char = if (pos < s.length) s[pos] else '\u0000'

        fun expect(c: Char) { if (pos >= s.length || s[pos] != c) fail("expected '$c'"); pos++ }

        fun value(): JsonValue {
            ws()
            if (pos >= s.length) fail("unexpected end of input")
            return when (s[pos]) {
                '{' -> obj()
                '[' -> arr()
                '"' -> JsonString(str())
                't' -> literal("true", JsonBool(true))
                'f' -> literal("false", JsonBool(false))
                'n' -> literal("null", JsonNull)
                else -> num()
            }
        }

        fun literal(word: String, v: JsonValue): JsonValue {
            if (!s.startsWith(word, pos)) fail("unexpected token")
            pos += word.length
            return v
        }

        fun obj(): JsonValue {
            expect('{')
            val fields = LinkedHashMap<String, JsonValue>() // last duplicate wins, first position kept (as in JS)
            ws()
            if (peek() == '}') { pos++; return JsonObject(fields) }
            while (true) {
                ws()
                if (pos >= s.length || s[pos] != '"') fail("expected string key")
                val key = str()
                ws(); expect(':')
                fields[key] = value()
                ws()
                if (peek() == ',' && pos < s.length) { pos++; continue }
                expect('}')
                return JsonObject(fields)
            }
        }

        fun arr(): JsonValue {
            expect('[')
            val items = ArrayList<JsonValue>()
            ws()
            if (peek() == ']') { pos++; return JsonArray(items) }
            while (true) {
                items += value()
                ws()
                if (peek() == ',' && pos < s.length) { pos++; continue }
                expect(']')
                return JsonArray(items)
            }
        }

        fun str(): String {
            expect('"')
            val sb = StringBuilder()
            while (true) {
                if (pos >= s.length) fail("unterminated string")
                val c = s[pos++]
                when {
                    c == '"' -> return sb.toString()
                    c < ' ' -> { pos--; fail("control character in string") }
                    c != '\\' -> sb.append(c)
                    pos >= s.length -> fail("unterminated escape")
                    else -> when (val e = s[pos++]) {
                        '"', '\\', '/' -> sb.append(e)
                        'b' -> sb.append('\b')
                        'f' -> sb.append('\u000C')
                        'n' -> sb.append('\n')
                        'r' -> sb.append('\r')
                        't' -> sb.append('\t')
                        'u' -> { // lone surrogates are legal in JSON.parse; pairs combine naturally in UTF-16
                            val hex = if (pos + 4 <= s.length) s.substring(pos, pos + 4) else ""
                            if (hex.length != 4 || !hex.all { it in '0'..'9' || it.lowercaseChar() in 'a'..'f' }) {
                                fail("bad unicode escape")
                            }
                            sb.append(hex.toInt(16).toChar())
                            pos += 4
                        }
                        else -> { pos--; fail("bad escape") }
                    }
                }
            }
        }

        fun num(): JsonValue {
            val start = pos
            if (peek() == '-') pos++
            when (peek()) {
                '0' -> pos++
                in '1'..'9' -> digits()
                else -> fail("unexpected token")
            }
            if (peek() == '.') { pos++; if (peek() !in '0'..'9') fail("bad number"); digits() }
            if (peek() == 'e' || peek() == 'E') {
                pos++
                if (peek() == '+' || peek() == '-') pos++
                if (peek() !in '0'..'9') fail("bad number")
                digits()
            }
            return JsonNumber(s.substring(start, pos))
        }

        fun digits() { while (peek() in '0'..'9') pos++ }
    }

    fun write(value: Any?): String = StringBuilder().also { write(it, value) }.toString()

    private fun write(sb: StringBuilder, value: Any?) {
        when (value) {
            null -> sb.append("null")
            is String -> string(sb, value)
            is Boolean -> sb.append(value)
            is Int, is Long, is BigInteger -> sb.append(value)
            is BigDecimal -> sb.append(value.toBigIntegerExact())
            is Map<*, *> -> {
                sb.append('{')
                value.entries.forEachIndexed { i, (k, v) ->
                    if (i > 0) sb.append(',')
                    string(sb, k as String)
                    sb.append(':')
                    write(sb, v)
                }
                sb.append('}')
            }
            is List<*> -> {
                sb.append('[')
                value.forEachIndexed { i, v -> if (i > 0) sb.append(','); write(sb, v) }
                sb.append(']')
            }
            else -> throw IllegalArgumentException("cannot write ${value::class}")
        }
    }

    /** Same escaping as `JSON.stringify`, including lone surrogates as lowercase `\udxxx`. */
    private fun string(sb: StringBuilder, s: String) {
        sb.append('"')
        for ((i, c) in s.withIndex()) {
            when {
                c == '"' -> sb.append("\\\"")
                c == '\\' -> sb.append("\\\\")
                c == '\n' -> sb.append("\\n")
                c == '\r' -> sb.append("\\r")
                c == '\t' -> sb.append("\\t")
                c == '\b' -> sb.append("\\b")
                c == '\u000C' -> sb.append("\\f")
                c < ' ' -> sb.append("\\u%04x".format(c.code))
                c.isHighSurrogate() && s.getOrNull(i + 1)?.isLowSurrogate() == true -> sb.append(c)
                c.isLowSurrogate() && s.getOrNull(i - 1)?.isHighSurrogate() == true -> sb.append(c)
                c.isSurrogate() -> sb.append("\\u%04x".format(c.code))
                else -> sb.append(c)
            }
        }
        sb.append('"')
    }
}
