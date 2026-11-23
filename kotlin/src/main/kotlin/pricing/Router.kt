package pricing

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpHandler

/** Exact-path routing; anything else gets a framework-style 404 (compared by status only). */
class Router : HttpHandler {
    override fun handle(ex: HttpExchange) {
        ex.use {
            val path = ex.requestURI.rawPath
            val get = ex.requestMethod == "GET" || ex.requestMethod == "HEAD"
            val sku = priceSku(path)
            when {
                get && path.equals("/catalog", ignoreCase = true) -> send(ex, JsonResponse(200, catalogJson()))
                get && sku != null -> send(ex, pricesResponse(sku, ex.requestURI.rawQuery))
                else -> notFound(ex)
            }
        }
    }

    /** Express `/prices/:sku`: case-insensitive prefix, one non-empty segment, optional trailing slash. */
    private fun priceSku(path: String): String? {
        if (!path.regionMatches(0, "/prices/", 0, 8, ignoreCase = true)) return null
        val sku = path.substring(8).removeSuffix("/")
        return sku.takeIf { it.isNotEmpty() && '/' !in it }
    }

    private fun send(ex: HttpExchange, res: JsonResponse) {
        val bytes = res.body.toByteArray(Charsets.UTF_8)
        ex.responseHeaders.set("Content-Type", "application/json; charset=utf-8")
        if (ex.requestMethod == "HEAD") {
            ex.responseHeaders.set("Content-Length", bytes.size.toString())
            ex.sendResponseHeaders(res.status, -1)
        } else {
            ex.sendResponseHeaders(res.status, bytes.size.toLong())
            ex.responseBody.write(bytes)
        }
    }

    private fun notFound(ex: HttpExchange) {
        val html = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n" +
            "</head>\n<body>\n<pre>Cannot ${ex.requestMethod} ${ex.requestURI.rawPath}</pre>\n</body>\n</html>\n"
        val bytes = html.toByteArray(Charsets.UTF_8)
        ex.responseHeaders.set("Content-Type", "text/html; charset=utf-8")
        ex.sendResponseHeaders(404, bytes.size.toLong())
        ex.responseBody.write(bytes)
    }
}
