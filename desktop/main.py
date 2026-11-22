"""Notes for Windows and Linux.

The same Notes screens as the phone app, shown in a Qt WebEngine window.
Fully offline: pages come from a private local scheme, all other addresses are blocked,
and notes and pictures live in the app's own data folder.
"""
import json
import os
import re
import secrets
import sys
import time
import zipfile
from pathlib import Path

from PySide6.QtCore import QBuffer, QByteArray, QFile, QIODevice, QObject, QStandardPaths, Qt, QTimer, QUrl, Signal, Slot
from PySide6.QtGui import QColor, QDesktopServices, QIcon, QImageReader
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebEngineCore import (
    QWebEnginePage,
    QWebEngineProfile,
    QWebEngineSettings,
    QWebEngineUrlRequestJob,
    QWebEngineUrlScheme,
    QWebEngineUrlSchemeHandler,
)
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import QApplication, QFileDialog, QMainWindow

PLATFORM = "windows" if sys.platform == "win32" else "linux"
FROZEN = getattr(sys, "frozen", False)
BASE = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
if FROZEN:
    WEB_DIR = BASE / "web"
    PLATFORM_JS = BASE / "platform.js"
    VERSION_FILE = BASE / "version.json"
    ICON_FILE = BASE / "icon.png"
else:
    WEB_DIR = BASE / "app" / "src" / "main" / "assets"
    PLATFORM_JS = BASE / "desktop" / "platform.js"
    VERSION_FILE = BASE / "desktop" / "version.json"
    ICON_FILE = BASE / "desktop" / "icon.png"

RELEASES_URL = "https://github.com/Blackout-78/Notes/releases/tag/%s-latest" % PLATFORM
NOTE_ID = re.compile(r"^[a-z0-9]{4,40}$")
PIC_NAME = re.compile(r"^[a-z0-9]{4,40}\.(jpg|png|gif|webp)$")
PIC_REF = re.compile(r"pics/([a-z0-9]{4,40}\.(?:jpg|png|gif|webp))")
ASSET_NAME = re.compile(r"^[A-Za-z0-9._-]+$")
MAX_FILE = 40 * 1024 * 1024
MAX_TOTAL = 600 * 1024 * 1024
MIME = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


def write_atomic(path: Path, data: bytes) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


