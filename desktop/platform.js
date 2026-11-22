/* Desktop bridge: gives the shared Notes screens the same "Android" object the phone app has.
   Reads come from a snapshot loaded at start. Everything else is sent to the Python side. */
(function () {
  'use strict';
  window.PIC_LOCAL = 'notes://appassets.notes/pics/';
  var cache = { notes: '[]', meta: '{"folders":[]}', settings: '{}', version: '{"name":"0.0.0","code":0}', platform: 'linux' };
  var bridge = null;
  var ready = new Promise(function (resolve, reject) {
    var tag = document.createElement('script');
    tag.src = 'notes://appassets.notes/qwebchannel.js';
    tag.onerror = function () { reject(new Error('channel script missing')); };
    tag.onload = function () { start(resolve); };
    document.head.appendChild(tag);
  });
  function start(resolve) {
    new QWebChannel(qt.webChannelTransport, function (ch) {
      bridge = ch.objects.bridge;
      bridge.pushSnapshot.connect(function (json) { cache = JSON.parse(json); });
      bridge.imagePicked.connect(function (name) { if (window.onImagePicked) window.onImagePicked(name); });
      bridge.backupDone.connect(function (kind, ok) { if (window.onBackupDone) window.onBackupDone(kind, ok); });
      bridge.snapshot(function (json) { cache = JSON.parse(json); resolve(); });
    });
  }
  window.Android = {
    __ready: function () { return ready; },
    getPlatform: function () { return cache.platform; },
    getNotes: function () { return cache.notes; },
    getMeta: function () { return cache.meta; },
    getSettings: function () { return cache.settings; },
    getVersion: function () { return cache.version; },
    saveNote: function (j) { bridge.saveNote(j); return true; },
    deleteNoteForever: function (id) { bridge.deleteNoteForever(id); },
    setMeta: function (j) { bridge.setMeta(j); },
    setSetting: function (k, v) { bridge.setSetting(k, v); },
    pickImage: function () { bridge.pickImage(); },
    exportBackup: function () { bridge.exportBackup(); },
    importBackup: function () { bridge.importBackup(); },
    openLink: function (u) { bridge.openLink(u); },
    openReleases: function () { bridge.openReleases(); }
  };
})();
