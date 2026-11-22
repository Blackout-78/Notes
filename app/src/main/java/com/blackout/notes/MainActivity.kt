package com.blackout.notes

import android.app.Activity
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.os.Bundle
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.util.Calendar
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * Notes: a fully offline note app. The screen is a local web page shown in a WebView.
 * The app has no internet permission. Notes and pictures live in the app's private folder.
 */
class MainActivity : Activity() {

    private val host = "appassets.notes"
    private lateinit var web: WebView
    private lateinit var prefs: SharedPreferences
    private lateinit var notesDir: File
    private lateinit var picsDir: File
    private val ioLock = Any()

    private val reqPick = 11
    private val reqExport = 12
    private val reqImport = 13

    private val noteIdRe = Regex("[a-z0-9]{4,40}")
    private val picNameRe = Regex("[a-z0-9]{4,40}\\.(jpg|png|gif|webp)")
    private val maxBytes = 40L * 1024 * 1024

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("notes_settings", MODE_PRIVATE)
        notesDir = File(filesDir, "notes").apply { mkdirs() }
        picsDir = File(filesDir, "pics").apply { mkdirs() }

        window.statusBarColor = Color.BLACK
        window.navigationBarColor = 0xFF0A0A0A.toInt()
        applySecure()

        web = WebView(this)
        web.setBackgroundColor(Color.BLACK)
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = false
            allowFileAccess = false
            allowContentAccess = false
            setSupportZoom(false)
            builtInZoomControls = false
            textZoom = 100
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setGeolocationEnabled(false)
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                return serve(request)
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true
        }
        web.addJavascriptInterface(Bridge(), "Android")
        setContentView(web)
        web.loadUrl("https://$host/index.html")
    }

    // ---- local content server (assets and pictures only; everything else is blocked) ----

    private fun notFound() = WebResourceResponse(
        "text/plain", "utf-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(ByteArray(0))
    )

    private fun mime(name: String): String = when (name.substringAfterLast('.').lowercase()) {
        "html" -> "text/html"
        "css" -> "text/css"
        "js" -> "application/javascript"
        "png" -> "image/png"
        "gif" -> "image/gif"
        "webp" -> "image/webp"
        "jpg", "jpeg" -> "image/jpeg"
        else -> "application/octet-stream"
    }

    private fun serve(req: WebResourceRequest): WebResourceResponse? {
        val u = req.url
        if (u.scheme != "https" || u.host != host || req.method != "GET") return notFound()
        val path = u.path ?: "/"
        if (path.startsWith("/pics/")) {
            val name = path.removePrefix("/pics/")
            if (!picNameRe.matches(name)) return notFound()
            val f = File(picsDir, name)
            if (!f.isFile) return notFound()
            return WebResourceResponse(mime(name), null, FileInputStream(f))
        }
        val asset = if (path == "/") "index.html" else path.removePrefix("/")
        if (!Regex("[A-Za-z0-9._-]+").matches(asset)) return notFound()
        return try {
            WebResourceResponse(mime(asset), "utf-8", assets.open(asset))
        } catch (e: IOException) {
            notFound()
        }
    }

    // ---- helpers ----

    private fun js(code: String) {
        runOnUiThread { web.evaluateJavascript(code, null) }
    }

    private fun applySecure() {
        if (prefs.getBoolean("screenProtect", true)) {
            window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }

    private fun newId(): String = UUID.randomUUID().toString().replace("-", "").substring(0, 20)

    private fun writeAtomic(target: File, data: ByteArray) {
        val tmp = File(target.parentFile, target.name + ".tmp")
        FileOutputStream(tmp).use { it.write(data) }
        if (!tmp.renameTo(target)) {
            target.delete()
            tmp.renameTo(target)
        }
    }

    private fun readLimited(input: InputStream, limit: Long): ByteArray {
        val out = ByteArrayOutputStream()
        val buf = ByteArray(16 * 1024)
        var total = 0L
        while (true) {
            val n = input.read(buf)
            if (n < 0) break
            total += n
            if (total > limit) throw IOException("File too large")
            out.write(buf, 0, n)
        }
        return out.toByteArray()
    }

    private fun trashDays(): Int = prefs.getInt("trashDays", 30).coerceIn(1, 365)

    /** Deletes notes that stayed in the trash too long, then pictures no note uses any more. */
    private fun housekeeping() {
        synchronized(ioLock) {
            val now = System.currentTimeMillis()
            val limit = trashDays() * 86_400_000L
            val used = HashSet<String>()
            val picRe = Regex("pics/([a-z0-9]{4,40}\\.(?:jpg|png|gif|webp))")
            notesDir.listFiles { f -> f.name.endsWith(".json") }?.forEach { f ->
                try {
                    val o = JSONObject(f.readText())
                    val deletedAt = o.optLong("deletedAt", 0L)
                    if (deletedAt > 0 && now - deletedAt > limit) {
                        f.delete()
                    } else {
                        picRe.findAll(o.optString("html", "")).forEach { used.add(it.groupValues[1]) }
                    }
                } catch (e: Exception) {
                    // leave unreadable files alone
                }
            }
            picsDir.listFiles()?.forEach { p ->
                if (!used.contains(p.name) && p.name.matches(picNameRe) && now - p.lastModified() > 86_400_000L) {
                    p.delete()
                }
            }
        }
    }

    private fun stamp(): String {
        val c = Calendar.getInstance()
        return String.format(
            "%04d%02d%02d-%02d%02d",
            c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH),
            c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE)
        )
    }

    // ---- JavaScript bridge ----

    inner class Bridge {
        @JavascriptInterface
        fun getNotes(): String {
            housekeeping()
            synchronized(ioLock) {
                val arr = JSONArray()
                notesDir.listFiles { f -> f.name.endsWith(".json") }?.forEach { f ->
                    try {
                        arr.put(JSONObject(f.readText()))
                    } catch (e: Exception) {
                        // skip unreadable note
                    }
                }
                return arr.toString()
            }
        }

        @JavascriptInterface
        fun saveNote(json: String): Boolean {
            return try {
                val o = JSONObject(json)
                val id = o.getString("id")
                if (!noteIdRe.matches(id)) return false
                synchronized(ioLock) { writeAtomic(File(notesDir, "$id.json"), json.toByteArray(Charsets.UTF_8)) }
                true
            } catch (e: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun deleteNoteForever(id: String) {
            if (!noteIdRe.matches(id)) return
            synchronized(ioLock) { File(notesDir, "$id.json").delete() }
        }

        @JavascriptInterface
        fun getMeta(): String {
            synchronized(ioLock) {
                val f = File(filesDir, "meta.json")
                return if (f.isFile) f.readText() else "{\"folders\":[]}"
            }
        }

        @JavascriptInterface
        fun setMeta(json: String) {
            try {
                JSONObject(json)
                synchronized(ioLock) { writeAtomic(File(filesDir, "meta.json"), json.toByteArray(Charsets.UTF_8)) }
            } catch (e: Exception) {
                // ignore bad data
            }
        }

        @JavascriptInterface
        fun getSettings(): String {
            val o = JSONObject()
            o.put("screenProtect", prefs.getBoolean("screenProtect", true))
            o.put("cleanPics", prefs.getBoolean("cleanPics", true))
            o.put("trashDays", trashDays())
            return o.toString()
        }

        @JavascriptInterface
        fun setSetting(key: String, value: String) {
            when (key) {
                "screenProtect" -> {
                    prefs.edit().putBoolean("screenProtect", value == "true").apply()
                    runOnUiThread { applySecure() }
                }
                "cleanPics" -> prefs.edit().putBoolean("cleanPics", value == "true").apply()
                "trashDays" -> prefs.edit().putInt("trashDays", (value.toIntOrNull() ?: 30).coerceIn(1, 365)).apply()
            }
        }

        @JavascriptInterface
        fun getVersion(): String {
            val o = JSONObject()
            try {
                val pi = packageManager.getPackageInfo(packageName, 0)
                o.put("name", pi.versionName ?: "0.0.0")
                @Suppress("DEPRECATION")
                o.put("code", pi.versionCode)
            } catch (e: Exception) {
                o.put("name", "0.0.0")
                o.put("code", 0)
            }
            return o.toString()
        }

        @JavascriptInterface
        fun pickImage() {
            runOnUiThread {
                val i = Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "image/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                try {
                    @Suppress("DEPRECATION")
                    startActivityForResult(i, reqPick)
                } catch (e: Exception) {
                    js("window.onImagePicked && window.onImagePicked('')")
                }
            }
        }

        @JavascriptInterface
        fun exportBackup() {
            runOnUiThread {
                val i = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    type = "application/zip"
                    addCategory(Intent.CATEGORY_OPENABLE)
                    putExtra(Intent.EXTRA_TITLE, "notes-backup-${stamp()}.zip")
                }
                try {
                    @Suppress("DEPRECATION")
                    startActivityForResult(i, reqExport)
                } catch (e: Exception) {
                    js("window.onBackupDone && window.onBackupDone('export', false)")
                }
            }
        }

        @JavascriptInterface
        fun importBackup() {
            runOnUiThread {
                val i = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                try {
                    @Suppress("DEPRECATION")
                    startActivityForResult(i, reqImport)
                } catch (e: Exception) {
                    js("window.onBackupDone && window.onBackupDone('import', false)")
                }
            }
        }

        @JavascriptInterface
        fun openLink(url: String) {
            val uri = Uri.parse(url)
            val scheme = uri.scheme?.lowercase() ?: return
            if (scheme != "http" && scheme != "https" && scheme != "mailto" && scheme != "tel") return
            runOnUiThread {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                } catch (e: Exception) {
                    // no app can open this link
                }
            }
        }

        @JavascriptInterface
        fun openReleases() {
            openLink("https://github.com/Blackout-78/Notes/releases/tag/android-latest")
        }
    }

    // ---- results: picture, export, import ----

    @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        val uri: Uri? = if (resultCode == RESULT_OK) data?.data else null
        when (requestCode) {
            reqPick -> {
                if (uri == null) {
                    js("window.onImagePicked && window.onImagePicked('')")
                } else {
                    Thread {
                        val name = try { saveImage(uri) } catch (e: Exception) { null }
                        js("window.onImagePicked && window.onImagePicked('" + (name ?: "") + "')")
                    }.start()
                }
            }
            reqExport -> {
                if (uri == null) {
                    js("window.onBackupDone && window.onBackupDone('export', false)")
                } else {
                    Thread {
                        val ok = try { writeBackup(uri); true } catch (e: Exception) { false }
                        js("window.onBackupDone && window.onBackupDone('export', $ok)")
                    }.start()
                }
            }
            reqImport -> {
                if (uri == null) {
                    js("window.onBackupDone && window.onBackupDone('import', false)")
                } else {
                    Thread {
                        val ok = try { readBackup(uri); true } catch (e: Exception) { false }
                        js("window.onBackupDone && window.onBackupDone('import', $ok)")
                    }.start()
                }
            }
        }
    }

    /** Copies a picture into the app. With "clean hidden info" on, it is re-drawn so no location or device data survives. */
    private fun saveImage(uri: Uri): String? {
        val bytes = contentResolver.openInputStream(uri)?.use { readLimited(it, maxBytes) } ?: return null
        val clean = prefs.getBoolean("cleanPics", true)
        val mimeType = contentResolver.getType(uri) ?: ""
        val id = newId()

        if (!clean) {
            val ext = when {
                mimeType.contains("png") -> "png"
                mimeType.contains("gif") -> "gif"
                mimeType.contains("webp") -> "webp"
                else -> "jpg"
            }
            val name = "$id.$ext"
            synchronized(ioLock) { writeAtomic(File(picsDir, name), bytes) }
            return name
        }

        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (bounds.outWidth / sample > 2400 || bounds.outHeight / sample > 2400) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        var bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts) ?: return null

        val orientation = try {
            ExifInterface(ByteArrayInputStream(bytes))
                .getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        } catch (e: Exception) {
            ExifInterface.ORIENTATION_NORMAL
        }
        val m = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> m.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> m.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> m.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.postScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> m.postScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> { m.postRotate(90f); m.postScale(-1f, 1f) }
            ExifInterface.ORIENTATION_TRANSVERSE -> { m.postRotate(270f); m.postScale(-1f, 1f) }
        }
        if (!m.isIdentity) {
            val rotated = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
            if (rotated !== bmp) bmp.recycle()
            bmp = rotated
        }

        val png = bmp.hasAlpha()
        val out = ByteArrayOutputStream()
        if (png) bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
        else bmp.compress(Bitmap.CompressFormat.JPEG, 88, out)
        bmp.recycle()
        val name = "$id." + (if (png) "png" else "jpg")
        synchronized(ioLock) { writeAtomic(File(picsDir, name), out.toByteArray()) }
        return name
    }

    private fun writeBackup(uri: Uri) {
        val os = contentResolver.openOutputStream(uri) ?: throw IOException("No output")
        synchronized(ioLock) {
            ZipOutputStream(os.buffered()).use { zip ->
                fun add(name: String, f: File) {
                    zip.putNextEntry(ZipEntry(name))
                    FileInputStream(f).use { it.copyTo(zip) }
                    zip.closeEntry()
                }
                notesDir.listFiles { f -> f.name.endsWith(".json") }?.forEach { add("notes/" + it.name, it) }
                picsDir.listFiles { f -> f.name.matches(picNameRe) }?.forEach { add("pics/" + it.name, it) }
                val meta = File(filesDir, "meta.json")
                if (meta.isFile) add("meta.json", meta)
            }
        }
    }

    private fun readBackup(uri: Uri) {
        val input = contentResolver.openInputStream(uri) ?: throw IOException("No input")
        val noteEntry = Regex("notes/([a-z0-9]{4,40})\\.json")
        val picEntry = Regex("pics/([a-z0-9]{4,40}\\.(?:jpg|png|gif|webp))")
        var total = 0L
        var count = 0
        ZipInputStream(input.buffered()).use { zip ->
            while (true) {
                val e = zip.nextEntry ?: break
                if (e.isDirectory) continue
                val name = e.name
                val data = readLimited(zip, maxBytes)
                total += data.size
                if (total > 600L * 1024 * 1024) throw IOException("Backup too large")
                val nm = noteEntry.matchEntire(name)
                val pm = picEntry.matchEntire(name)
                synchronized(ioLock) {
                    when {
                        nm != null -> {
                            val o = JSONObject(String(data, Charsets.UTF_8))
                            if (o.getString("id") == nm.groupValues[1]) {
                                writeAtomic(File(notesDir, nm.groupValues[1] + ".json"), data)
                                count++
                            }
                        }
                        pm != null -> writeAtomic(File(picsDir, pm.groupValues[1]), data)
                        name == "meta.json" -> {
                            JSONObject(String(data, Charsets.UTF_8))
                            writeAtomic(File(filesDir, "meta.json"), data)
                        }
                    }
                }
            }
        }
        if (count == 0) {
            // an empty or foreign zip still counts as done, but nothing was added
        }
    }

    @Suppress("OVERRIDE_DEPRECATION")
    override fun onBackPressed() {
        web.evaluateJavascript("(window.onBack ? window.onBack() : false)") { r ->
            if (r != "true") finish()
        }
    }
}
