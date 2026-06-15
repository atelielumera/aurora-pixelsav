import Redis from "ioredis";

const KEY = "aurora_msgs";
const KEY_RAW = "aurora_raw";
const MAX = 500;

let _redis = null;
function getRedis() {
  if (_redis && (_redis.status === "ready" || _redis.status === "connecting" || _redis.status === "reconnecting")) return _redis;
  if (!process.env.REDIS_URL) return null;
  _redis = new Redis(process.env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    retryStrategy: (times) => Math.min(times * 300, 3000),
    enableOfflineQueue: true,
  });
  _redis.on("error", (e) => { console.error("Redis webhook:", e.message); });
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

async function saveRaw(payload) {
  const r = getRedis();
  const entry = JSON.stringify({ ts: Date.now(), payload });
  if (r) {
    try { await r.pipeline().lpush(KEY_RAW, entry).ltrim(KEY_RAW, 0, 9).exec(); return; } catch {}
  }
  if (!global._raw) global._raw = [];
  global._raw.unshift(entry);
  if (global._raw.length > 10) global._raw = global._raw.slice(0, 10);
}

async function getRaw() {
  const r = getRedis();
  if (r) {
    try {
      const list = await r.lrange(KEY_RAW, 0, 9);
      return list.map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
    } catch {}
  }
  return (global._raw || []).map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
}

// Extrai base64 de vários campos possíveis da Evolution API v1/v2
function extractBase64(obj) {
  if (!obj) return null;
  return obj.base64 || obj.mediaBase64 || obj.media || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  if (req.method === "POST") {
    // Salva payload bruto para debug (sem base64 para não estourar Redis)
    const bodyDebug = JSON.parse(JSON.stringify(req.body || {}));
    const stripBase64 = (o) => {
      if (!o || typeof o !== "object") return o;
      const copy = Array.isArray(o) ? [...o] : { ...o };
      for (const k of Object.keys(copy)) {
        if (["base64","mediaBase64","media"].includes(k) && typeof copy[k] === "string" && copy[k].length > 100) {
          copy[k] = `[base64 ${copy[k].length} chars]`;
        } else {
          copy[k] = stripBase64(copy[k]);
        }
      }
      return copy;
    };
    await saveRaw(stripBase64(bodyDebug));

    const data = req.body?.data || req.body;
    const key = data?.key || {};
    // fromMe pode vir como boolean ou string "true"
    const fromMe = key?.fromMe === true || key?.fromMe === "true";
    const remoteJid = key?.remoteJid || "";
    if (!remoteJid || remoteJid.includes("@g.us")) { res.status(200).json({ ok: true }); return; }

    const msg = data?.message || {};
    // base64 pode vir no nível do data ou do msg
    const topBase64 = extractBase64(data) || extractBase64(msg);

    let type = "text", text = "", mediaBase64 = null, fileName = null, mimeType = null;

    if (msg.conversation) {
      type = "text"; text = msg.conversation;
    } else if (msg.extendedTextMessage?.text) {
      type = "text"; text = msg.extendedTextMessage.text;
    } else if (msg.imageMessage) {
      type = "image";
      text = msg.imageMessage.caption || "🖼 imagem";
      fileName = msg.imageMessage.fileName || "imagem.jpg";
      mimeType = msg.imageMessage.mimetype || "image/jpeg";
      mediaBase64 = extractBase64(msg.imageMessage) || topBase64;
    } else if (msg.documentMessage) {
      type = "doc";
      fileName = msg.documentMessage.fileName || "documento";
      text = `📎 ${fileName}`;
      mimeType = msg.documentMessage.mimetype || "application/octet-stream";
      mediaBase64 = extractBase64(msg.documentMessage) || topBase64;
    } else if (msg.documentWithCaptionMessage?.message?.documentMessage) {
      const d = msg.documentWithCaptionMessage.message.documentMessage;
      type = "doc";
      fileName = d.fileName || "documento";
      text = `📎 ${fileName}`;
      mimeType = d.mimetype || "application/octet-stream";
      mediaBase64 = extractBase64(d) || topBase64;
    } else if (msg.audioMessage || msg.pttMessage) {
      const aud = msg.audioMessage || msg.pttMessage;
      type = "audio"; text = "🎤 áudio";
      mimeType = aud.mimetype || "audio/ogg; codecs=opus";
      mediaBase64 = extractBase64(aud) || topBase64;
    } else if (msg.videoMessage) {
      type = "doc";
      fileName = msg.videoMessage.fileName || "video.mp4";
      text = `🎥 ${fileName}`;
      mimeType = msg.videoMessage.mimetype || "video/mp4";
      mediaBase64 = extractBase64(msg.videoMessage) || topBase64;
    } else {
      type = "text"; text = "[mensagem]";
    }

    await addMsg({
      id: key?.id || `${Date.now()}`,
      remoteJid,
      fromMe,
      pushName: data?.pushName || remoteJid.split("@")[0],
      text, type, mediaBase64: fromMe ? null : mediaBase64, fileName, mimeType,
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
    if (req.query.raw === "1") {
      const raw = await getRaw();
      res.status(200).json({ payloads: raw });
      return;
    }
    const msgs = (await getMsgs()).filter(m => m.receivedAt > since);
    res.status(200).json({ messages: msgs, ts: Date.now() });
    return;
  }

  res.status(405).end();
}
