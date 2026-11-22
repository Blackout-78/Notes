'use strict';
(function () {
  var A = window.Android;
  var $ = function (s) { return document.querySelector(s); };
  var PIC_CANON = 'https://appassets.notes/pics/';
  var PIC_LOCAL = window.PIC_LOCAL || '';
  function toLocal(h) { return PIC_LOCAL ? String(h).split(PIC_CANON).join(PIC_LOCAL) : h; }
  function toCanon(h) { return PIC_LOCAL ? String(h).split(PIC_LOCAL).join(PIC_CANON) : h; }

  /* ---------- utilities ---------- */
  var MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function p2(n) { return String(n).padStart(2, '0'); }
  function hm(d) { return p2(d.getHours()) + p2(d.getMinutes()); }
  function fmtFull(t) { var d = new Date(t); return p2(d.getDate()) + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + ' ' + hm(d); }
  function fmtShort(t) {
    var d = new Date(t), same = d.getFullYear() === new Date().getFullYear();
    return p2(d.getDate()) + ' ' + MON[d.getMonth()] + ' ' + (same ? hm(d) : d.getFullYear());
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function newId() {
    return Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(14)), function (b) { return (b % 36).toString(36); }).join('');
  }
  var IC = {
    sort: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 6 6"/>',
    more: '<circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/>',
    pin: '<path d="M9 3h6l-1 6 3 3H7l3-3z"/><path d="M12 12v8"/>',
    notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
    hl: '<path d="M4 20h8"/><path d="M14 4l6 6-8 8H6v-6z"/>',
    bullets: '<path d="M4 6h16M4 12h10M4 18h16"/>',
    indent: '<path d="M4 6h16M10 12h10M10 18h10"/><path d="M4 10l3 2-3 2"/>',
    outdent: '<path d="M4 6h16M10 12h10M10 18h10"/><path d="M7 10l-3 2 3 2"/>',
    aL: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
    aC: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
    aR: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
    aJ: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    x: '<path d="M5 5l14 14M19 5L5 19"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'
  };
  function ic(n, color) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="' + (color || 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>';
  }

  /* ---------- sanitizer (notes may come from an imported backup) ---------- */
  var OK_TAGS = {}; 'P DIV BR B STRONG I EM U S STRIKE H1 H2 H3 BLOCKQUOTE UL OL LI A IMG TABLE TBODY THEAD TR TD TH HR SPAN FONT SUB SUP PRE CODE'.split(' ').forEach(function (t) { OK_TAGS[t] = 1; });
  var DROP_TAGS = {}; 'SCRIPT STYLE IFRAME OBJECT EMBED LINK META FORM INPUT BUTTON SVG MATH TEMPLATE NOSCRIPT TEXTAREA SELECT AUDIO VIDEO'.split(' ').forEach(function (t) { DROP_TAGS[t] = 1; });
  var OK_STYLE = {}; 'color background-color text-align line-height list-style-type width margin-left padding-left font-weight font-style text-decoration text-decoration-line'.split(' ').forEach(function (k) { OK_STYLE[k] = 1; });
  function safeStyle(s) {
    return s.split(';').map(function (x) { return x.trim(); }).filter(function (x) {
      var i = x.indexOf(':'); if (i < 0) return false;
      var k = x.slice(0, i).trim().toLowerCase(), v = x.slice(i + 1).toLowerCase();
      return OK_STYLE[k] && !/url\(|expression|javascript|@import|\\/.test(v);
    }).join('; ');
  }
  function sanitize(html) {
    var doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) return;
        if (ch.nodeType !== 1) { ch.remove(); return; }
        var tag = ch.tagName.toUpperCase();
        if (DROP_TAGS[tag]) { ch.remove(); return; }
        if (!OK_TAGS[tag]) { walk(ch); ch.replaceWith.apply(ch, Array.prototype.slice.call(ch.childNodes)); return; }
        if (tag === 'IMG' && !/^https:\/\/appassets\.notes\/pics\/[a-z0-9]{4,40}\.(jpg|png|gif|webp)$/.test(ch.getAttribute('src') || '')) { ch.remove(); return; }
        Array.prototype.slice.call(ch.attributes).forEach(function (a) {
          var n = a.name.toLowerCase(), v = a.value, keep = false;
          if (n === 'style') { var s = safeStyle(v); if (s) { ch.setAttribute('style', s); keep = true; } }
          else if (n === 'href' && tag === 'A') keep = /^(https?:|mailto:|tel:|note:)/i.test(v.trim());
          else if (n === 'src' && tag === 'IMG') keep = /^https:\/\/appassets\.notes\/pics\/[a-z0-9]{4,40}\.(jpg|png|gif|webp)$/.test(v);
          else if (n === 'class') keep = (v === 'check' && tag === 'UL');
          else if (n === 'data-c') keep = (tag === 'LI' && v === '1');
          else if (n === 'color' && tag === 'FONT') keep = /^#?[0-9a-z]{3,20}$/i.test(v);
          else if ((n === 'colspan' || n === 'rowspan') && /^\d{1,2}$/.test(v)) keep = true;
          if (!keep) ch.removeAttribute(a.name);
        });
        walk(ch);
      });
    })(doc.body);
    return doc.body.innerHTML;
  }

  /* ---------- card preview text ---------- */
  function roman(n, lower) {
    var m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']], r = '';
    m.forEach(function (p) { while (n >= p[0]) { r += p[1]; n -= p[0]; } });
    return lower ? r.toLowerCase() : r;
  }
  function alpha(n, lower) {
    var s = ''; while (n > 0) { var k = (n - 1) % 26; s = String.fromCharCode(65 + k) + s; n = Math.floor((n - 1) / 26); }
    return lower ? s.toLowerCase() : s;
  }
  function marker(type, i) {
    switch (type) {
      case 'upper-roman': return roman(i, false) + '.';
      case 'lower-roman': return roman(i, true) + '.';
      case 'upper-alpha': return alpha(i, false) + '.';
      case 'lower-alpha': return alpha(i, true) + '.';
      default: return i + '.';
    }
  }
  var DEPTH_TYPES = ['decimal', 'upper-alpha', 'decimal', 'lower-alpha'];
  function previewText(html) {
    var doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
    var out = '';
    function nl() { if (out && !/\n$/.test(out)) out += '\n'; }
    function kids(list, depth) { list.forEach(function (c) { one(c, depth); }); }
    function one(c, depth) {
      if (out.length > 600) return;
      if (c.nodeType === 3) { out += c.textContent.replace(/\s+/g, ' '); return; }
      if (c.nodeType !== 1) return;
      var t = c.tagName;
      if (t === 'UL' || t === 'OL') {
        nl();
        var i = 0, type = (c.style && c.style.listStyleType) || DEPTH_TYPES[Math.min(depth, 3)];
        var chk = t === 'UL' && c.classList.contains('check');
        Array.prototype.forEach.call(c.children, function (li) {
          if (li.tagName !== 'LI') return;
          i++; nl();
          out += '  '.repeat(depth) + (chk ? (li.getAttribute('data-c') === '1' ? '☑ ' : '☐ ') : (t === 'UL' ? '• ' : marker(type, i) + ' '));
          Array.prototype.forEach.call(li.childNodes, function (x) {
            if (x.nodeType === 1 && (x.tagName === 'UL' || x.tagName === 'OL')) one(x, depth + 1); else one(x, depth);
          });
        });
        nl(); return;
      }
      if (t === 'BR') { out += '\n'; return; }
      if (t === 'IMG' || t === 'HR') return;
      var block = /^(P|DIV|H1|H2|H3|BLOCKQUOTE|TR|TABLE|PRE)$/.test(t);
      if (block) nl();
      if (t === 'TD' || t === 'TH') out += ' ';
      kids(Array.prototype.slice.call(c.childNodes), depth);
      if (block) nl();
    }
    kids(Array.prototype.slice.call(doc.body.childNodes), 0);
    return out.split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).filter(function (l) { return l.trim(); }).slice(0, 5).join('\n');
  }
  function firstImg(html) { var m = /pics\/([a-z0-9]{4,40}\.(?:jpg|png|gif|webp))/.exec(html || ''); return m ? 'https://appassets.notes/pics/' + m[1] : ''; }
  function isEmptyNote(n, docEl) {
    if (n.title && n.title.trim()) return false;
    var d = new DOMParser().parseFromString('<body>' + (n.html || '') + '</body>', 'text/html');
    if (d.body.textContent.trim()) return false;
    return !d.body.querySelector('img,table,hr,ul.check');
  }

  /* ---------- state ---------- */
  var S = {
    view: 'home', notes: [], metaFolders: [], settings: { screenProtect: true, cleanPics: true, trashDays: 30 },
    ver: { name: '0.0.0', code: 0 }, platform: 'android', filter: { k: 'all', v: '' }, chip: 'all', q: '', sort: 'edited',
    cur: null, curNew: false, range: null, img: null, lastHl: '#fff176', colorOpen: false, promptCb: null, saveT: 0, dirty: false
  };
  function load() {
    try { S.platform = (A.getPlatform && A.getPlatform()) || 'android'; } catch (e) { }
    try { S.settings = JSON.parse(A.getSettings()); } catch (e) { }
    try { S.ver = JSON.parse(A.getVersion()); } catch (e) { }
    try { S.notes = JSON.parse(A.getNotes()).filter(function (n) { return n && n.id; }).map(function (n) { n.html = n.html || ''; n.tags = n.tags || []; n.folder = n.folder || ''; n.deletedAt = n.deletedAt || 0; return n; }); } catch (e) { S.notes = []; }
    try { S.metaFolders = JSON.parse(A.getMeta()).folders || []; } catch (e) { S.metaFolders = []; }
  }
  function live() { return S.notes.filter(function (n) { return !n.deletedAt; }); }
  function trashed() { return S.notes.filter(function (n) { return n.deletedAt; }).sort(function (a, b) { return b.deletedAt - a.deletedAt; }); }
  function folders() {
    var s = {}; S.metaFolders.forEach(function (f) { s[f] = 1; });
    live().forEach(function (n) { if (n.folder) s[n.folder] = 1; });
    return Object.keys(s).sort(function (a, b) { return a.localeCompare(b); });
  }
  function tagCounts() {
    var c = {}; live().forEach(function (n) { (n.tags || []).forEach(function (t) { c[t] = (c[t] || 0) + 1; }); });
    return c;
  }
  function saveMeta() { try { A.setMeta(JSON.stringify({ folders: S.metaFolders })); } catch (e) { } }
  function persist(n) { try { A.saveNote(JSON.stringify(n)); } catch (e) { } }
  function visible() {
    var q = S.q.trim().toLowerCase();
    var list = live().filter(function (n) {
      if (S.filter.k === 'folder' && n.folder !== S.filter.v) return false;
      if (S.filter.k === 'tag' && (n.tags || []).indexOf(S.filter.v) < 0) return false;
      if (S.chip === 'check' && n.html.indexOf('class="check"') < 0) return false;
      if (S.chip === 'pic' && n.html.indexOf('<img') < 0) return false;
      if (q) {
        var hay = ((n.title || '') + ' ' + previewTextFull(n.html) + ' ' + (n.tags || []).join(' ') + ' ' + (n.folder || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    list.sort(function (a, b) {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      if (S.sort === 'title') return (a.title || '').localeCompare(b.title || '');
      if (S.sort === 'created') return b.created - a.created;
      return b.edited - a.edited;
    });
    return list;
  }
  function previewTextFull(html) {
    var d = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
    return d.body.textContent || '';
  }

  /* ---------- rendering ---------- */
  function setBar(cls) { $('#app').className = cls; }
  function navHtml(active) {
    function b(v, ico, lbl) { return '<button class="' + (active === v ? 'on' : '') + '" data-act="go" data-v="' + v + '">' + ic(ico) + lbl + '</button>'; }
    return '<div class="nav">' + b('home', 'notes', 'Notes') + b('folders', 'folder', 'Folders') + b('tags', 'tag', 'Tags') + b('settings', 'gear', 'Settings') + '</div>';
  }
  function render() {
    $('#stamp').textContent = 'v' + S.ver.name + ' (Build ' + S.ver.code + ')';
    $('#ctx').innerHTML = '';
    if (S.view === 'editor') { setBar('bar-edit'); renderEditor(); return; }
    setBar('bar-nav');
    var active = S.view === 'trash' ? 'settings' : S.view;
    $('#bottom').innerHTML = navHtml(active);
    if (S.view === 'home') renderHome();
    else if (S.view === 'folders') renderFolders();
    else if (S.view === 'tags') renderTags();
    else if (S.view === 'settings') renderSettings();
    else if (S.view === 'trash') renderTrash();
    $('#screen').scrollTop = 0;
  }
  function chipHtml(k, label) {
    var on = (k === S.chip && (k !== 'all' || true)) && !(k === 'folders' || k === 'tags');
    return '<button class="chip' + (on ? ' on' : '') + '" data-act="chip" data-v="' + k + '">' + label + '</button>';
  }
  function renderHome() {
    var f = S.filter;
    var title = f.k === 'folder' ? f.v : f.k === 'tag' ? '#' + f.v : 'Notes';
    var fl = folders();
    var fHtml = '';
    if (f.k === 'all' && fl.length) {
      fHtml = '<div class="lbl"><span>FOLDERS</span></div><div class="folders">' + fl.map(function (n) {
        return '<button class="folder" data-act="openFolder" data-v="' + esc(n) + '">' + ic('folder') + '<span>' + esc(n) + '</span></button>';
      }).join('') + '</div>';
    }
    $('#screen').innerHTML =
      '<div class="hdr"><h1>' + esc(title) + '</h1><button class="round" data-act="sortSheet" aria-label="Sort">' + ic('sort') + '</button></div>' +
      '<label class="search">' + ic('search', '#a8a8a8') + '<input id="q" type="search" placeholder="Search notes" value="' + esc(S.q) + '" autocomplete="off"></label>' +
      '<div class="chips">' + chipHtml('all', 'All') + chipHtml('folders', 'Folders') + chipHtml('tags', 'Tags') + chipHtml('check', 'Checklists') + chipHtml('pic', 'Pictures') + '</div>' +
      fHtml + '<div class="lbl"><span>' + (S.q ? 'RESULTS' : 'NOTES') + '</span></div><div class="grid" id="grid"></div>' +
      '<button class="fab" data-act="new" aria-label="New note">' + ic('plus', '#fff') + '</button>';
    drawGrid();
  }
  function drawGrid() {
    var list = visible(), g = $('#grid');
    if (!g) return;
    if (!list.length) {
      g.innerHTML = '<div class="empty">' + (S.q || S.chip !== 'all' || S.filter.k !== 'all' ? 'No notes match.' : 'No notes yet.<br>Tap + to write one.') + '</div>';
      return;
    }
    g.innerHTML = list.map(function (n) {
      var img = firstImg(n.html), prev = previewText(n.html);
      var tagH = n.folder ? '<span class="tag">' + esc(n.folder) + '</span>' : (n.tags && n.tags[0] ? '<span class="tag">' + esc(n.tags[0]) + '</span>' : '<span></span>');
      return '<button class="card" data-act="open" data-id="' + n.id + '">' +
        '<span class="t"><span>' + esc(n.title || 'Untitled') + '</span>' + (n.pinned ? ic('pin') : '') + '</span>' +
        (img ? '<span class="th" style="background-image:url(\'' + toLocal(img) + '\')"></span>' : '') +
        (prev ? '<span class="s">' + esc(prev) + '</span>' : '') +
        '<span class="f">' + tagH + '<span class="date">' + fmtShort(n.edited) + '</span></span></button>';
    }).join('');
  }
  function renderFolders() {
    var fl = folders(), live_ = live();
    var rows = '<div class="rows"><button class="row" data-act="chip" data-v="all"><span class="a"><b>All notes</b><span>' + live_.length + ' notes</span></span>' + ic('chev') + '</button>';
    fl.forEach(function (f) {
      var c = live_.filter(function (n) { return n.folder === f; }).length;
      rows += '<div class="row"><button class="a" style="flex:1;text-align:left" data-act="openFolder" data-v="' + esc(f) + '"><b>' + esc(f) + '</b><span>' + c + ' notes</span></button>' +
        '<button class="round" style="width:36px;height:36px" data-act="folderMenu" data-v="' + esc(f) + '" aria-label="Folder options">' + ic('more') + '</button></div>';
    });
    rows += '</div>';
    $('#screen').innerHTML = '<div class="hdr"><h1>Folders</h1><button class="round" data-act="newFolder" aria-label="New folder">' + ic('plus') + '</button></div>' + rows;
  }
  function renderTags() {
    var c = tagCounts(), keys = Object.keys(c).sort(function (a, b) { return a.localeCompare(b); });
    var rows = keys.length ? '<div class="rows">' + keys.map(function (t) {
      return '<button class="row" data-act="openTag" data-v="' + esc(t) + '"><span class="a"><b>#' + esc(t) + '</b><span>' + c[t] + ' notes</span></span>' + ic('chev') + '</button>';
    }).join('') + '</div>' : '<div class="empty">No tags yet.<br>Add tags from inside a note.</div>';
    $('#screen').innerHTML = '<div class="hdr"><h1>Tags</h1></div>' + rows;
  }
  function sw(k) { return '<span class="sw' + (S.settings[k] ? ' on' : '') + '"><i></i></span>'; }
  function renderSettings() {
    var tr = trashed().length;
    $('#screen').innerHTML =
      '<div class="hdr"><h1>Settings</h1></div><div class="rows">' +
      '<div class="lbl" style="padding:4px 0 0"><span>PRIVACY</span></div>' +
      (S.platform === 'linux' ? '' : '<button class="row" data-act="toggle" data-v="screenProtect"><span class="a"><b>Screen protection</b><span>' + (S.platform === 'windows' ? 'Hidden from screenshots and screen recording' : 'Blank in app switcher, no screenshots') + '</span></span>' + sw('screenProtect') + '</button>') +
      '<button class="row" data-act="toggle" data-v="cleanPics"><span class="a"><b>Clean hidden info from pictures</b><span>Location and device data removed on insert</span></span>' + sw('cleanPics') + '</button>' +
      '<div class="lbl" style="padding:10px 0 0"><span>TRASH</span></div>' +
      '<button class="row" data-act="trashDays"><span class="a"><b>Keep deleted notes</b></span><span class="pill">' + S.settings.trashDays + ' days</span></button>' +
      '<button class="row" data-act="go" data-v="trash"><span class="a"><b>Open trash</b><span>' + tr + ' deleted notes</span></span>' + ic('chev') + '</button>' +
      '<div class="lbl" style="padding:10px 0 0"><span>BACKUP</span></div>' +
      '<div class="btns"><button class="btn pri" data-act="export">Export backup</button><button class="btn" data-act="importAsk">Import backup</button></div>' +
      '<div class="note">One file with all notes and pictures. Move it with NightSend.</div>' +
      '<div class="lbl" style="padding:10px 0 0"><span>DATE AND TIME</span></div>' +
      '<div class="row"><span class="a"><b>Military 24-hour</b><span>21 NOV 2026 2048</span></span><span class="radio"></span></div>' +
      '<div class="lbl" style="padding:10px 0 0"><span>UPDATES</span></div>' +
      '<button class="row" data-act="releases"><span class="a"><b>Open GitHub Releases</b></span>' + ic('chev') + '</button>' +
      '<div class="note">Notes ' + esc(S.ver.name) + ' (Build ' + S.ver.code + ')</div></div>';
  }
  function renderTrash() {
    var t = trashed(), days = S.settings.trashDays;
    var rows = t.length ? t.map(function (n) {
      var left = Math.max(0, Math.ceil(days - (Date.now() - n.deletedAt) / 86400000));
      return '<div class="row" style="flex-wrap:wrap"><span class="a" style="flex:1 1 100%"><b>' + esc(n.title || 'Untitled') + '</b><span>Deleted ' + fmtFull(n.deletedAt) + ' · ' + left + ' days left</span></span>' +
        '<span class="btns" style="flex:1 1 100%"><button class="btn" style="height:40px" data-act="restore" data-id="' + n.id + '">Restore</button><button class="btn red" style="height:40px" data-act="purgeAsk" data-id="' + n.id + '">Delete forever</button></span></div>';
    }).join('') : '<div class="empty">Trash is empty.</div>';
    $('#screen').innerHTML = '<div class="ehdr"><button class="round" data-act="go" data-v="settings" aria-label="Back">' + ic('back') + '</button>' +
      (t.length ? '<button class="cb" data-act="emptyAsk">Empty trash</button>' : '') + '</div><div class="hdr" style="padding-top:12px"><h1>Trash</h1></div><div class="rows">' + rows + '</div>';
  }

  /* ---------- sheets and toast ---------- */
  function openSheet(html) {
    $('#sheetWrap').innerHTML = '<div class="scrim" data-act="closeSheet"></div><div class="sheet"><span class="handle"></span>' + html + '</div>';
  }
  function closeSheet() { $('#sheetWrap').innerHTML = ''; }
  function sheetOpen() { return !!$('#sheetWrap').firstChild; }
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function promptSheet(title, ph, value, cb) {
    S.promptCb = cb;
    openSheet('<h3>' + esc(title) + '</h3><input id="pin" class="inp" placeholder="' + esc(ph) + '" value="' + esc(value || '') + '" maxlength="60" autocomplete="off"><div class="btns"><button class="btn pri" data-act="promptOk">OK</button><button class="btn" data-act="closeSheet">Cancel</button></div>');
    setTimeout(function () { var i = $('#pin'); if (i) i.focus(); }, 50);
  }
  function confirmSheet(msg, okLabel, cb, red) {
    S.promptCb = cb;
    openSheet('<div class="msg">' + esc(msg) + '</div><div class="btns"><button class="btn ' + (red ? 'red' : 'pri') + '" data-act="confirmOk">' + esc(okLabel) + '</button><button class="btn" data-act="closeSheet">Cancel</button></div>');
  }

  /* ---------- editor ---------- */
  function openEditor(n, isNew) { S.cur = n; S.curNew = isNew; S.img = null; S.range = null; S.view = 'editor'; render(); if (isNew) $('#title').focus(); }
  function renderEditor() {
    var n = S.cur;
    $('#screen').innerHTML =
      '<div class="ehdr"><button class="round" data-act="back" aria-label="Back">' + ic('back') + '</button>' +
      '<span class="g"><button class="round nofocus" data-act="undo" aria-label="Undo">' + ic('undo') + '</button><button class="round" data-act="more" aria-label="More">' + ic('more') + '</button></span></div>' +
      '<div class="meta" id="meta"></div>' +
      '<input id="title" class="etitle" placeholder="Title" value="' + esc(n.title) + '" maxlength="200" autocomplete="off" enterkeyhint="next">' +
      '<div class="stampline" id="stampline"></div>' +
      '<div class="doc" id="doc" contenteditable="true" spellcheck="true"></div>';
    $('#doc').innerHTML = toLocal(sanitize(n.html)) || '<p><br></p>';
    drawMeta(); drawStampline();
    function tb(act, data, inner, label) { return '<button class="tb nofocus" data-act="' + act + '" ' + data + ' aria-label="' + label + '">' + inner + '</button>'; }
    $('#bottom').innerHTML = '<div class="tbar">' +
      tb('cmd', 'data-c="bold"', '<b>B</b>', 'Bold') +
      tb('cmd', 'data-c="italic"', '<i>I</i>', 'Italic') +
      tb('cmd', 'data-c="underline"', '<u>U</u>', 'Underline') +
      tb('styles', '', '<b style="font-size:15px">H</b>', 'Paragraph and list styles') +
      tb('list', 'data-k="upper-roman"', '<b style="font-size:13px">I.</b>', 'Roman numeral list') +
      tb('list', 'data-k="bullet"', ic('bullets'), 'Bullet list') +
      tb('linkSheet', '', ic('link'), 'Link') +
      tb('pic', '', ic('image'), 'Insert picture') +
      tb('table', '', ic('table'), 'Insert table') +
      tb('hlQuick', '', ic('hl'), 'Highlight') + '</div>';
    var d = $('#doc'), t = $('#title');
    d.addEventListener('input', function (e) {
      if (e.inputType === 'insertParagraph') fixCheckItem();
      markDirty();
    });
    d.addEventListener('click', docClick);
    d.addEventListener('paste', docPaste);
    t.addEventListener('input', markDirty);
    t.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); d.focus(); } });
  }
  function drawMeta() {
    var n = S.cur, h = '<button class="tag' + (n.folder ? '' : ' g') + '" data-act="pickFolder">' + esc(n.folder || 'No folder') + '</button>';
    (n.tags || []).forEach(function (t) { h += '<button class="tag g" data-act="editTags">#' + esc(t) + '</button>'; });
    h += '<button class="tag g" data-act="editTags">+ Tag</button>';
    var m = $('#meta'); if (m) m.innerHTML = h;
  }
  function drawStampline() {
    var n = S.cur, s = $('#stampline'); if (s) s.textContent = 'Created ' + fmtFull(n.created) + ' · Edited ' + fmtFull(n.edited);
  }
  function markDirty() { S.dirty = true; clearTimeout(S.saveT); S.saveT = setTimeout(flush, 600); }
  function collect() {
    var n = S.cur, d = $('#doc'), t = $('#title');
    if (!n || !d) return false;
    n.title = (t ? t.value : n.title).trim();
    var clone = d.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('img.sel'), function (i) { i.classList.remove('sel'); if (!i.getAttribute('class')) i.removeAttribute('class'); });
    n.html = toCanon(clone.innerHTML);
    return true;
  }
  function flush() {
    clearTimeout(S.saveT);
    if (S.view !== 'editor' || !S.cur || !S.dirty) return;
    if (!collect()) return;
    var n = S.cur;
    if (S.curNew && isEmptyNote(n)) return;
    n.edited = Date.now();
    if (S.notes.indexOf(n) < 0) S.notes.push(n);
    persist(n); S.dirty = false; drawStampline();
  }
  function closeEditor() {
    flush();
    var n = S.cur;
    if (n && S.curNew && isEmptyNote(n)) {
      var i = S.notes.indexOf(n);
      if (i >= 0) { S.notes.splice(i, 1); try { A.deleteNoteForever(n.id); } catch (e) { } }
    }
    S.cur = null; S.img = null; S.view = 'home'; render();
  }

  /* selection helpers */
  function inDoc(node) { var d = $('#doc'); return d && node && d.contains(node); }
  function saveRange() {
    var s = getSelection();
    if (s.rangeCount && inDoc(s.anchorNode)) S.range = s.getRangeAt(0).cloneRange();
  }
  function restoreRange() {
    var d = $('#doc'); if (!d) return;
    var s = getSelection();
    if (S.range && inDoc(S.range.startContainer)) { s.removeAllRanges(); s.addRange(S.range); }
    else { var r = document.createRange(); r.selectNodeContents(d); r.collapse(false); s.removeAllRanges(); s.addRange(r); }
  }
  function withSel(fn) {
    if (S.view !== 'editor') return;
    var d = $('#doc'); restoreRange(); d.focus();
    try { fn(); } catch (e) { }
    saveRange(); markDirty(); updateCtx(); updateToolbar();
  }
  function exec(c, v) { return document.execCommand(c, false, v == null ? null : v); }
  function curList() {
    var s = getSelection(); if (!s.rangeCount) return null;
    var n = s.anchorNode, d = $('#doc');
    while (n && n !== d) { if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) return n; n = n.parentNode; }
    return null;
  }
  function curLi() {
    var s = getSelection(); if (!s.rangeCount) return null;
    var n = s.anchorNode, d = $('#doc');
    while (n && n !== d) { if (n.nodeType === 1 && n.tagName === 'LI') return n; n = n.parentNode; }
    return null;
  }
  function curClosest(sel) {
    var s = getSelection(); if (!s.rangeCount) return null;
    var n = s.anchorNode; if (n && n.nodeType === 3) n = n.parentElement;
    return n && inDoc(n) ? n.closest(sel) : null;
  }
  function swapTag(el, tag) {
    var n = document.createElement(tag);
    while (el.firstChild) n.appendChild(el.firstChild);
    el.replaceWith(n); return n;
  }
  function fixCheckItem() {
    var li = curLi(); if (li && li.getAttribute('data-c')) li.removeAttribute('data-c');
  }
  function setList(k) {
    var cur = curList();
    if (k === 'bullet') {
      if (cur && cur.tagName === 'UL' && !cur.classList.contains('check')) { exec('insertUnorderedList'); return; }
      if (cur) { var u = swapTag(cur, 'ul'); u.removeAttribute('class'); u.removeAttribute('style'); return; }
      exec('insertUnorderedList'); return;
    }
    if (k === 'check') {
      if (cur && cur.tagName === 'UL' && cur.classList.contains('check')) { exec('insertUnorderedList'); return; }
      if (cur) { var c = cur.tagName === 'UL' ? cur : swapTag(cur, 'ul'); c.removeAttribute('style'); c.className = 'check'; return; }
      exec('insertUnorderedList'); var nc = curList(); if (nc) nc.className = 'check'; return;
    }
    if (cur && cur.tagName === 'OL') {
      if (cur.style.listStyleType === k) { exec('insertOrderedList'); return; }
      cur.style.listStyleType = k; return;
    }
    if (cur) { var o = swapTag(cur, 'ol'); o.removeAttribute('class'); o.style.listStyleType = k; return; }
    exec('insertOrderedList'); var no = curList(); if (no) no.style.listStyleType = k;
  }
  function indentMore() {
    exec('indent');
    var c = curList();
    if (c && c.tagName === 'UL' && c.parentElement) { var p = c.parentElement.closest('ul.check'); if (p) c.className = 'check'; }
  }
  function blocksInRange() {
    var s = getSelection(); if (!s.rangeCount) return [];
    var r = s.getRangeAt(0), d = $('#doc');
    var all = Array.prototype.slice.call(d.querySelectorAll('p,div,h1,h2,h3,li,blockquote'));
    var hit = all.filter(function (b) { try { return r.intersectsNode(b); } catch (e) { return false; } });
    if (!hit.length) { var b = curClosest('p,div,h1,h2,h3,li,blockquote'); if (b && b !== d) hit = [b]; }
    return hit.filter(function (b) { return !b.querySelector('p,div,li,h1,h2,h3,blockquote'); });
  }
  var SPACING = [1, 1.25, 1.5, 2];
  function spacingNow() {
    var b = blocksInRange()[0]; var v = b && parseFloat(b.style.lineHeight);
    return v || 1.6;
  }
  function cycleSpacing() {
    var cur = spacingNow(), i = SPACING.indexOf(cur), nx = SPACING[(i + 1) % SPACING.length];
    blocksInRange().forEach(function (b) { b.style.lineHeight = String(nx); });
    return nx;
  }
  function applyColor(c) { exec('styleWithCSS', true); exec('foreColor', c); exec('styleWithCSS', false); }
  function hlState() {
    var v = ''; try { v = document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor') || ''; } catch (e) { }
    return /^rgb\(/.test(v);
  }
  function applyHl(c) {
    exec('styleWithCSS', true);
    if (c === 'none') {
      exec('hiliteColor', 'transparent');
      Array.prototype.forEach.call($('#doc').querySelectorAll('span'), function (sp) {
        if (sp.style.backgroundColor === 'transparent') { sp.style.removeProperty('background-color'); if (!sp.getAttribute('style')) sp.removeAttribute('style'); }
      });
    } else { S.lastHl = c; exec('hiliteColor', c); }
    exec('styleWithCSS', false);
  }
  function normalizeLink(v) {
    v = v.trim(); if (!v) return '';
    if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'mailto:' + v;
    if (/^\+?[\d\s\-().]{5,}$/.test(v)) return 'tel:' + v.replace(/[\s\-().]/g, '');
    if (/^[^\s]+\.[a-z]{2,}([\/?#].*)?$/i.test(v)) return 'https://' + v;
    return '';
  }
  function makeLink(href, label) {
    var a = curClosest('a');
    if (a) { a.setAttribute('href', href); return; }
    var s = getSelection();
    if (s.isCollapsed) exec('insertHTML', '<a href="' + esc(href) + '">' + esc(label || href.replace(/^(mailto:|tel:)/, '')) + '</a>&nbsp;');
    else exec('createLink', href);
  }
  function docClick(e) {
    var t = e.target;
    if (t.tagName === 'IMG') { setImg(t); return; }
    setImg(null);
    var li = t.closest && t.closest('li');
    if (li && li.parentElement && li.parentElement.classList.contains('check') && t === li) {
      var r = li.getBoundingClientRect();
      if (e.clientX - r.left < 36 && e.clientY - r.top < 40) {
        if (li.getAttribute('data-c') === '1') li.removeAttribute('data-c'); else li.setAttribute('data-c', '1');
        markDirty(); e.preventDefault(); return;
      }
    }
    var a = t.closest && t.closest('a');
    if (a) {
      e.preventDefault();
      var href = a.getAttribute('href') || '';
      if (href.indexOf('note:') === 0) {
        var id = href.slice(5), n = S.notes.filter(function (x) { return x.id === id && !x.deletedAt; })[0];
        if (n) { flush(); openEditor(n, false); } else toast('That note is gone.');
      } else A.openLink(href);
    }
  }
  function docPaste(e) {
    var cd = e.clipboardData; if (!cd) return;
    e.preventDefault();
    var html = cd.getData('text/html'), text = cd.getData('text/plain');
    if (html) exec('insertHTML', toLocal(sanitize(toCanon(html)))); else if (text) exec('insertText', text);
  }
  function setImg(el) {
    if (S.img && S.img !== el) { S.img.classList.remove('sel'); if (!S.img.getAttribute('class')) S.img.removeAttribute('class'); }
    S.img = el; if (el) el.classList.add('sel');
    updateCtx();
  }
  function blockOf(el) { var d = $('#doc'), b = el; while (b.parentElement && b.parentElement !== d) b = b.parentElement; return b; }
  function ensureTail() {
    var d = $('#doc'), last = d.lastElementChild;
    if (!last || last.querySelector('img,table') || last.tagName === 'HR' || last.tagName === 'IMG' || last.tagName === 'TABLE') d.appendChild(Object.assign(document.createElement('p'), { innerHTML: '<br>' }));
  }
  function updateCtx() {
    var c = $('#ctx'), app = $('#app');
    if (S.view !== 'editor') { c.innerHTML = ''; return; }
    var h = '';
    if (S.img && inDoc(S.img)) {
      h = '<div class="ctxbar"><button class="cb nofocus" data-act="imgSize" data-v="25">25%</button><button class="cb nofocus" data-act="imgSize" data-v="50">50%</button><button class="cb nofocus" data-act="imgSize" data-v="75">75%</button><button class="cb nofocus" data-act="imgSize" data-v="100">100%</button>' +
        '<button class="cb nofocus" data-act="imgMove" data-v="up">Move up</button><button class="cb nofocus" data-act="imgMove" data-v="down">Move down</button><button class="cb nofocus" data-act="imgDel">Delete</button></div>';
    } else if (curClosest('td,th')) {
      h = '<div class="ctxbar"><button class="cb nofocus" data-act="tbl" data-v="addRow">+ Row</button><button class="cb nofocus" data-act="tbl" data-v="addCol">+ Column</button><button class="cb nofocus" data-act="tbl" data-v="delRow">− Row</button><button class="cb nofocus" data-act="tbl" data-v="delCol">− Column</button><button class="cb nofocus" data-act="tbl" data-v="delTbl">Delete table</button></div>';
    }
    if (c.innerHTML !== h) c.innerHTML = h;
    app.className = 'bar-edit' + (h ? ' has-ctx' : '');
  }
  function updateToolbar() {
    Array.prototype.forEach.call(document.querySelectorAll('.tb[data-act="cmd"]'), function (b) {
      var on = false; try { on = document.queryCommandState(b.getAttribute('data-c')); } catch (e) { }
      b.classList.toggle('on', !!on);
    });
    var hb = document.querySelector('.tb[data-act="hlQuick"]'); if (hb) hb.classList.toggle('on', hlState());
  }
  function tableOp(op) {
    var cell = curClosest('td,th'); if (!cell) return;
    var row = cell.parentElement, tbl = cell.closest('table'), idx = cell.cellIndex;
    var rows = Array.prototype.slice.call(tbl.rows);
    function blank(tag) { var c = document.createElement(tag || 'td'); c.innerHTML = '<br>'; return c; }
    if (op === 'addRow') { var nr = document.createElement('tr'); for (var i = 0; i < row.cells.length; i++) nr.appendChild(blank()); row.after(nr); }
    else if (op === 'addCol') rows.forEach(function (r) { var c = blank(r === rows[0] ? 'td' : 'td'); r.cells[Math.min(idx, r.cells.length - 1)].after(c); });
    else if (op === 'delRow') { if (rows.length <= 1) tbl.remove(); else row.remove(); }
    else if (op === 'delCol') { if (row.cells.length <= 1) tbl.remove(); else rows.forEach(function (r) { if (r.cells[idx]) r.cells[idx].remove(); }); }
    else if (op === 'delTbl') tbl.remove();
    ensureTail();
  }

  /* ---------- sheets for the editor ---------- */
  var COLORS = ['#ffffff', '#ff8787', '#ffa94d', '#ffe066', '#69db7c', '#74c0fc', '#b197fc', '#aab2ff'];
  var HLS = [['#fff176', 'Yellow'], ['#a5d6a7', 'Green'], ['#f8a5c2', 'Pink'], ['#ffcc80', 'Orange'], ['#90caf9', 'Blue']];
  function stylesSheet() {
    var cur = curList(), eff = '', isCheck = false;
    if (cur) { eff = cur.tagName === 'UL' ? (cur.classList.contains('check') ? 'check' : 'bullet') : (cur.style.listStyleType || ''); }
    function o(k, big, lbl) { return '<button class="opt nofocus' + (eff === k ? ' on' : '') + '" data-act="list" data-k="' + k + '" data-close="1"><b>' + big + '</b>' + lbl + '</button>'; }
    var al = ''; var cs = getComputedStyle($('#doc'));
    var blk = blocksInRange()[0], ta = blk ? getComputedStyle(blk).textAlign : 'left';
    function a(k, ico, lbl) { var on = (k === 'Left' && (ta === 'left' || ta === 'start')) || (k === 'Center' && ta === 'center') || (k === 'Right' && ta === 'right') || (k === 'Full' && ta === 'justify'); return '<button class="ib nofocus' + (on ? ' on' : '') + '" data-act="align" data-v="' + k + '" aria-label="' + lbl + '">' + ic(ico) + '</button>'; }
    var tag = blk ? (blk.closest('h1,h2,blockquote') ? blk.closest('h1,h2,blockquote').tagName : 'P') : 'P';
    function pc(k, lbl) { return '<button class="chip nofocus' + (tag === k ? ' on' : '') + '" data-act="block" data-v="' + k + '">' + lbl + '</button>'; }
    var colorRow = S.colorOpen ? '<div class="dots">' + COLORS.map(function (c) { return '<button class="dot nofocus" style="background:' + c + '" data-act="color" data-v="' + c + '" aria-label="Color ' + c + '"></button>'; }).join('') + '</div>' : '';
    var hl = '<div class="dots"><button class="dot nofocus" data-act="hl" data-v="none" aria-label="No highlight">' + ic('x', '#fff') + '</button>' + HLS.map(function (h) {
      return '<button class="dot nofocus' + (S.lastHl === h[0] ? ' on' : '') + '" style="background:' + h[0] + '" data-act="hl" data-v="' + h[0] + '" aria-label="' + h[1] + '"></button>';
    }).join('') + '</div>';
    openSheet(
      '<div class="sh">LIST STYLE</div><div class="g3">' + o('bullet', '• •', 'Bullets') + o('decimal', '1. 2. 3.', 'Numbers') + o('upper-roman', 'I. II. III.', 'Roman') +
      o('lower-roman', 'i. ii. iii.', 'Small roman') + o('upper-alpha', 'A. B. C.', 'Letters') + o('lower-alpha', 'a. b. c.', 'Small letters') + '</div>' +
      '<div class="irow">' + '<button class="ib nofocus' + (eff === 'check' ? ' on' : '') + '" data-act="list" data-k="check" data-close="1">Checklist</button>' +
      '<button class="ib nofocus" data-act="indent">' + ic('indent') + 'Indent</button><button class="ib nofocus" data-act="outdent">' + ic('outdent') + 'Outdent</button></div>' +
      '<div class="sh">PARAGRAPH</div><div class="irow">' + a('Left', 'aL', 'Align left') + a('Center', 'aC', 'Align center') + a('Right', 'aR', 'Align right') + a('Full', 'aJ', 'Justify') + '</div>' +
      '<div class="wrapchips">' + pc('P', 'Paragraph') + pc('H1', 'Heading 1') + pc('H2', 'Heading 2') + pc('BLOCKQUOTE', 'Quote') + '<button class="chip nofocus" data-act="block" data-v="HR">Divider</button></div>' +
      '<div class="irow"><button class="ib nofocus" style="justify-content:space-between;padding:0 14px" data-act="spacing"><span>Line spacing</span><b id="spv" style="color:#aab2ff">' + spacingNow() + '</b></button>' +
      '<button class="ib nofocus" style="justify-content:space-between;padding:0 14px" data-act="colorToggle"><span>Text color</span><span style="width:18px;height:18px;border-radius:9px;background:#313a82;border:2px solid #fff"></span></button></div>' + colorRow +
      '<div class="sh">HIGHLIGHT</div>' + hl);
  }
  function linkSheet() {
    saveRange();
    var a = curClosest('a');
    var notes = live().filter(function (n) { return !S.cur || n.id !== S.cur.id; }).sort(function (x, y) { return y.edited - x.edited; }).slice(0, 30);
    openSheet('<h3>Link</h3><input id="lurl" class="inp" placeholder="Web address, phone or email" value="' + esc(a && a.getAttribute('href').indexOf('note:') !== 0 ? a.getAttribute('href') : '') + '" autocomplete="off" autocapitalize="off"><div class="err" id="lerr"></div>' +
      '<div class="btns"><button class="btn pri" data-act="applyLink">Apply</button>' + (a ? '<button class="btn" data-act="unlink">Remove link</button>' : '') + '</div>' +
      (notes.length ? '<div class="sh">LINK TO A NOTE</div>' + notes.map(function (n) { return '<button class="row" data-act="linkNote" data-id="' + n.id + '"><span class="a"><b>' + esc(n.title || 'Untitled') + '</b></span>' + ic('chev') + '</button>'; }).join('') : ''));
  }
  function folderSheet() {
    var n = S.cur;
    openSheet('<h3>Folder</h3>' + '<button class="row" data-act="setFolder" data-v=""><span class="a"><b>No folder</b></span>' + (!n.folder ? '<span class="radio"></span>' : '') + '</button>' +
      folders().map(function (f) { return '<button class="row" data-act="setFolder" data-v="' + esc(f) + '"><span class="a"><b>' + esc(f) + '</b></span>' + (n.folder === f ? '<span class="radio"></span>' : '') + '</button>'; }).join('') +
      '<button class="row" data-act="newFolderFor"><span class="a"><b>New folder…</b></span>' + ic('plus') + '</button>');
  }
  function tagsSheet() {
    promptSheet('Tags', 'Separate with commas', (S.cur.tags || []).join(', '), function (v) {
      var seen = {}, tags = [];
      v.split(',').forEach(function (t) { t = t.trim().replace(/^#+/, '').slice(0, 30); if (t && !seen[t.toLowerCase()] && tags.length < 10) { seen[t.toLowerCase()] = 1; tags.push(t); } });
      S.cur.tags = tags; drawMeta(); S.dirty = true; flushForce();
    });
  }
  function flushForce() { S.dirty = true; flush(); }

  /* ---------- actions ---------- */
  function go(v) { if (S.view === 'editor') closeEditor(); S.view = v; S.img = null; render(); }
  function newNote() {
    var n = { id: newId(), title: '', html: '', folder: S.filter.k === 'folder' ? S.filter.v : '', tags: S.filter.k === 'tag' ? [S.filter.v] : [], pinned: false, created: Date.now(), edited: Date.now(), deletedAt: 0 };
    openEditor(n, true);
  }
  function addFolder(name) {
    name = (name || '').trim(); if (!name) return '';
    if (folders().indexOf(name) < 0) { S.metaFolders.push(name); saveMeta(); }
    return name;
  }
  var ACT = {
    go: function (el) { S.filter = { k: 'all', v: '' }; go(el.dataset.v); },
    chip: function (el) {
      var v = el.dataset.v;
      if (v === 'folders') { go('folders'); return; }
      if (v === 'tags') { go('tags'); return; }
      S.chip = v; if (v === 'all') { S.filter = { k: 'all', v: '' }; S.q = ''; }
      if (S.view !== 'home') S.view = 'home';
      render();
    },
    sortSheet: function () {
      function r(k, l) { return '<button class="row" data-act="setSort" data-v="' + k + '"><span class="a"><b>' + l + '</b></span>' + (S.sort === k ? '<span class="radio"></span>' : '') + '</button>'; }
      openSheet('<h3>Sort notes</h3>' + r('edited', 'Last edited') + r('created', 'Date created') + r('title', 'Title, A to Z'));
    },
    setSort: function (el) { S.sort = el.dataset.v; closeSheet(); render(); },
    new: newNote,
    open: function (el) { var n = S.notes.filter(function (x) { return x.id === el.dataset.id; })[0]; if (n) openEditor(n, false); },
    openFolder: function (el) { S.filter = { k: 'folder', v: el.dataset.v }; S.chip = 'all'; S.q = ''; S.view = 'home'; render(); },
    openTag: function (el) { S.filter = { k: 'tag', v: el.dataset.v }; S.chip = 'all'; S.q = ''; S.view = 'home'; render(); },
    newFolder: function () { promptSheet('New folder', 'Folder name', '', function (v) { addFolder(v); render(); }); },
    folderMenu: function (el) {
      var f = el.dataset.v;
      openSheet('<h3>' + esc(f) + '</h3><button class="row" data-act="renameFolder" data-v="' + esc(f) + '"><span class="a"><b>Rename</b></span></button><button class="row" data-act="deleteFolderAsk" data-v="' + esc(f) + '"><span class="a"><b>Delete folder</b><span>Notes stay, with no folder</span></span></button>');
    },
    renameFolder: function (el) {
      var f = el.dataset.v;
      promptSheet('Rename folder', 'Folder name', f, function (v) {
        v = (v || '').trim(); if (!v || v === f) return;
        S.metaFolders = S.metaFolders.filter(function (x) { return x !== f; }); if (S.metaFolders.indexOf(v) < 0) S.metaFolders.push(v); saveMeta();
        S.notes.forEach(function (n) { if (n.folder === f) { n.folder = v; persist(n); } }); render();
      });
    },
    deleteFolderAsk: function (el) {
      var f = el.dataset.v;
      confirmSheet('Delete the folder "' + f + '"? Its notes stay, with no folder.', 'Delete folder', function () {
        S.metaFolders = S.metaFolders.filter(function (x) { return x !== f; }); saveMeta();
        S.notes.forEach(function (n) { if (n.folder === f) { n.folder = ''; persist(n); } }); render();
      }, true);
    },
    toggle: function (el) { var k = el.dataset.v; S.settings[k] = !S.settings[k]; A.setSetting(k, String(S.settings[k])); render(); },
    trashDays: function () {
      openSheet('<h3>Keep deleted notes</h3>' + [7, 14, 30, 60, 90].map(function (d) {
        return '<button class="row" data-act="setDays" data-v="' + d + '"><span class="a"><b>' + d + ' days</b></span>' + (S.settings.trashDays === d ? '<span class="radio"></span>' : '') + '</button>';
      }).join(''));
    },
    setDays: function (el) { S.settings.trashDays = parseInt(el.dataset.v, 10); A.setSetting('trashDays', el.dataset.v); closeSheet(); render(); },
    export: function () { A.exportBackup(); },
    importAsk: function () { confirmSheet('Import adds the notes from a backup file. A note with the same ID is replaced.', 'Choose file', function () { A.importBackup(); }); },
    releases: function () { A.openReleases(); },
    restore: function (el) { var n = S.notes.filter(function (x) { return x.id === el.dataset.id; })[0]; if (n) { n.deletedAt = 0; persist(n); render(); toast('Restored.'); } },
    purgeAsk: function (el) {
      var id = el.dataset.id;
      confirmSheet('Delete this note forever? This cannot be undone.', 'Delete forever', function () { S.notes = S.notes.filter(function (x) { return x.id !== id; }); A.deleteNoteForever(id); render(); }, true);
    },
    emptyAsk: function () {
      confirmSheet('Empty the trash? All deleted notes are removed forever.', 'Empty trash', function () {
        trashed().forEach(function (n) { A.deleteNoteForever(n.id); }); S.notes = live(); render();
      }, true);
    },
    closeSheet: closeSheet,
    promptOk: function () { var v = ($('#pin') || {}).value || '', cb = S.promptCb; closeSheet(); if (cb) cb(v); },
    confirmOk: function () { var cb = S.promptCb; closeSheet(); if (cb) cb(); },
    /* editor */
    back: closeEditor,
    undo: function () { withSel(function () { exec('undo'); }); },
    more: function () {
      var n = S.cur;
      openSheet('<button class="row" data-act="togglePin"><span class="a"><b>' + (n.pinned ? 'Unpin note' : 'Pin note to top') + '</b></span></button>' +
        '<button class="row" data-act="pickFolder"><span class="a"><b>Move to folder</b></span></button>' +
        '<button class="row" data-act="editTags"><span class="a"><b>Edit tags</b></span></button>' +
        '<button class="row" data-act="deleteNote"><span class="a"><b>Delete note</b><span>Goes to trash for ' + S.settings.trashDays + ' days</span></span></button>');
    },
    togglePin: function () { S.cur.pinned = !S.cur.pinned; closeSheet(); flushForce(); },
    deleteNote: function () {
      var n = S.cur; closeSheet(); collect();
      if (S.curNew && isEmptyNote(n)) { closeEditor(); return; }
      n.deletedAt = Date.now(); if (S.notes.indexOf(n) < 0) S.notes.push(n); persist(n); S.dirty = false; S.view = 'home'; S.cur = null; render(); toast('Moved to trash.');
    },
    pickFolder: folderSheet,
    setFolder: function (el) { S.cur.folder = el.dataset.v; closeSheet(); drawMeta(); flushForce(); },
    newFolderFor: function () { promptSheet('New folder', 'Folder name', '', function (v) { var f = addFolder(v); if (f) { S.cur.folder = f; drawMeta(); flushForce(); } }); },
    editTags: tagsSheet,
    cmd: function (el) { withSel(function () { exec(el.dataset.c); }); },
    list: function (el) { var k = el.dataset.k, close = el.dataset.close; withSel(function () { setList(k); }); if (close) closeSheet(); },
    styles: function () { saveRange(); S.colorOpen = false; stylesSheet(); },
    indent: function () { withSel(indentMore); },
    outdent: function () { withSel(function () { exec('outdent'); }); },
    align: function (el) { withSel(function () { exec('justify' + el.dataset.v); }); stylesRefresh(); },
    block: function (el) {
      var v = el.dataset.v;
      withSel(function () { if (v === 'HR') exec('insertHorizontalRule'); else exec('formatBlock', v === 'P' ? 'p' : v.toLowerCase()); });
      closeSheet();
    },
    spacing: function () { var v; withSel(function () { v = cycleSpacing(); }); var e = $('#spv'); if (e && v) e.textContent = v; },
    colorToggle: function () { S.colorOpen = !S.colorOpen; stylesSheet(); },
    color: function (el) { withSel(function () { applyColor(el.dataset.v); }); closeSheet(); },
    hl: function (el) { withSel(function () { applyHl(el.dataset.v); }); closeSheet(); },
    hlQuick: function () { withSel(function () { applyHl(hlState() ? 'none' : S.lastHl); }); },
    linkSheet: linkSheet,
    applyLink: function () {
      var raw = ($('#lurl') || {}).value || '', href = normalizeLink(raw);
      if (!href) { var e = $('#lerr'); if (e) e.textContent = 'Enter a web address, phone number or email.'; return; }
      closeSheet(); withSel(function () { makeLink(href); });
    },
    unlink: function () { closeSheet(); withSel(function () { var a = curClosest('a'); if (a) a.replaceWith.apply(a, Array.prototype.slice.call(a.childNodes)); }); },
    linkNote: function (el) {
      var n = S.notes.filter(function (x) { return x.id === el.dataset.id; })[0]; closeSheet();
      if (n) withSel(function () { makeLink('note:' + n.id, n.title || 'Untitled'); });
    },
    pic: function () { saveRange(); A.pickImage(); },
    table: function () {
      var cell = '<td><br></td>', row = '<tr>' + cell + cell + cell + '</tr>';
      withSel(function () { exec('insertHTML', '<table><tbody>' + row + row + row + '</tbody></table><p><br></p>'); });
    },
    imgSize: function (el) { if (S.img) { S.img.style.width = el.dataset.v + '%'; markDirty(); } },
    imgMove: function (el) {
      if (!S.img) return; var b = blockOf(S.img), d = $('#doc');
      if (el.dataset.v === 'up') { var p = b.previousElementSibling; if (p) d.insertBefore(b, p); }
      else { var nx = b.nextElementSibling; if (nx) d.insertBefore(nx, b); }
      ensureTail(); markDirty();
    },
    imgDel: function () { if (S.img) { var b = blockOf(S.img); S.img.remove(); if (b && b.parentElement && !b.textContent.trim() && !b.querySelector('img,table')) b.remove(); S.img = null; ensureTail(); markDirty(); updateCtx(); } },
    tbl: function (el) { withSel(function () { tableOp(el.dataset.v); }); }
  };
  function stylesRefresh() { /* keep the sheet open, no redraw needed */ }

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var fn = ACT[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el); }
  });
  function keepFocus(e) { if (e.target.closest && e.target.closest('.nofocus')) e.preventDefault(); }
  document.addEventListener('pointerdown', keepFocus);
  document.addEventListener('mousedown', keepFocus);
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'q') { S.q = e.target.value; drawGrid(); }
  });
  document.addEventListener('selectionchange', function () {
    if (S.view !== 'editor') return;
    var s = getSelection();
    if (s.rangeCount && inDoc(s.anchorNode)) { saveRange(); if (S.img && !s.isCollapsed === false) { } updateCtx(); updateToolbar(); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });

  window.onImagePicked = function (name) {
    if (!/^[a-z0-9]{4,40}\.(jpg|png|gif|webp)$/.test(name || '')) { if (name === '') return; toast('Could not add that picture.'); return; }
    withSel(function () { exec('insertHTML', '<p><img src="' + (PIC_LOCAL || PIC_CANON) + name + '" style="width:100%"></p><p><br></p>'); });
  };
  window.onBackupDone = function (kind, ok) {
    if (kind === 'import' && ok) { load(); render(); toast('Backup imported.'); }
    else if (kind === 'export') toast(ok ? 'Backup saved.' : 'Backup was not saved.');
    else toast('Import did not finish.');
  };
  window.onBack = function () {
    if (sheetOpen()) { closeSheet(); return true; }
    if (S.view === 'editor') { closeEditor(); return true; }
    if (S.view === 'trash') { go('settings'); return true; }
    if (S.view !== 'home') { go('home'); return true; }
    if (S.filter.k !== 'all' || S.q || S.chip !== 'all') { S.filter = { k: 'all', v: '' }; S.q = ''; S.chip = 'all'; render(); return true; }
    return false;
  };

  window.__flush = function () { flush(); return true; };

  /* desktop keyboard shortcuts */
  document.addEventListener('keydown', function (e) {
    if (S.platform === 'android') return;
    var ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'n') { e.preventDefault(); if (S.view !== 'editor') newNote(); else { flush(); newNote(); } }
    else if (ctrl && e.key.toLowerCase() === 'f') { e.preventDefault(); if (S.view !== 'home') { S.view = 'home'; render(); } var q = $('#q'); if (q) q.focus(); }
    else if (e.key === 'Escape' && !(document.activeElement && document.activeElement.id === 'q' && S.q)) { if (window.onBack()) e.preventDefault(); }
  });

  var ready = (A && A.__ready) ? A.__ready() : Promise.resolve();
  ready.then(function () { load(); render(); });
})();
