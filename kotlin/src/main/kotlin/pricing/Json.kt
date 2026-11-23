package pricing

import java.math.BigDecimal
import java.math.BigInteger

/** JSON writer: integer-only number literals, escaped strings. The parser arrives in slice 3. */
object Json {
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

    private fun string(sb: StringBuilder, s: String) {
        sb.append('"')
        for (c in s) {
            when (c) {
                '"' -> sb.append("\\\"")
                '\\' -> sb.append("\\\\")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                '\b' -> sb.append("\\b")
                '\u000C' -> sb.append("\\f")
                else -> if (c < ' ') sb.append("\\u%04x".format(c.code)) else sb.append(c)
            }
        }
        sb.append('"')
    }
}
