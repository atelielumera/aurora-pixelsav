import Redis from "ioredis";

const KEY = "aurora_msgs";
const MAX = 500;

let _redis = null;
function getRedis() {
  if (!_redis && process.env.REDIS_URL) {
    _redis = new Redis(process.env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 2 });
    _redis.on("error", () => { _redis = null; });
  }
  return _redis;
}

async function getMsgs() {
  const r = getRedis();
  if (r) {
    try {
      const list = await r.lrange(KEY, 0, MAX - 1);
      return list.map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
    } catch {}
  }
  return global._msgs || [];
}

async function addMsg(msg) {
  const r = getRedis();
  if (r) {
    try {
      await r.pipeline().lpush(KEY, JSON.stringify(msg)).ltrim(KEY, 0, MAX - 1).exec();
      return;
    } catch {}
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
    let type = "text", text = "", mediaBase64 = null, fileName = null, mimeType = null;
    if (msg.conversation) { type = "text"; text = msg.conversation; }
    else if (msg.extendedTextMessage?.text) { type = "text"; text = msg.extendedTextMessage.text; }
    else if (msg.imageMessage) {
      type = "image";
      text = msg.imageMessage.caption || "🖼 imagem";
      fileName = "imagem.jpg";
      mimeType = msg.imageMessage.mimetype || "image/jpeg";
      mediaBase64 = msg.imageMessage.base64 || null;
    }
    else if (msg.documentMessage) {
      type = "doc";
      fileName = msg.documentMessage.fileName || "documento";
      text = `📎 ${fileName}`;
      mimeType = msg.documentMessage.mimetype || "application/octet-stream";
      mediaBase64 = msg.documentMessage.base64 || null;
    }
    else if (msg.audioMessage || msg.pttMessage) { type = "audio"; text = "🎤 áudio"; }
    else { type = "text"; text = "[mensagem]"; }

    await addMsg({
      id: key?.id || `${Date.now()}`,
      remoteJid,
      pushName: data?.pushName || remoteJid.split("@")[0],
      text, type, mediaBase64, fileName, mimeType,
      timestamp: data?.messageTimestamp || Math.floor(Date.now() / 1000),
      receivedAt: Date.now(),
    });
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "GET") {
    const since = parseInt(req.query.since || "0");
    if (req.query.debug === "1") {
      const all = await getMsgs();
      res.status(200).json({ messages: all, ts: Date.now(), store: process.env.REDIS_URL ? "redis" : "global", count: all.length });
      return;
    }
    const msgs = (await getMsgs()).filter(m => m.receivedAt > since);
    res.status(200).json({ messages: msgs, ts: Date.now() });
    return;
  }

  res.status(405).end();
}
