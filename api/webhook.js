export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  if (req.method === "POST") {
    try {
      const body = req.body;
      const event = body?.event || body?.type || "";
      const data = body?.data || body;

      // Aceita qualquer formato de mensagem recebida
      const key = data?.key || data?.message?.key || {};
      const fromMe = key?.fromMe === true;
      if (fromMe) { res.status(200).json({ ok: true }); return; }

      const remoteJid = key?.remoteJid || data?.remoteJid || "";
      if (!remoteJid || remoteJid.includes("@g.us")) { 
        res.status(200).json({ ok: true }); return; 
      }

      const msgData = data?.message || data;
      const pushName = data?.pushName || data?.notifyName || remoteJid.split("@")[0];
      
      const text = 
        msgData?.conversation ||
        msgData?.extendedTextMessage?.text ||
        msgData?.imageMessage?.caption ||
        msgData?.documentMessage?.caption ||
        msgData?.audioMessage ? "[áudio]" :
        msgData?.pttMessage ? "[áudio]" :
        msgData?.videoMessage ? "[vídeo]" :
        "[mídia]";

      const type = 
        msgData?.audioMessage || msgData?.pttMessage ? "audio" :
        msgData?.imageMessage ? "image" :
        msgData?.documentMessage ? "doc" : "text";

      const msg = {
        id: key?.id || Date.now().toString(),
        remoteJid,
        pushName,
        text,
        type,
        timestamp: data?.messageTimestamp || Math.floor(Date.now()/1000),
        receivedAt: Date.now(),
      };

      // Armazena no global (persiste enquanto a função estiver quente)
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
