export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  if (req.method === "POST") {
    try {
      const body = req.body;
      const data = body?.data || body;
      const key = data?.key || {};
      if (key?.fromMe === true) { res.status(200).json({ ok: true }); return; }
      const remoteJid = key?.remoteJid || "";
      if (!remoteJid || remoteJid.includes("@g.us")) { res.status(200).json({ ok: true }); return; }

      const msgContent = data?.message || {};
      const pushName = data?.pushName || data?.notifyName || remoteJid.split("@")[0];

      // Detecta tipo correto
      let type = "text";
      let text = "";

      if (msgContent.conversation) {
        type = "text";
        text = msgContent.conversation;
      } else if (msgContent.extendedTextMessage?.text) {
        type = "text";
        text = msgContent.extendedTextMessage.text;
      } else if (msgContent.imageMessage) {
        type = "image";
        text = msgContent.imageMessage.caption || "🖼 [imagem]";
      } else if (msgContent.documentMessage) {
        type = "doc";
        text = msgContent.documentMessage.caption || `📎 ${msgContent.documentMessage.fileName || "documento"}`;
      } else if (msgContent.audioMessage || msgContent.pttMessage) {
        type = "audio";
        text = "🎤 [áudio]";
      } else if (msgContent.videoMessage) {
        type = "video";
        text = "🎬 [vídeo]";
      } else {
        type = "text";
        text = "[mensagem]";
      }

      const msg = {
        id: key?.id || `${Date.now()}`,
        remoteJid,
        pushName,
        text,
        type,
        timestamp: data?.messageTimestamp || Math.floor(Date.now() / 1000),
        receivedAt: Date.now(),
      };

      if (!global._msgs) global._msgs = [];
      global._msgs.unshift(msg);
      if (global._msgs.length > 500) global._msgs = global._msgs.slice(0, 500);

      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(200).json({ ok: false });
    }
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
