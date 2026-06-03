export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { key } = req.query;
  if (!key) { res.status(400).json({ error: "Missing key" }); return; }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  const d = await r.json();
  res.status(r.status).json(d);
}
