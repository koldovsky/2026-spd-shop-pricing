plugins {
    kotlin("jvm") version "2.3.21"
}

repositories {
    mavenCentral()
}

dependencies {
    testImplementation(kotlin("test"))
}

kotlin {
    jvmToolchain(21)
}

tasks.test {
    useJUnitPlatform()
}

// Self-contained jar: kotlin/build/libs/pricing.jar, started with `java -jar`.
tasks.jar {
    archiveFileName.set("pricing.jar")
    manifest { attributes["Main-Class"] = "pricing.MainKt" }
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    from(configurations.runtimeClasspath.map { cp -> cp.map { if (it.isDirectory) it else zipTree(it) } })
}
