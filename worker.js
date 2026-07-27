/**
 * Cloudflare Worker — приём заявок с сайта и отправка в Telegram.
 *
 * Зачем: токен бота хранится СЕКРЕТОМ на стороне Cloudflare и НЕ попадает
 * в код сайта. Сайт шлёт заявку сюда, Worker сам пересылает её в Telegram.
 *
 * Переменные окружения (задаются в панели Cloudflare, НЕ в коде):
 *   TG_TOKEN  — секрет, токен бота от @BotFather (Settings → Variables → Encrypt)
 *   TG_CHAT   — обычная переменная, ваш chat_id (например 924658134)
 *   ALLOW_ORIGIN — (необязательно) адрес сайта, напр. https://vershina.ru
 *                  Если не задан — разрешены все источники ('*').
 */

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Префлайт CORS
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST')   return json({ ok: false, error: 'method' }, 405, cors);

    // Разбор тела
    let data;
    try { data = await request.json(); }
    catch { return json({ ok: false, error: 'bad_json' }, 400, cors); }

    // Анти-спам «honeypot»: если бот заполнил скрытое поле company — молча игнорируем
    if (data.company) return json({ ok: true }, 200, cors);

    // Чистка и ограничение длины
    const clean = (v, n) => String(v == null ? '' : v).slice(0, n).trim();
    const name  = clean(data.name, 100);
    const phone = clean(data.phone, 40);
    const type  = clean(data.type, 120);
    const msg   = clean(data.msg, 1000);
    const src   = clean(data.src, 60) || 'сайт';

    if (!name || !phone) return json({ ok: false, error: 'name_phone_required' }, 400, cors);

    // Экранирование HTML, чтобы ввод пользователя не ломал разметку сообщения
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const text = [
      `🏔 <b>Заявка с сайта ${esc(src)}</b>`,
      `👤 <b>Имя:</b> ${esc(name)}`,
      `📞 <b>Телефон:</b> ${esc(phone)}`,
      type ? `📋 <b>Запрос:</b> ${esc(type)}` : '',
      msg  ? `💬 <b>Сообщение:</b> ${esc(msg)}` : '',
    ].filter(Boolean).join('\n');

    // Отправка в Telegram
    let tg, body;
    try {
      // .trim() на секретах — страховка от случайного пробела/переноса строки
      // при сохранении в панели Cloudflare (из-за него Telegram отдавал 400).
      tg = await fetch(`https://api.telegram.org/bot${(env.TG_TOKEN||'').trim()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: (env.TG_CHAT||'').trim(), text, parse_mode: 'HTML' }),
      });
      body = await tg.json().catch(() => ({}));
    } catch {
      return json({ ok: false, error: 'tg_unreachable' }, 502, cors);
    }
    // Если Telegram отклонил — показываем ТОЧНУЮ причину (description),
    // чтобы владелец сразу понял, что чинить (чаще всего «chat not found»).
    if (!tg.ok || !(body && body.ok)) {
      return json({
        ok: false,
        error: 'tg_' + tg.status,
        description: (body && body.description) || '',
      }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
