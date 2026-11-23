package pricing

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpHandler

/** Exact-path routing; anything else gets a framework-style 404 (compared by status only). */
class Router : HttpHandler {
    override fun handle(ex: HttpExchange) {
        ex.use {
            val path = ex.requestURI.rawPath
            when {
                ex.requestMethod == "GET" && path == "/catalog" -> send(ex, 200, catalogJson())
                else -> notFound(ex)
            }
        }
    }

    private fun send(ex: HttpExchange, status: Int, json: String) {
        val bytes = json.toByteArray(Charsets.UTF_8)
        ex.responseHeaders.set("Content-Type", "application/json; charset=utf-8")
        ex.sendResponseHeaders(status, bytes.size.toLong())
        ex.responseBody.write(bytes)
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
