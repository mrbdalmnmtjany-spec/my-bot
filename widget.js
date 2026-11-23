/* نافذة دعم الملكي 👑 — تُضاف للموقع بسطر واحد */
(function () {
  if (window.__malakiChat) return; window.__malakiChat = 1;
  var BASE = (document.currentScript && new URL(document.currentScript.src).origin) || '';
  var cid = localStorage.getItem('mk_cid');
  if (!cid) { cid = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem('mk_cid', cid); }
  var since = 0, open = false, timer = null, user = null;

  var css = '#mkB{position:fixed;left:16px;bottom:90px;z-index:99999;width:58px;height:58px;border-radius:50%;border:none;background:linear-gradient(135deg,#d4af37,#a8841f);color:#000;font-size:26px;box-shadow:0 6px 18px rgba(0,0,0,.4);cursor:pointer}' +
    '#mkBadge{position:absolute;top:-2px;right:-2px;background:#ff3b30;color:#fff;font-size:11px;border-radius:10px;padding:2px 6px;display:none}' +
    '#mkP{position:fixed;left:12px;right:12px;bottom:160px;max-width:380px;height:65vh;max-height:520px;z-index:99999;background:#111117;border:1px solid #2a2a2a;border-radius:18px;display:none;flex-direction:column;overflow:hidden;font-family:inherit;direction:rtl;box-shadow:0 10px 30px rgba(0,0,0,.5)}' +
    '#mkH{background:#0B0B0F;color:#d4af37;padding:14px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2a2a2a}' +
    '#mkH small{display:block;color:#8a8a8a;font-weight:normal;font-size:11px}#mkX{background:none;border:none;color:#aaa;font-size:20px;cursor:pointer}' +
    '#mkM{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}' +
    '.mkm{max-width:82%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;color:#fff}' +
    '.mku{align-self:flex-start;background:#2b2b35}.mka{align-self:flex-end;background:#16845d}.mkb{align-self:flex-end;background:#3a3220;border:1px solid #d4af37}' +
    '.mkm small{display:block;font-size:10px;opacity:.6;margin-top:3px}' +
    '#mkQ{display:flex;gap:6px;flex-wrap:wrap;padding:0 12px 8px}#mkQ button{background:#222;color:#d4af37;border:1px solid #3a3a3a;border-radius:14px;padding:6px 10px;font-size:12px;cursor:pointer}' +
    '#mkF{display:flex;gap:6px;padding:10px;border-top:1px solid #2a2a2a}#mkI{flex:1;background:#222;color:#fff;border:none;border-radius:12px;padding:11px;font-size:14px;font-family:inherit}' +
    '#mkS{background:#d4af37;color:#000;border:none;border-radius:12px;padding:0 16px;font-weight:bold;cursor:pointer}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var wrap = document.createElement('div');
  wrap.innerHTML = '<button id="mkB" aria-label="الدعم">💬<span id="mkBadge">1</span></button>' +
    '<div id="mkP"><div id="mkH"><div>👑 دعم الملكي<small>نرد عليك هنا مباشرة</small></div><button id="mkX">✕</button></div>' +
    '<div id="mkM"></div><div id="mkQ"><button>💵 الأسعار</button><button>💳 شحن الرصيد</button><button>📋 حالة طلبي</button><button>🎧 أريد التحدث مع الدعم</button></div>' +
    '<form id="mkF"><input id="mkI" placeholder="اكتب سؤالك..." maxlength="1000" autocomplete="off"><button id="mkS">إرسال</button></form></div>';
  document.body.appendChild(wrap);
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) { return String(s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); }
  function add(m) {
    var d = document.createElement('div');
    d.className = 'mkm ' + (m.from === 'user' ? 'mku' : m.from === 'admin' ? 'mka' : 'mkb');
    d.innerHTML = esc(m.text) + '<small>' + (m.from === 'admin' ? '👑 الدعم الفني' : m.from === 'bot' ? '🤖 مساعد آلي' : 'أنت') + ' · ' + new Date(m.t).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }) + '</small>';
    $('mkM').appendChild(d); $('mkM').scrollTop = 1e9;
  }
  async function who() {
    var tk = localStorage.getItem('token'); if (!tk) return null;
    try { var r = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + tk } }); if (r.ok) return await r.json(); } catch (e) {}
    return null;
  }
  async function poll() {
    try {
      var r = await fetch(BASE + '/chat/poll?cid=' + cid + '&since=' + since); var d = await r.json();
      (d.msgs || []).forEach(function (m) { if (m.t > since) since = m.t; add(m); if (!open && m.from !== 'user') $('mkBadge').style.display = 'block'; });
    } catch (e) {}
  }
  async function sendText(text) {
    text = (text || '').trim(); if (!text) return;
    $('mkI').value = '';
    if (!user) user = await who();
    try {
      await fetch(BASE + '/chat/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid: cid, text: text, name: user ? (user.name || user.email) : 'زائر', email: user && user.email, memberId: user && user.memberId, page: location.href }) });
    } catch (e) { add({ from: 'bot', text: 'تعذّر الإرسال، حاول مرة أخرى.', t: Date.now() }); }
    poll();
  }
  $('mkB').onclick = function () {
    open = !open; $('mkP').style.display = open ? 'flex' : 'none'; $('mkBadge').style.display = 'none';
    if (open && !$('mkM').children.length && !since) add({ from: 'bot', text: 'أهلاً بك في خدمات الملكي للرشق 👑\nكيف نقدر نساعدك؟ اختر من الأزرار أو اكتب سؤالك.', t: Date.now() });
    if (open) { poll(); $('mkI').focus(); }
  };
  $('mkX').onclick = function () { $('mkB').click(); };
  $('mkF').onsubmit = function (e) { e.preventDefault(); sendText($('mkI').value); };
  Array.prototype.forEach.call($('mkQ').children, function (b) { b.onclick = function () { sendText(b.textContent.replace(/^\S+\s/, '')); }; });
  poll(); setInterval(poll, 5000);
})();
