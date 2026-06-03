export default function handler(req, res) {
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
    if (!global._msgs) global._msgs = [];
    global._msgs.unshift({
      id: key?.id || `${Date.now()}`,
      remoteJid,
      pushName: data?.pushName || remoteJid.split("@")[0],
      text, type,
      timestamp: data?.messageTimestamp || Math.floor(Date.now() / 1000),
      receivedAt: Date.now(),
    });
    if (global._msgs.length > 500) global._msgs = global._msgs.slice(0, 500);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "GET") {
    const since = parseInt(req.query.since || "0");
    const msgs = (global._msgs || []).filter(m => m.receivedAt > since);
    res.status(200).json({ messages: msgs, ts: Date.now() });
    return;
  }

  res.status(405).end();
}
