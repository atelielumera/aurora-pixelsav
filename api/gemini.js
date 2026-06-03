const MODELS = [
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash-8b-latest",
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }

  const { apiKey, contents, system } = req.body || {};
  if (!apiKey || !contents) { res.status(400).json({ error: "Missing apiKey or contents" }); return; }

  let lastError = "";
  for (const model of MODELS) {
    try {
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
        lastError = d.error?.message || d.error?.status || JSON.stringify(d.error);
        if (lastError.includes("not found") || lastError.includes("not supported") || lastError.includes("deprecated")) continue;
        res.status(r.status).json({ error: lastError });
        return;
      }
      res.status(200).json(d);
      return;
    } catch (e) {
      lastError = e.message;
    }
  }
  res.status(500).json({ error: lastError || "Nenhum modelo Gemini disponível" });
}
