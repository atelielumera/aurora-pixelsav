import Redis from "ioredis";

const KEY = "aurora_convos_v2";
let _redis = null;

function getRedis() {
  if (!_redis && process.env.REDIS_URL) {
    _redis = new Redis(process.env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 2 });
    _redis.on("error", () => { _redis = null; });
  }
  return _redis;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const r = getRedis();

  if (req.method === "GET") {
    if (req.query.debug === "1") {
      const hasRedis = !!r;
      let rawLen = 0, count = 0, error = null;
      try {
        if (r) {
          const data = await r.get(KEY);
          rawLen = data ? data.length : 0;
          count = data ? JSON.parse(data).length : 0;
        }
      } catch(e) { error = e.message; }
      res.status(200).json({ hasRedis, rawLen, count, error, key: KEY });
      return;
    }
    try {
      if (r) {
        const data = await r.get(KEY);
        if (data) { res.status(200).json({ convos: JSON.parse(data), source: "redis" }); return; }
      }
      res.status(200).json({ convos: [], source: "empty" });
    } catch(e) {
      res.status(200).json({ convos: [], source: "error", error: e.message });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const { convos } = req.body || {};
      if (!Array.isArray(convos) || convos.length === 0) { res.status(400).json({ error: "invalid or empty" }); return; }
      // Strip base64/url to keep size manageable — media fetched on demand
      const toSave = convos.map(c => ({
        ...c,
        messages: (c.messages || []).map(m => ({ ...m, url: undefined, mediaBase64: undefined })),
        attachments: (c.attachments || []).map(a => ({ ...a, base64: undefined, url: undefined })),
      }));
      if (r) {
        await r.set(KEY, JSON.stringify(toSave));
      }
      res.status(200).json({ ok: true });
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  res.status(405).end();
}
