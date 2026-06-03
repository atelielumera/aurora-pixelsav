export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }

  const { apiKey, contents, system } = req.body || {};
  if (!apiKey || !contents) { res.status(400).json({ error: "Missing apiKey or contents" }); return; }

  try {
    // Buscar modelos disponíveis na conta
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const listData = await listRes.json();
    if (listData.error) {
      res.status(400).json({ error: listData.error?.message || JSON.stringify(listData.error) });
      return;
    }

    // Filtrar modelos que suportam generateContent, preferindo flash
    const models = (listData.models || [])
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => m.name.replace("models/", ""))
      .sort((a, b) => {
        const score = (n) => n.includes("2.0") ? 3 : n.includes("2.5") ? 4 : n.includes("1.5") ? 2 : 1;
        return score(b) - score(a);
      });

    if (!models.length) {
      res.status(400).json({ error: "Nenhum modelo Gemini disponível nesta API Key" });
      return;
    }

    // Tentar o primeiro modelo disponível
    const model = models[0];
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: system ? { parts: [{ text: system }] } : undefined,
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
        })
      }
    );
    const d = await r.json();
    if (d.error) {
      res.status(r.status).json({ error: d.error?.message || JSON.stringify(d.error) });
      return;
    }
    res.status(200).json(d);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
