import Redis from "ioredis";

const KEY = "aurora_meta_v1";
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
  _redis.on("error", (e) => { console.error("Redis meta:", e.message); });
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
        if (data) { res.status(200).json({ meta: JSON.parse(data) }); return; }
      }
    } catch {}
    res.status(200).json({ meta: {} });
    return;
  }

  if (req.method === "POST") {
    try {
      const { meta } = req.body || {};
      if (!meta || typeof meta !== "object") { res.status(400).json({ error: "invalid" }); return; }
      if (r) {
        await r.set(KEY, JSON.stringify(meta));
        res.status(200).json({ ok: true, saved: "redis" });
      } else {
        res.status(200).json({ ok: false, saved: "none", error: "no redis" });
      }
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
    return;
  }

  res.status(405).end();
}
