export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  const { evoUrl, evoKey, path } = req.query;
  if (!evoUrl || !evoKey || !path) { res.status(400).json({ error: "Missing params" }); return; }
  try {
    const r = await fetch(`${evoUrl.replace(/\/+$/, "")}/${path}`, {
      method: req.method,
      headers: { "Content-Type": "application/json", apikey: evoKey },
      body: req.method !== "GET" && req.method !== "DELETE" && req.body ? JSON.stringify(req.body) : undefined,
    });
    const text = await r.text();
    let d; try { d = JSON.parse(text); } catch { d = { raw: text }; }
    res.status(r.status).json(d);
  } catch (e) { res.status(500).json({ error: e.message }); }
}
