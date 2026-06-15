export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }

  const { evoUrl, evoKey, instance, messageId, remoteJid } = req.body || {};
  if (!evoUrl || !evoKey || !instance || !messageId || !remoteJid) {
    res.status(400).json({ error: "Missing params" }); return;
  }

  const base = evoUrl.replace(/\/$/, "");
  try {
    const r = await fetch(`${base}/chat/getBase64FromMediaMessage/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": evoKey },
      body: JSON.stringify({ message: { key: { id: messageId, remoteJid, fromMe: req.body?.fromMe ?? false } } })
    });
    const d = await r.json();
    if (d.base64) {
      res.status(200).json({ base64: d.base64, mimetype: d.mimetype || null });
    } else {
      res.status(200).json({ error: "no base64", raw: d });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
