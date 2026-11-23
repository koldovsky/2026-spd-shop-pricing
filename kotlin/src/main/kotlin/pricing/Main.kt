package pricing

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.util.concurrent.Executors

fun main() {
    val port = System.getenv("PORT")?.toIntOrNull() ?: 8082
    val server = HttpServer.create(InetSocketAddress(port), 0)
    server.createContext("/", Router())
    server.executor = Executors.newFixedThreadPool(Runtime.getRuntime().availableProcessors() * 2)
    server.start()
    println("shop-pricing (kotlin) listening on :$port")
}
