plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val vName = (findProperty("versionName") as String?) ?: "0.1.0"
val vCode = ((findProperty("versionCode") as String?) ?: "1").toInt()

android {
    namespace = "com.blackout.notes"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.blackout.notes"
        minSdk = 26
        targetSdk = 34
        versionCode = vCode
        versionName = vName
    }

    signingConfigs {
        create("release") {
            val path = System.getenv("KEYSTORE_PATH")
            if (path != null) {
                storeFile = file(path)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}
