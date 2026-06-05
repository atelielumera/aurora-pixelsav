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
    try {
      if (r) {
        const data = await r.get(KEY);
        if (data) { res.status(200).json({ convos: JSON.parse(data) }); return; }
      }
      res.status(200).json({ convos: [] });
    } catch(e) {
      res.status(200).json({ convos: [] });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const { convos } = req.body || {};
      if (!Array.isArray(convos)) { res.status(400).json({ error: "invalid" }); return; }
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