class Store:
    """Notes, pictures, folders and settings in one private data folder."""

    DEFAULTS = {"screenProtect": True, "cleanPics": True, "trashDays": 30}

    def __init__(self, root: Path):
        self.root = Path(root)
        self.notes = self.root / "notes"
        self.pics = self.root / "pics"
        self.notes.mkdir(parents=True, exist_ok=True)
        self.pics.mkdir(parents=True, exist_ok=True)

    # settings
    def settings(self) -> dict:
        out = dict(self.DEFAULTS)
        try:
            data = json.loads((self.root / "settings.json").read_text("utf-8"))
            for k in out:
                if k in data and type(data[k]) is type(out[k]):
                    out[k] = data[k]
        except Exception:
            pass
        out["trashDays"] = max(1, min(365, int(out["trashDays"])))
        return out

    def set_setting(self, key: str, value: str) -> None:
        s = self.settings()
        if key in ("screenProtect", "cleanPics"):
            s[key] = value == "true"
        elif key == "trashDays":
            try:
                s[key] = max(1, min(365, int(value)))
            except ValueError:
                return
        else:
            return
        write_atomic(self.root / "settings.json", json.dumps(s).encode("utf-8"))

    # notes
    def housekeeping(self) -> None:
        now = time.time() * 1000
        limit = self.settings()["trashDays"] * 86_400_000
        used = set()
        for f in self.notes.glob("*.json"):
            try:
                o = json.loads(f.read_text("utf-8"))
                deleted = o.get("deletedAt", 0) or 0
                if deleted > 0 and now - deleted > limit:
                    f.unlink()
                else:
                    used.update(PIC_REF.findall(o.get("html", "")))
            except Exception:
                pass
        for p in self.pics.iterdir():
            try:
                if PIC_NAME.match(p.name) and p.name not in used and time.time() - p.stat().st_mtime > 86_400:
                    p.unlink()
            except Exception:
                pass

    def notes_json(self) -> str:
        arr = []
        for f in self.notes.glob("*.json"):
            try:
                arr.append(json.loads(f.read_text("utf-8")))
            except Exception:
                pass
        return json.dumps(arr)

    def save_note(self, text: str) -> bool:
        try:
            o = json.loads(text)
            nid = o["id"]
            if not isinstance(nid, str) or not NOTE_ID.match(nid):
                return False
            write_atomic(self.notes / (nid + ".json"), text.encode("utf-8"))
            return True
        except Exception:
            return False

    def delete_note(self, nid: str) -> None:
        if NOTE_ID.match(nid or ""):
            try:
                (self.notes / (nid + ".json")).unlink()
            except FileNotFoundError:
                pass

    def meta(self) -> str:
        f = self.root / "meta.json"
        return f.read_text("utf-8") if f.is_file() else '{"folders":[]}'

    def set_meta(self, text: str) -> None:
        try:
            json.loads(text)
            write_atomic(self.root / "meta.json", text.encode("utf-8"))
        except Exception:
            pass

    def snapshot(self, version: dict) -> dict:
        self.housekeeping()
        return {
            "platform": PLATFORM,
            "notes": self.notes_json(),
            "meta": self.meta(),
            "settings": json.dumps(self.settings()),
            "version": json.dumps(version),
        }

    # pictures
    def save_image(self, src: str):
        p = Path(src)
        if not p.is_file() or p.stat().st_size > MAX_FILE:
            return None
        ident = secrets.token_hex(10)
        if not self.settings()["cleanPics"]:
            ext = {".png": "png", ".gif": "gif", ".webp": "webp"}.get(p.suffix.lower(), "jpg")
            name = "%s.%s" % (ident, ext)
            write_atomic(self.pics / name, p.read_bytes())
            return name
        reader = QImageReader(str(p))
        reader.setAutoTransform(True)  # applies the camera rotation, then the data is dropped
        img = reader.read()
        if img.isNull():
            return None
        if max(img.width(), img.height()) > 2400:
            img = img.scaled(2400, 2400, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        png = img.hasAlphaChannel()
        name = "%s.%s" % (ident, "png" if png else "jpg")
        tmp = self.pics / (name + ".tmp")
        ok = img.save(str(tmp), "PNG" if png else "JPG", -1 if png else 88)
        if not ok:
            return None
        os.replace(tmp, self.pics / name)
        return name

    # backup
    def write_backup(self, dest: str) -> None:
        with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
            for f in self.notes.glob("*.json"):
                z.write(f, "notes/" + f.name)
            for f in self.pics.iterdir():
                if PIC_NAME.match(f.name):
                    z.write(f, "pics/" + f.name)
            m = self.root / "meta.json"
            if m.is_file():
                z.write(m, "meta.json")

    def read_backup(self, src: str) -> None:
        note_re = re.compile(r"^notes/([a-z0-9]{4,40})\.json$")
        pic_re = re.compile(r"^pics/([a-z0-9]{4,40}\.(?:jpg|png|gif|webp))$")
        total = 0
        with zipfile.ZipFile(src) as z:
            for info in z.infolist():
                if info.is_dir():
                    continue
                if info.file_size > MAX_FILE:
                    raise ValueError("entry too large")
                total += info.file_size
                if total > MAX_TOTAL:
                    raise ValueError("backup too large")
                name = info.filename
                nm, pm = note_re.match(name), pic_re.match(name)
                if not (nm or pm or name == "meta.json"):
                    continue
                data = z.read(info)
                if nm:
                    if json.loads(data.decode("utf-8")).get("id") == nm.group(1):
                        write_atomic(self.notes / (nm.group(1) + ".json"), data)
                elif pm:
                    write_atomic(self.pics / pm.group(1), data)
                else:
                    json.loads(data.decode("utf-8"))
                    write_atomic(self.root / "meta.json", data)


class SchemeHandler(QWebEngineUrlSchemeHandler):
    """Serves the Notes screens and pictures. Nothing else is reachable."""

    def __init__(self, store: Store, parent=None):
        super().__init__(parent)
        self.store = store

    def lookup(self, path: str):
        if path in ("", "/"):
            path = "/index.html"
        if path.startswith("/pics/"):
            name = path[len("/pics/"):]
            f = self.store.pics / name
            if PIC_NAME.match(name) and f.is_file():
                return f.read_bytes(), MIME[f.suffix.lower()]
            return None
        if path == "/qwebchannel.js":
            qf = QFile(":/qtwebchannel/qwebchannel.js")
            if qf.open(QIODevice.ReadOnly):
                return bytes(qf.readAll()), MIME[".js"]
            return None
        if path == "/platform.js":
            return (PLATFORM_JS.read_bytes(), MIME[".js"]) if PLATFORM_JS.is_file() else None
        name = path.lstrip("/")
        f = WEB_DIR / name
        if ASSET_NAME.match(name) and f.is_file() and f.suffix.lower() in MIME:
            return f.read_bytes(), MIME[f.suffix.lower()]
        return None

    def requestStarted(self, job):
        found = self.lookup(job.requestUrl().path())
        if found is None:
            job.fail(QWebEngineUrlRequestJob.Error.UrlNotFound)
            return
        data, mime = found
        buf = QBuffer(job)
        buf.setData(QByteArray(data))
        buf.open(QIODevice.ReadOnly)
        job.reply(QByteArray(mime.encode()), buf)


class GuardPage(QWebEnginePage):
    """Only the local Notes scheme may load. Links are opened by the Notes bridge on tap."""

    def acceptNavigationRequest(self, url, nav_type, is_main_frame):
        return url.scheme() == "notes"

    def createWindow(self, window_type):
        return None


class Bridge(QObject):
    pushSnapshot = Signal(str)
    imagePicked = Signal(str)
    backupDone = Signal(str, bool)

    def __init__(self, store: Store, window, version: dict):
        super().__init__(window)
        self.store = store
        self.window = window
        self.version = version

    def _snapshot_json(self) -> str:
        return json.dumps(self.store.snapshot(self.version))

    @Slot(result=str)
    def snapshot(self):
        return self._snapshot_json()

    @Slot(str)
    def saveNote(self, text):
        self.store.save_note(text)

    @Slot(str)
    def deleteNoteForever(self, nid):
        self.store.delete_note(nid)

    @Slot(str)
    def setMeta(self, text):
        self.store.set_meta(text)

    @Slot(str, str)
    def setSetting(self, key, value):
        self.store.set_setting(key, value)
        if key == "screenProtect":
            self.window.apply_capture()

    @Slot()
    def pickImage(self):
        path, _ = QFileDialog.getOpenFileName(
            self.window, "Choose a picture", "", "Pictures (*.jpg *.jpeg *.png *.gif *.webp *.bmp)"
        )
        if not path:
            self.imagePicked.emit("")
            return
        try:
            name = self.store.save_image(path)
        except Exception:
            name = None
        self.imagePicked.emit(name or "error")

    @Slot()
    def exportBackup(self):
        stamp = time.strftime("%Y%m%d-%H%M")
        path, _ = QFileDialog.getSaveFileName(self.window, "Save backup", "notes-backup-%s.zip" % stamp, "Zip (*.zip)")
        if not path:
            self.backupDone.emit("export", False)
            return
        try:
            self.store.write_backup(path)
            self.backupDone.emit("export", True)
        except Exception:
            self.backupDone.emit("export", False)

    @Slot()
    def importBackup(self):
        path, _ = QFileDialog.getOpenFileName(self.window, "Choose a backup", "", "Zip (*.zip)")
        if not path:
            self.backupDone.emit("import", False)
            return
        try:
            self.store.read_backup(path)
            self.pushSnapshot.emit(self._snapshot_json())
            self.backupDone.emit("import", True)
        except Exception:
            self.backupDone.emit("import", False)

    @Slot(str)
    def openLink(self, url):
        q = QUrl(url)
        if q.scheme().lower() in ("http", "https", "mailto", "tel"):
            QDesktopServices.openUrl(q)

    @Slot()
    def openReleases(self):
        QDesktopServices.openUrl(QUrl(RELEASES_URL))


class Window(QMainWindow):
    def __init__(self, store: Store, version: dict):
        super().__init__()
        self.store = store
        self._closing = False
        self._flushed = False
        self.setWindowTitle("Notes")
        if ICON_FILE.is_file():
            self.setWindowIcon(QIcon(str(ICON_FILE)))
        self.resize(1000, 760)
        self.setMinimumSize(380, 560)
        self.setStyleSheet("QMainWindow { background: #000; }")

        self.view = QWebEngineView(self)
        self.setCentralWidget(self.view)
        self.profile = QWebEngineProfile(self)  # no name: nothing is kept in a browser cache or cookie jar
        self.handler = SchemeHandler(store, self)
        self.profile.installUrlSchemeHandler(QByteArray(b"notes"), self.handler)
        self.page = GuardPage(self.profile, self.view)
        self.view.setPage(self.page)
        self.page.setBackgroundColor(QColor("#000000"))
        s = self.page.settings()
        for name, value in (
            ("LocalContentCanAccessRemoteUrls", False),
            ("PluginsEnabled", False),
            ("ErrorPageEnabled", False),
            ("DnsPrefetchEnabled", False),
            ("FullScreenSupportEnabled", False),
            ("JavascriptCanOpenWindows", False),
            ("AllowRunningInsecureContent", False),
        ):
            attr = getattr(QWebEngineSettings.WebAttribute, name, None)
            if attr is not None:
                s.setAttribute(attr, value)

        self.bridge = Bridge(store, self, version)
        self.channel = QWebChannel(self.page)
        self.channel.registerObject("bridge", self.bridge)
        self.page.setWebChannel(self.channel)
        self.view.load(QUrl("notes://appassets.notes/index.html"))

    def apply_capture(self):
        """Windows only: keep the window out of screenshots and screen recordings."""
        if sys.platform != "win32":
            return
        try:
            import ctypes

            hwnd = int(self.winId())
            user32 = ctypes.windll.user32
            if not self.store.settings()["screenProtect"]:
                user32.SetWindowDisplayAffinity(hwnd, 0)
            elif not user32.SetWindowDisplayAffinity(hwnd, 0x11):  # exclude from capture
                user32.SetWindowDisplayAffinity(hwnd, 0x1)  # older Windows: black rectangle
        except Exception:
            pass

    def showEvent(self, event):
        super().showEvent(event)
        self.apply_capture()

    def _finish(self):
        if not self._flushed:
            self._flushed = True
            self.close()

    def closeEvent(self, event):
        if self._flushed:
            event.accept()
            return
        event.ignore()
        if not self._closing:
            self._closing = True
            self.page.runJavaScript("window.__flush && window.__flush()", lambda _r: self._finish())
            QTimer.singleShot(1500, self._finish)


def load_version() -> dict:
    try:
        return json.loads(VERSION_FILE.read_text("utf-8"))
    except Exception:
        return {"name": "0.0.0", "code": 0}


def data_root() -> Path:
    env = os.environ.get("NOTES_DATA")
    if env:
        return Path(env)
    return Path(QStandardPaths.writableLocation(QStandardPaths.AppDataLocation))


def register_scheme() -> None:
    scheme = QWebEngineUrlScheme(QByteArray(b"notes"))
    scheme.setSyntax(QWebEngineUrlScheme.Syntax.Host)
    scheme.setFlags(QWebEngineUrlScheme.Flag.SecureScheme | QWebEngineUrlScheme.Flag.CorsEnabled)
    QWebEngineUrlScheme.registerScheme(scheme)


def main() -> int:
    os.environ.setdefault(
        "QTWEBENGINE_CHROMIUM_FLAGS",
        "--disable-background-networking --disable-domain-reliability --no-pings --disable-breakpad --disable-sync",
    )
    register_scheme()
    app = QApplication(sys.argv)
    app.setApplicationName("Notes")
    app.setOrganizationName("")
    store = Store(data_root())
    window = Window(store, load_version())
    window.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
