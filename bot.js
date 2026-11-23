// بوت متجر خدمات الملكي للرشق 👑 — بدون مكتبات خارجية (Node 18+)
const http = require('http');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.BOT_TOKEN;
const SITE = (process.env.SITE_URL || 'https://app1-fmzc.onrender.com').replace(/\/$/, '');
const SUPPORT_WA = process.env.SUPPORT_WHATSAPP || '967734591441';
const PUBLIC_URL = process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL || '';
const PORT = process.env.PORT || 3000;
if (!TOKEN) { console.error('❌ ضع BOT_TOKEN في متغيرات البيئة'); process.exit(1); }

const TG = `https://api.telegram.org/bot${TOKEN}`;
const DB_FILE = path.join(__dirname, 'sessions.json');
let db = {};
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch {}
const save = () => { try { fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch {} };
const S = (id) => (db[id] ||= {});

// ---------- أدوات ----------
async function tg(method, body) {
  const r = await fetch(`${TG}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) console.error(method, d.description);
  return d.result;
}
async function api(p, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(SITE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data; try { data = await r.json(); } catch { data = {}; }
  return { ok: r.ok, status: r.status, data };
}
const send = (chat_id, text, extra = {}) => tg('sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
const edit = (chat_id, message_id, text, extra = {}) => tg('editMessageText', { chat_id, message_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
const esc = (s) => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const kb = (rows) => ({ reply_markup: { inline_keyboard: rows } });

let servicesCache = { at: 0, list: [] };
async function getServices() {
  if (Date.now() - servicesCache.at < 60000 && servicesCache.list.length) return servicesCache.list;
  const r = await api('/api/services');
  if (r.ok && Array.isArray(r.data)) servicesCache = { at: Date.now(), list: r.data };
  return servicesCache.list;
}
async function me(chatId) {
  const s = S(chatId);
  if (!s.token) return null;
  const r = await api('/api/me', { token: s.token });
  if (!r.ok) { delete s.token; save(); return null; }
  return r.data;
}

// ---------- القوائم ----------
const mainMenu = (logged, admin) => kb([
  ...(admin ? [[{ text: '👑 لوحة الأدمن', callback_data: 'adm' }]] : []),
  [{ text: '🛒 المتجر / الخدمات', callback_data: 'shop' }],
  [{ text: '💰 رصيدي', callback_data: 'balance' }, { text: '📋 طلباتي', callback_data: 'orders' }],
  [{ text: '💳 شحن الرصيد', callback_data: 'topup' }, { text: '🎧 الدعم', callback_data: 'support' }],
  [{ text: '🌐 فتح الموقع داخل تليجرام', web_app: { url: SITE } }],
  logged ? [{ text: '🚪 تسجيل الخروج', callback_data: 'logout' }]
         : [{ text: '🔑 تسجيل الدخول', callback_data: 'login' }, { text: '➕ حساب جديد', callback_data: 'register' }],
]);

async function showHome(chatId, msgId) {
  const u = await me(chatId);
  const text = `👑 <b>أهلاً بك في خدمات الملكي للرشق</b>\n\n` +
    (u ? `👤 ${esc(u.name || u.email)}\n🆔 ${esc(u.memberId || '')}\n💰 الرصيد: <b>${(u.balance || 0).toFixed(2)} $</b>`
       : `سجّل دخولك بحسابك في الموقع أو أنشئ حساباً جديداً للبدء.`);
  if (u) { const s = S(chatId); s.admin = !!u.isAdmin; save(); }
  const menu = mainMenu(!!u, !!u?.isAdmin);
  return msgId ? edit(chatId, msgId, text, menu) : send(chatId, text, menu);
}

async function showCategories(chatId, msgId) {
  const list = await getServices();
  const cats = [...new Set(list.map(s => s.category))];
  const rows = [];
  for (let i = 0; i < cats.length; i += 2) rows.push(cats.slice(i, i + 2).map(c => ({ text: c, callback_data: 'cat:' + c })));
  rows.push([{ text: '⬅️ رجوع', callback_data: 'home' }]);
  return edit(chatId, msgId, '🛒 <b>اختر القسم:</b>', kb(rows));
}
async function showCategory(chatId, msgId, cat) {
  const list = (await getServices()).filter(s => s.category === cat);
  const rows = list.map(s => [{ text: `${s.name} — ${s.price}$/1000`, callback_data: 'svc:' + s.id }]);
  rows.push([{ text: '⬅️ الأقسام', callback_data: 'shop' }]);
  return edit(chatId, msgId, `📂 <b>${esc(cat)}</b>`, kb(rows));
}
async function showService(chatId, msgId, id) {
  const s = (await getServices()).find(x => x.id === id);
  if (!s) return edit(chatId, msgId, 'الخدمة غير موجودة', kb([[{ text: '⬅️ رجوع', callback_data: 'shop' }]]));
  return edit(chatId, msgId,
    `<b>${esc(s.name)}</b>\n${esc(s.desc)}\n\n💵 السعر: <b>${s.price}$</b> لكل 1000\n🔽 أقل كمية: ${s.min}\n🔼 أعلى كمية: ${s.max}`,
    kb([[{ text: '🛍️ اطلب الآن', callback_data: 'buy:' + s.id }], [{ text: '⬅️ رجوع', callback_data: 'cat:' + s.category }]]));
}

async function requireLogin(chatId) {
  const u = await me(chatId);
  if (!u) await send(chatId, '🔒 يجب تسجيل الدخول أولاً.', kb([[{ text: '🔑 تسجيل الدخول', callback_data: 'login' }, { text: '➕ حساب جديد', callback_data: 'register' }]]));
  return u;
}

// ---------- الأزرار ----------
async function onCallback(q) {
  const chatId = q.message.chat.id, msgId = q.message.message_id, d = q.data, s = S(chatId);
  tg('answerCallbackQuery', { callback_query_id: q.id });
  if (d.startsWith('adm')) return onAdmin(chatId, msgId, d, s);
  if (d === 'home') { s.step = null; save(); return showHome(chatId, msgId); }
  if (d === 'shop') return showCategories(chatId, msgId);
  if (d.startsWith('cat:')) return showCategory(chatId, msgId, d.slice(4));
  if (d.startsWith('svc:')) return showService(chatId, msgId, d.slice(4));
  if (d === 'login' || d === 'register') {
    s.step = d + ':email'; s.tmp = {}; save();
    return send(chatId, d === 'login' ? '📧 أرسل بريدك الإلكتروني المسجّل في الموقع:' : '📧 أرسل البريد الإلكتروني للحساب الجديد:');
  }
  if (d === 'logout') { delete s.token; s.step = null; save(); return showHome(chatId, msgId); }
  if (d === 'balance') {
    const u = await requireLogin(chatId); if (!u) return;
    return send(chatId, `💰 رصيدك الحالي: <b>${(u.balance || 0).toFixed(2)} $</b>\n🆔 رقم العضوية: ${esc(u.memberId || '')}`, kb([[{ text: '💳 شحن الرصيد', callback_data: 'topup' }], [{ text: '🏠 الرئيسية', callback_data: 'home' }]]));
  }
  if (d === 'orders') {
    const u = await requireLogin(chatId); if (!u) return;
    const r = await api('/api/orders', { token: s.token });
    const orders = Array.isArray(r.data) ? r.data : [];
    const st = { pending: '🟡 قيد الانتظار', running: '🔵 جاري التنفيذ', completed: '🟢 مكتمل', cancelled: '🔴 ملغي' };
    const text = orders.length ? '📋 <b>آخر طلباتك:</b>\n\n' + orders.slice(0, 10).map(o =>
      `• <b>${esc(o.service)}</b>\n   الكمية: ${o.quantity} | ${Number(o.price || 0).toFixed(2)}$ | ${st[o.status] || esc(o.status)}`).join('\n\n')
      : 'لا توجد طلبات بعد.';
    return send(chatId, text, kb([[{ text: '🏠 الرئيسية', callback_data: 'home' }]]));
  }
  if (d === 'topup' || d === 'support') {
    const u = await me(chatId);
    const msg = encodeURIComponent(`السلام عليكم، أريد ${d === 'topup' ? 'شحن رصيدي' : 'التواصل مع الدعم'} في خدمات الملكي للرشق 👑. رقم عضويتي: ${u?.memberId || '-'}`);
    return send(chatId, d === 'topup' ? '💳 لشحن الرصيد تواصل مع الأدمن عبر واتساب وأرسل رقم عضويتك:' : '🎧 فريق الدعم جاهز لمساعدتك:',
      kb([[{ text: '💬 واتساب', url: `https://wa.me/${SUPPORT_WA}?text=${msg}` }], [{ text: '🏠 الرئيسية', callback_data: 'home' }]]));
  }
  if (d.startsWith('buy:')) {
    const u = await requireLogin(chatId); if (!u) return;
    s.step = 'order:link'; s.tmp = { serviceId: d.slice(4) }; save();
    return send(chatId, '🔗 أرسل رابط الحساب أو المنشور/الفيديو:');
  }
  if (d === 'confirm' && s.step === 'order:confirm') {
    const { serviceId, link, quantity } = s.tmp; s.step = null; save();
    const r = await api('/api/order', { method: 'POST', token: s.token, body: { serviceId, link, quantity } });
    const extra = r.ok && r.data.waLink ? kb([[{ text: '📤 إرسال الطلب للأدمن (واتساب)', url: r.data.waLink }], [{ text: '🏠 الرئيسية', callback_data: 'home' }]])
                                         : kb([[{ text: '🏠 الرئيسية', callback_data: 'home' }]]);
    return send(chatId, (r.ok ? '✅ ' : '❌ ') + esc(r.data.message || (r.ok ? 'تم الطلب' : 'حدث خطأ')), extra);
  }
  if (d === 'cancel') { s.step = null; save(); return send(chatId, 'تم الإلغاء.', kb([[{ text: '🏠 الرئيسية', callback_data: 'home' }]])); }
}

// ---------- الرسائل النصية ----------
async function onMessage(m) {
  const chatId = m.chat.id, text = (m.text || '').trim(), s = S(chatId);
  if (text === '/start' || text === '/menu') { s.step = null; save(); return showHome(chatId); }
  if (text === '/shop') return send(chatId, '🛒', kb([[{ text: 'افتح المتجر', callback_data: 'shop' }]]));
  const step = s.step || '';
  if (step.startsWith('adm:')) return onAdminText(chatId, text, s);

  if (step.endsWith(':email')) {
    if (!/^\S+@\S+\.\S+$/.test(text)) return send(chatId, '⚠️ بريد غير صحيح، أعد الإرسال:');
    s.tmp.email = text; s.step = step.replace('email', 'password'); save();
    return send(chatId, '🔑 أرسل كلمة المرور (6 أحرف على الأقل):\n<i>سيتم حذف رسالتك تلقائياً للأمان.</i>');
  }
  if (step.endsWith(':password')) {
    tg('deleteMessage', { chat_id: chatId, message_id: m.message_id });
    const isReg = step.startsWith('register'); const { email } = s.tmp; const password = text;
    if (password.length < 6) return send(chatId, '⚠️ كلمة المرور قصيرة، أعد الإرسال:');
    if (isReg) {
      const r = await api('/api/register', { method: 'POST', body: { email, password, name: m.from.first_name || email.split('@')[0] } });
      if (!r.ok) { s.step = null; save(); return send(chatId, '❌ ' + esc(r.data.message || 'تعذّر إنشاء الحساب'), mainMenu(false)); }
    }
    const r = await api('/api/login', { method: 'POST', body: { email, password } });
    s.step = null; s.tmp = {};
    if (!r.ok || !r.data.token) { save(); return send(chatId, '❌ ' + esc(r.data.message || 'بيانات الدخول غير صحيحة'), mainMenu(false)); }
    s.token = r.data.token; save();
    await send(chatId, isReg ? '✅ تم إنشاء حسابك وتسجيل دخولك.' : '✅ تم تسجيل الدخول بنجاح.');
    return showHome(chatId);
  }
  if (step === 'order:link') {
    s.tmp.link = text; s.step = 'order:qty'; save();
    const sv = (await getServices()).find(x => x.id === s.tmp.serviceId);
    return send(chatId, `🔢 أرسل الكمية (من ${sv?.min} إلى ${sv?.max}):`);
  }
  if (step === 'order:qty') {
    const sv = (await getServices()).find(x => x.id === s.tmp.serviceId);
    const q = parseInt(text.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10);
    if (!sv || isNaN(q) || q < sv.min || q > sv.max) return send(chatId, `⚠️ الكمية يجب أن تكون بين ${sv?.min} و ${sv?.max}`);
    s.tmp.quantity = q; s.step = 'order:confirm'; save();
    const u = await me(chatId);
    return send(chatId,
      `🧾 <b>تأكيد الطلب</b>\n\nالخدمة: ${esc(sv.name)}\nالرابط: ${esc(s.tmp.link)}\nالكمية: ${q}\nالسعر: <b>${(sv.price * q / 1000).toFixed(2)} $</b>\nرصيدك: ${(u?.balance || 0).toFixed(2)} $`,
      kb([[{ text: '✅ تأكيد وخصم الرصيد', callback_data: 'confirm' }, { text: '❌ إلغاء', callback_data: 'cancel' }]]));
  }
  return showHome(chatId);
}

async function handle(update) {
  try {
    if (update.callback_query) await onCallback(update.callback_query);
    else if (update.message) await onMessage(update.message);
  } catch (e) { console.error('خطأ:', e); }
}


// ================= لوحة الأدمن =================
const ST = { pending: '🟡 قيد الانتظار', running: '🔵 جاري التنفيذ', completed: '🟢 مكتمل', cancelled: '🔴 ملغي' };
const admMenu = kb([
  [{ text: '📥 الطلبات النشطة', callback_data: 'adm:orders' }],
  [{ text: '➕ إضافة منتج', callback_data: 'adm:addp' }, { text: '🗑️ حذف منتج', callback_data: 'adm:delp' }],
  [{ text: '💵 شحن رصيد مستخدم', callback_data: 'adm:bal' }, { text: '👥 المستخدمين', callback_data: 'adm:users' }],
  [{ text: '🌐 لوحة الأدمن في الموقع', web_app: { url: SITE + '/admin.html' } }],
  [{ text: '🏠 الرئيسية', callback_data: 'home' }],
]);
const NEED_SERVER = '⚠️ موقعك الحالي لا يحتوي على خاصية إدارة المنتجات من الخارج.\nيجب إضافة تحديث بسيط لكود السيرفر (ملف ADD_TO_SERVER.md) ثم ستعمل هذه الميزة فوراً، وأي منتج تضيفه سيظهر في الموقع والبوت معاً.';

async function onAdmin(chatId, msgId, d, s) {
  const u = await me(chatId);
  if (!u?.isAdmin) return send(chatId, '⛔ هذه اللوحة للأدمن فقط. سجّل الدخول بحساب الأدمن.');
  const tok = s.token;
  if (d === 'adm') { s.step = null; save(); return send(chatId, '👑 <b>لوحة تحكم الأدمن</b>\nستصلك إشعارات الطلبات الجديدة هنا تلقائياً.', admMenu); }
  if (d === 'adm:orders') {
    const r = await api('/api/admin/orders', { token: tok });
    const list = (Array.isArray(r.data) ? r.data : []).filter(o => o.status === 'pending' || o.status === 'running').slice(0, 15);
    if (!list.length) return send(chatId, '✅ لا توجد طلبات نشطة.', admMenu);
    for (const o of list) await sendOrderCard(chatId, o);
    return;
  }
  if (d.startsWith('adm:st:')) {
    const [, , status, orderId] = d.split(':');
    const r = await api('/api/admin/order-status', { method: 'POST', token: tok, body: { orderId, status } });
    return edit(chatId, msgId, (r.ok ? '✅ ' : '❌ ') + esc(r.data.message || '') + `\nالحالة الجديدة: ${ST[status] || status}`);
  }
  if (d === 'adm:users') {
    const r = await api('/api/admin/users', { token: tok });
    const list = Array.isArray(r.data) ? r.data : [];
    const text = `👥 <b>المستخدمون (${list.length})</b>\n\n` + list.slice(0, 40).map(x =>
      `• ${esc(x.name || 'عضو')} — <code>${esc(x.email || x.username)}</code> — ${esc(x.memberId || '')} — 💰 ${x.balance || 0}$`).join('\n');
    return send(chatId, text.slice(0, 4000), admMenu);
  }
  if (d === 'adm:bal') { s.step = 'adm:bal:email'; s.tmp = {}; save(); return send(chatId, '📧 أرسل بريد المستخدم الذي تريد شحن رصيده:'); }
  if (d === 'adm:addp') { s.step = 'adm:p:name'; s.tmp = {}; save(); return send(chatId, '🆕 <b>إضافة منتج جديد</b>\n\n1/6 — أرسل اسم المنتج (مثال: متابعين تويتر 🐦):'); }
  if (d === 'adm:pok') {
    const p = s.tmp; s.step = null; save();
    const r = await api('/api/admin/services', { method: 'POST', token: tok, body: p });
    if (r.status === 404) return send(chatId, NEED_SERVER, admMenu);
    servicesCache.at = 0;
    return send(chatId, (r.ok ? '✅ تمت إضافة المنتج وأصبح ظاهراً في الموقع والبوت.' : '❌ ' + esc(r.data.message || 'خطأ')), admMenu);
  }
  if (d === 'adm:delp') {
    const list = await getServices();
    return send(chatId, '🗑️ اختر المنتج الذي تريد حذفه:', kb([...list.map(x => [{ text: '❌ ' + x.name, callback_data: 'adm:del:' + x.id }]), [{ text: '⬅️ رجوع', callback_data: 'adm' }]]));
  }
  if (d.startsWith('adm:del:')) {
    const id = d.slice(8);
    const r = await api('/api/admin/services/' + encodeURIComponent(id), { method: 'DELETE', token: tok });
    if (r.status === 404 && !r.data.message) return send(chatId, NEED_SERVER, admMenu);
    servicesCache.at = 0;
    return edit(chatId, msgId, (r.ok ? '✅ تم حذف المنتج.' : '❌ ' + esc(r.data.message || 'خطأ')));
  }
}

async function onAdminText(chatId, text, s) {
  const step = s.step, t = s.tmp ||= {};
  const num = (v) => Number(String(v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(',', '.'));
  if (step === 'adm:bal:email') { t.email = text; s.step = 'adm:bal:amount'; save(); return send(chatId, '💵 أرسل المبلغ بالدولار (مثال: 10):'); }
  if (step === 'adm:bal:amount') {
    const amount = num(text); if (!(amount > 0)) return send(chatId, '⚠️ أرسل رقماً صحيحاً:');
    s.step = null; save();
    const r = await api('/api/admin/add-balance', { method: 'POST', token: s.token, body: { email: t.email, amount } });
    return send(chatId, (r.ok ? '✅ ' : '❌ ') + esc(r.data.message || 'تم'), admMenu);
  }
  const flow = [
    ['name', '2/6 — أرسل القسم (مثال: TikTok أو Instagram أو قسم جديد):'],
    ['category', '3/6 — أرسل السعر لكل 1000 بالدولار (مثال: 1.5):'],
    ['price', '4/6 — أرسل أقل كمية (مثال: 100):'],
    ['min', '5/6 — أرسل أعلى كمية (مثال: 50000):'],
    ['max', '6/6 — أرسل وصفاً قصيراً للمنتج:'],
    ['desc', null],
  ];
  const key = step.split(':')[2], i = flow.findIndex(f => f[0] === key);
  if (i < 0) { s.step = null; save(); return; }
  let v = text;
  if (['price', 'min', 'max'].includes(key)) { v = num(text); if (!(v > 0)) return send(chatId, '⚠️ أرسل رقماً صحيحاً:'); }
  t[key] = v;
  if (flow[i][1]) { s.step = 'adm:p:' + flow[i + 1][0]; save(); return send(chatId, flow[i][1]); }
  t.id = (t.category + '_' + Date.now().toString(36)).toLowerCase().replace(/[^a-z0-9_]/g, '');
  s.step = 'adm:p:confirm'; save();
  return send(chatId, `🧾 <b>مراجعة المنتج</b>\n\nالاسم: ${esc(t.name)}\nالقسم: ${esc(t.category)}\nالسعر: ${t.price}$ / 1000\nالكمية: ${t.min} - ${t.max}\nالوصف: ${esc(t.desc)}`,
    kb([[{ text: '✅ نشر المنتج', callback_data: 'adm:pok' }, { text: '❌ إلغاء', callback_data: 'cancel' }]]));
}

function sendOrderCard(chatId, o, isNew) {
  return send(chatId,
    `${isNew ? '🔔 <b>طلب جديد!</b>\n\n' : ''}📦 <b>${esc(o.service)}</b> — ${ST[o.status] || esc(o.status)}\n👤 ${esc(o.email)}\n🔗 ${esc(o.link)}\n🔢 الكمية: ${o.quantity} | 💰 ${o.price}$\n🕒 ${new Date(o.createdAt).toLocaleString('ar')}`,
    kb([[{ text: '▶️ بدء التنفيذ', callback_data: `adm:st:running:${o._id}` }, { text: '✅ مكتمل', callback_data: `adm:st:completed:${o._id}` }],
        [{ text: '❌ إلغاء + إرجاع الرصيد', callback_data: `adm:st:cancelled:${o._id}` }]]));
}

// إشعار الأدمن بالطلبات الجديدة كل دقيقة
setInterval(async () => {
  for (const [chatId, s] of Object.entries(db)) {
    if (!s.admin || !s.token) continue;
    try {
      const r = await api('/api/admin/orders', { token: s.token });
      if (!Array.isArray(r.data)) continue;
      const seen = new Set(s.seen || []);
      const first = !s.seen;
      for (const o of r.data) if (!seen.has(o._id)) { seen.add(o._id); if (!first && o.status === 'pending') await sendOrderCard(chatId, o, true); }
      s.seen = [...seen].slice(-500); save();
    } catch {}
  }
}, 60000);

// ---------- التشغيل ----------
const HOOK_PATH = '/tg/' + TOKEN.split(':')[0];
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === HOOK_PATH) {
    let b = ''; req.on('data', c => b += c);
    req.on('end', () => { res.end('ok'); try { handle(JSON.parse(b)); } catch {} });
  } else res.end('Malaki bot is running 👑');
}).listen(PORT, async () => {
  await tg('setMyCommands', { commands: [{ command: 'start', description: 'القائمة الرئيسية' }, { command: 'shop', description: 'المتجر' }] });
  await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'المتجر 👑', web_app: { url: SITE } } });
  if (PUBLIC_URL) {
    await tg('setWebhook', { url: PUBLIC_URL.replace(/\/$/, '') + HOOK_PATH, drop_pending_updates: true });
    console.log('✅ البوت يعمل (Webhook) على', PUBLIC_URL);
  } else {
    await tg('deleteWebhook', {});
    console.log('✅ البوت يعمل (Polling)');
    let offset = 0;
    for (;;) {
      try {
        const r = await fetch(`${TG}/getUpdates?timeout=50&offset=${offset}`).then(r => r.json());
        for (const u of r.result || []) { offset = u.update_id + 1; handle(u); }
      } catch { await new Promise(r => setTimeout(r, 3000)); }
    }
  }
});
