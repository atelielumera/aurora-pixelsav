// Upstash Redis via REST API pura (sem dependências)
// Fallback para global._msgs quando UPSTASH não configurado (dev/preview single-instance)

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "aurora_msgs";
const MAX = 500;

async function redisCmd(...args) {
  const r = await fetch(`${UPSTASH_URL}/${args.map(a => encodeURIComponent(a)).join("/")}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  const d = await r.json();
  return d.result;
}

async function getMsgs() {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const list = await redisCmd("lrange", KEY, 0, MAX - 1);
      return (list || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
    } catch { /* fallback */ }
  }
  return global._msgs || [];
}

async function addMsg(msg) {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      // LPUSH + trim para manter máximo de 500
      const r = await fetch(`${UPSTASH_URL}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["lpush", KEY, JSON.stringify(msg)],
          ["ltrim", KEY, 0, MAX - 1],
        ]),
      });
      if (r.ok) return;
    } catch { /* fallback */ }
  }
  if (!global._msgs) global._msgs = [];
  global._msgs.unshift(msg);
  if (global._msgs.length > MAX) global._msgs = global._msgs.slice(0, MAX);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  if (req.method === "POST") {
    const data = req.body?.data || req.body;
    const key = data?.key || {};
    if (key?.fromMe) { res.status(200).json({ ok: true }); return; }
    const remoteJid = key?.remoteJid || "";
    if (!remoteJid || remoteJid.includes("@g.us")) { res.status(200).json({ ok: true }); return; }
    const msg = data?.message || {};
    let type = "text", text = "";
    if (msg.conversation) { type = "text"; text = msg.conversation; }
    else if (msg.extendedTextMessage?.text) { type = "text"; text = msg.extendedTextMessage.text; }
    else if (msg.imageMessage) { type = "image"; text = msg.imageMessage.caption || "🖼 imagem"; }
    else if (msg.documentMessage) { type = "doc"; text = `📎 ${msg.documentMessage.fileName || "documento"}`; }
    else if (msg.audioMessage || msg.pttMessage) { type = "audio"; text = "🎤 áudio"; }
    else { type = "text"; text = "[mensagem]"; }

    await addMsg({
      id: key?.id || `${Date.now()}`,
      remoteJid,
      pushName: data?.pushName || remoteJid.split("@")[0],
      text, type,
      timestamp: data?.messageTimestamp || Math.floor(Date.now() / 1000),
      receivedAt: Date.now(),
    });
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "GET") {
    const since = parseInt(req.query.since || "0");
    // debug=1 retorna todos sem filtro (para diagnosticar)
    if (req.query.debug === "1") {
      const all = await getMsgs();
      res.status(200).json({ messages: all, ts: Date.now(), store: UPSTASH_URL ? "upstash" : "global", count: all.length });
      return;
    }
    const msgs = (await getMsgs()).filter(m => m.receivedAt > since);
    res.status(200).json({ messages: msgs, ts: Date.now() });
    return;
  }

  res.status(405).end();
}
