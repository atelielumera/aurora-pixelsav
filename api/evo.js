// Proxy para Evolution API — resolve CORS
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { evoUrl, evoKey, path } = req.query;
  if (!evoUrl || !evoKey || !path) {
    res.status(400).json({ error: "Missing params" }); return;
  }

  try {
    const url = `${evoUrl}/${path}`;
    const opts = {
      method: req.method,
      headers: { "Content-Type": "application/json", apikey: evoKey },
    };
    if (req.method !== "GET" && req.method !== "DELETE" && req.body) {
      opts.body = JSON.stringify(req.body);
    }
    const r = await fetch(url, opts);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
