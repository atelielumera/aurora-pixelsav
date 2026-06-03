import { useState, useRef, useEffect } from "react";

// ─── AURORA SYSTEM PROMPT ────────────────────────────────────────────────────
const AURORA_SYSTEM = `Você é Aurora, SDR sênior da PixelSAV — especialista em experiências audiovisuais imersivas.

MISSÃO: Analisar a conversa e gerar a MELHOR resposta que Denise deve enviar ao cliente.

PORTFÓLIO PIXELSAV:
Projeção Mapeada (cenário, fachada, objetos), Sphere 360°, App Realidade Aumentada, RA Real Time Interativo, Realidade Virtual, Raio-X Interativo, Parede Interativa, Holografia em Palco, Display Holográfico, Sensores e Câmeras, Instalações Fixas (museus/memoriais), Conteúdo 3D/Motion Graphics, Sala Imersiva, Vídeos DOOH/FOOH.

TABELA LOCAÇÃO:
- Até R$10k: games online, totens básicos, vídeos curtos
- R$10k–20k: games personalizados, totens interativos, vídeos 3D até 2min
- R$20k–50k: holografia, vídeos até 5min
- R$50k–100k: mapping, VR/AR, piso interativo
- R$100k–200k: sala imersiva, PixelDome
- R$200k–500k: sala imersiva grande
- +R$500k: projetos especiais

TABELA VENDA:
- R$10k–50k: dispositivos interativos simples
- R$50k–100k: Raio-X, display holográfico
- R$100k–200k: instalações fixas, parede interativa
- R$200k–500k: sala imersiva
- +R$500k: museus, domos, projetos especiais

REGRAS CRÍTICAS:
- Resposta: máximo 2-3 linhas curtas, tom WhatsApp, sem markdown
- Nunca mais de 1 pergunta por vez
- Nunca inventar preços — usar "a partir de X"
- Nunca sugerir acima da faixa do cliente
- Sem orçamento declarado → não sugerir solução específica
- Se cliente quiser humano → "Vou chamar a Denise agora, um momento!"
- Sempre terminar com pergunta ou próximo passo claro
- Tom: consultivo, empático, natural, nunca robótico
- Máximo 1 emoji por mensagem

FLUXO: Saudação → Descoberta → Qualificação → Locação ou Venda → Orçamento → Apresentação → Próximo passo

RESPONDA APENAS com o texto da mensagem. Sem explicações, sem prefixos. Só o texto puro.`;

// ─── GEMINI ──────────────────────────────────────────────────────────────────
async function callGemini(apiKey, msgs) {
  const textMsgs = msgs.filter(m => m.type === "text" || !m.type);
  const contents = [];
  for (let i = 0; i < textMsgs.length; i++) {
    const m = textMsgs[i];
    const role = m.from === "cliente" ? "user" : "model";
    const text = m.from === "cliente" ? `CLIENTE: ${m.text}` : `DENISE: ${m.text}`;
    if (contents.length && contents[contents.length - 1].role === role) {
      contents.push({ role: role === "user" ? "model" : "user", parts: [{ text: "..." }] });
    }
    contents.push({ role, parts: [{ text }] });
  }
  if (!contents.length || contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "Início da conversa." }] });
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: AURORA_SYSTEM }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Erro.";
}

// ─── LEAD UTILS ──────────────────────────────────────────────────────────────
function calcScore(ld) {
  let s = 0;
  if (ld.nome) s += 10; if (ld.empresa) s += 15; if (ld.projeto) s += 20;
  if (ld.evento) s += 20; if (ld.prazo) s += 15; if (ld.orcamento) s += 15;
  if (ld.briefing) s += 15; if (ld.intencaoCompra) s += 20;
  return Math.min(s, 100);
}
function scoreInfo(s) {
  if (s >= 80) return { label: "QUENTE", color: "#ef4444", bg: "#ef444420", emoji: "🔴" };
  if (s >= 40) return { label: "MORNO", color: "#f97316", bg: "#f9731620", emoji: "🟠" };
  return { label: "FRIO", color: "#60a5fa", bg: "#60a5fa20", emoji: "🔵" };
}
function extractLead(msgs, cur) {
  const t = msgs.map(m => m.text || "").join(" ");
  return {
    ...cur,
    intencaoCompra: /quanto custa|orçamento|valor|preciso para|preço/i.test(t),
    evento: /evento|show|formatura|festa|lançamento|feira|congresso/i.test(t),
    projeto: /projeto|instalação|museu|memorial|corporativo|fachada|mapping/i.test(t),
    prazo: /janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|\d{4}|semana|urgente/i.test(t),
  };
}
function buildResumo(msgs, ld, score, attachments) {
  const si = scoreInfo(score);
  const hasAttach = attachments && attachments.length > 0;
  const lines = [
    `🎯 *RESUMO DO LEAD — PixelSAV*`, ``,
    `${si.emoji} *Status:* ${si.label} (${score}/100)`, ``,
    `*📋 DADOS*`,
    ld.nome ? `• Nome: ${ld.nome}` : null,
    ld.empresa ? `• Empresa: ${ld.empresa}` : null,
    ld.email ? `• E-mail: ${ld.email}` : null,
    ld.telefone ? `• Tel: ${ld.telefone}` : null,
    ld.cidade ? `• Cidade: ${ld.cidade}` : null, ``,
    `*📦 PROJETO*`,
    ld.produto ? `• Solução: ${ld.produto}` : null,
    ld.prazo ? `• Prazo: ${ld.prazo}` : null,
    ld.orcamento ? `• Orçamento: ${ld.orcamento}` : null,
    ld.tipo ? `• Tipo: ${ld.tipo}` : null, ``,
    `*💬 BANT*`,
    `• Budget: ${ld.orcamento || "—"}`,
    `• Authority: ${ld.decisor || "—"}`,
    `• Need: ${ld.projeto ? "projeto definido" : "em descoberta"}`,
    `• Timing: ${ld.prazo || "—"}`, ``,
    `*📝 HISTÓRICO (últimas mensagens)*`,
    ...msgs.slice(-5).map(m => {
      if (m.type === "image") return `[${m.from === "cliente" ? "C" : "D"}] 🖼 Imagem: ${m.fileName || "sem nome"}`;
      if (m.type === "doc") return `[${m.from === "cliente" ? "C" : "D"}] 📎 Arquivo: ${m.fileName || "sem nome"}`;
      return `[${m.from === "cliente" ? "C" : "D"}] ${(m.text || "").slice(0, 90)}`;
    }),
    hasAttach ? `` : null,
    hasAttach ? `*📂 ANEXOS ENVIADOS (${attachments.length})*` : null,
    ...(hasAttach ? attachments.map(a => `• ${a.type === "image" ? "🖼" : "📎"} ${a.fileName}`) : []),
    ``, `_Agente Aurora · PixelSAV_`,
  ].filter(x => x !== null).join("\n");
  return lines;
}

// ─── EVOLUTION API ───────────────────────────────────────────────────────────
async function sendTextEvolution(cfg, text) {
  const r = await fetch(`${cfg.evoUrl}/message/sendText/${cfg.instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.evoKey },
    body: JSON.stringify({ number: cfg.groupId, text }),
  });
  if (!r.ok) throw new Error(await r.text());
}

async function sendMediaEvolution(cfg, attachment) {
  // Send as base64 media
  const endpoint = attachment.type === "image"
    ? `${cfg.evoUrl}/message/sendMedia/${cfg.instance}`
    : `${cfg.evoUrl}/message/sendMedia/${cfg.instance}`;

  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.evoKey },
    body: JSON.stringify({
      number: cfg.groupId,
      mediatype: attachment.type === "image" ? "image" : "document",
      mimetype: attachment.mimeType,
      caption: `📎 Anexo do cliente: ${attachment.fileName}`,
      media: attachment.base64,
      fileName: attachment.fileName,
    }),
  });
  if (!r.ok) throw new Error(await r.text());
}

// ─── FILE UTILS ──────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function isImage(file) { return file.type.startsWith("image/"); }
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function docIcon(mimeType) {
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("doc")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv")) return "📊";
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "🗜";
  if (mimeType.includes("video")) return "🎬";
  if (mimeType.includes("audio")) return "🎵";
  return "📎";
}

// ─── TIME ────────────────────────────────────────────────────────────────────
const ts = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const dateLabel = () => new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

// ─── COLORS ──────────────────────────────────────────────────────────────────
const W = {
  leftBg: "#111b21", leftHdr: "#202c33", chatBg: "#0b141a",
  chatHdr: "#202c33", bubbleIn: "#202c33", bubbleOut: "#005c4b",
  inputBg: "#2a3942", inputArea: "#202c33", green: "#00a884",
  text: "#e9edef", sub: "#8696a0", divider: "#2a3942",
  hover: "#2a3942", active: "#2d3b43", searchBg: "#2a3942", icon: "#aebac1",
};

// ─── AVATAR ──────────────────────────────────────────────────────────────────
function Avatar({ name, size = 40, gradient = false }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#6b7cff", "#ff6b6b", "#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#ff9f1c"];
  const idx = name ? name.charCodeAt(0) % colors.length : 0;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: gradient ? "linear-gradient(135deg,#ff3a1a,#1a6aff,#00cc66)" : colors[idx],
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: "#fff", flexShrink: 0, userSelect: "none",
    }}>
      {gradient ? "A" : initials}
    </div>
  );
}

// ─── MESSAGE BUBBLE ──────────────────────────────────────────────────────────
function MessageBubble({ msg, showAvatar, clientName }) {
  const isClient = msg.from === "cliente";
  const [imgExpanded, setImgExpanded] = useState(false);

  const renderContent = () => {
    if (msg.type === "image") {
      return (
        <div>
          <img
            src={`data:${msg.mimeType};base64,${msg.base64}`}
            alt={msg.fileName}
            onClick={() => setImgExpanded(p => !p)}
            style={{
              maxWidth: imgExpanded ? 320 : 200, maxHeight: imgExpanded ? 400 : 160,
              borderRadius: 6, cursor: "pointer", display: "block",
              objectFit: "cover", transition: "all .2s",
            }}
          />
          <div style={{ color: "#8696a077", fontSize: 11, marginTop: 3 }}>{msg.fileName}</div>
        </div>
      );
    }
    if (msg.type === "doc") {
      return (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "#ffffff10", borderRadius: 8, padding: "8px 10px", minWidth: 180,
        }}>
          <span style={{ fontSize: 28 }}>{docIcon(msg.mimeType)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: W.text, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.fileName}</div>
            <div style={{ color: W.sub, fontSize: 11 }}>{msg.fileSize}</div>
          </div>
        </div>
      );
    }
    return <div style={{ color: W.text, fontSize: 14.5, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.text}</div>;
  };

  return (
    <div style={{ display: "flex", justifyContent: isClient ? "flex-start" : "flex-end", marginBottom: 2, alignItems: "flex-end", gap: 6 }}>
      {isClient && <div style={{ width: 28, flexShrink: 0 }}>{showAvatar && <Avatar name={clientName} size={28} />}</div>}
      <div style={{ maxWidth: "65%", position: "relative" }}>
        {showAvatar && (
          <div style={{
            position: "absolute", bottom: 0, [isClient ? "left" : "right"]: -6,
            width: 0, height: 0, borderStyle: "solid",
            borderWidth: isClient ? "0 0 8px 8px" : "0 8px 8px 0",
            borderColor: isClient
              ? `transparent transparent ${W.bubbleIn} transparent`
              : `transparent ${W.bubbleOut} transparent transparent`,
          }} />
        )}
        <div style={{
          background: isClient ? W.bubbleIn : W.bubbleOut,
          borderRadius: isClient ? (showAvatar ? "2px 8px 8px 8px" : "8px") : (showAvatar ? "8px 2px 8px 8px" : "8px"),
          padding: "6px 10px 4px", boxShadow: "0 1px 1px #0005",
        }}>
          {renderContent()}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3, marginTop: 3 }}>
            <span style={{ color: "#8696a077", fontSize: 11 }}>{msg.time}</span>
            {!isClient && <span style={{ color: "#53bdeb", fontSize: 13 }}>✓✓</span>}
          </div>
        </div>
      </div>
      {!isClient && <div style={{ width: 28, flexShrink: 0 }}>{showAvatar && <Avatar name="Denise" size={28} />}</div>}
    </div>
  );
}

// ─── WHATSAPP PANEL ──────────────────────────────────────────────────────────
function WhatsAppPanel({ cfg, onSaveInstance, onClose }) {
  const [instanceName, setInstanceName] = useState("");
  const [step, setStep] = useState("form");
  const [qrCode, setQrCode] = useState(null);
  const [err, setErr] = useState("");
  const pollRef = useRef(null);

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  async function handleCriar() {
    const name = instanceName.trim();
    if (!name) return;
    if (!cfg.evoUrl || !cfg.evoKey) { setErr("Salve a Evolution API URL e API Key em ⚙️ primeiro."); return; }
    setErr(""); setStep("loading"); setQrCode(null);
    try {
      await fetch(`${cfg.evoUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.evoKey },
        body: JSON.stringify({ instanceName: name, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
      });
      await new Promise(r => setTimeout(r, 2000));
      const qr = await buscarQR(name);
      if (qr) {
        setStep("qr");
        try { localStorage.setItem("aurora_wa_instance", name); } catch {}
        onSaveInstance(name);
        pollRef.current = setInterval(async () => {
          const ok = await verificarConectado(name);
          if (ok) { clearInterval(pollRef.current); setStep("connected"); }
          else { await buscarQR(name); }
        }, 4000);
      } else {
        setErr("Não consegui gerar o QR Code. Tente novamente.");
        setStep("form");
      }
    } catch (e) { setErr(e.message); setStep("form"); }
  }

  async function buscarQR(name) {
    try {
      const r = await fetch(`${cfg.evoUrl}/instance/connect/${name}`, { headers: { apikey: cfg.evoKey } });
      const d = await r.json();
      const img = d.base64 || d.qrcode?.base64 || null;
      if (img) { setQrCode(img); return img; }
      if ((d.instance?.state || d.state) === "open") { setStep("connected"); return null; }
      return null;
    } catch { return null; }
  }

  async function verificarConectado(name) {
    try {
      const r = await fetch(`${cfg.evoUrl}/instance/connectionState/${name}`, { headers: { apikey: cfg.evoKey } });
      const d = await r.json();
      return (d.instance?.state || d.state) === "open";
    } catch { return false; }
  }

  async function handleDesconectar() {
    if (pollRef.current) clearInterval(pollRef.current);
    try { await fetch(`${cfg.evoUrl}/instance/logout/${instanceName.trim()}`, { method: "DELETE", headers: { apikey: cfg.evoKey } }); } catch {}
    try { localStorage.removeItem("aurora_wa_instance"); } catch {}
    onSaveInstance("");
    setStep("form"); setQrCode(null); setInstanceName("");
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#111b21", border: `1px solid ${W.divider}`, borderRadius: 16, padding: 28, width: 400, maxWidth: "95vw", display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 20px 60px #000a" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>📱</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: W.text, fontWeight: 700, fontSize: 16 }}>WhatsApp · Conexão</div>
            <div style={{ color: W.sub, fontSize: 12 }}>Evolution API · Criar instância e gerar QR Code</div>
          </div>
          <button onClick={() => { if (pollRef.current) clearInterval(pollRef.current); onClose(); }}
            style={{ background: "none", border: "none", color: W.sub, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {step === "form" && (
          <>
            <div>
              <label style={{ color: W.sub, fontSize: 11, display: "block", marginBottom: 6 }}>NOME DA INSTÂNCIA</label>
              <input value={instanceName} onChange={e => setInstanceName(e.target.value.replace(/\s/g, ""))}
                onKeyDown={e => e.key === "Enter" && handleCriar()}
                placeholder="ex: pixelsav-comercial"
                style={{ width: "100%", background: W.inputBg, border: `1px solid ${W.divider}`, borderRadius: 8, padding: "10px 14px", color: W.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            {err && <div style={{ background: "#2a1010", border: "1px solid #ef444444", borderRadius: 8, padding: "9px 12px", color: "#ef4444", fontSize: 12 }}>⚠️ {err}</div>}
            <button onClick={handleCriar} disabled={!instanceName.trim()}
              style={{ background: instanceName.trim() ? W.green : "#2a3942", color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: instanceName.trim() ? "pointer" : "not-allowed" }}>
              Criar e gerar QR Code
            </button>
          </>
        )}

        {step === "loading" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "24px 0" }}>
            <div style={{ fontSize: 36 }}>⚙️</div>
            <div style={{ color: W.sub, fontSize: 13 }}>Criando instância e gerando QR Code...</div>
          </div>
        )}

        {step === "qr" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ color: W.green, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>📷 ESCANEIE COM O WHATSAPP</div>
            <div style={{ background: "#fff", borderRadius: 12, padding: 10 }}>
              {qrCode ? (
                <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code" style={{ width: 230, height: 230, display: "block" }} />
              ) : (
                <div style={{ width: 230, height: 230, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 13 }}>Gerando...</div>
              )}
            </div>
            <div style={{ color: W.sub, fontSize: 11, textAlign: "center", lineHeight: 1.7 }}>
              WhatsApp → Dispositivos conectados → Conectar dispositivo → Escaneie
            </div>
            <button onClick={() => buscarQR(instanceName.trim())}
              style={{ background: W.inputBg, border: `1px solid ${W.divider}`, borderRadius: 8, padding: "8px 20px", color: W.text, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              🔄 Atualizar QR Code
            </button>
          </div>
        )}

        {step === "connected" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ background: "#0d2a1a", border: `1px solid ${W.green}66`, borderRadius: 12, padding: "20px 28px", textAlign: "center", width: "100%", boxSizing: "border-box" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
              <div style={{ color: W.green, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>WhatsApp Conectado!</div>
              <div style={{ color: W.sub, fontSize: 13 }}>Instância: <strong style={{ color: W.text }}>{instanceName}</strong></div>
            </div>
            <button onClick={handleDesconectar}
              style={{ width: "100%", background: "#2a1010", border: "1px solid #ef444444", borderRadius: 8, padding: "10px 0", color: "#ef4444", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              Desconectar instância
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function AuroraAgent() {
  const [cfg, setCfg] = useState({ geminiKey: "", evoUrl: "", instance: "", evoKey: "", groupId: "" });
  const [showCfg, setShowCfg] = useState(false);
  const [showWA, setShowWA] = useState(false);
  const [convos, setConvos] = useState([
    { id: 1, name: "Cliente Exemplo", phone: "41 99999-0001", lastMsg: "Oi, vi vocês no Instagram!", time: "09:14", unread: 1, messages: [], leadData: {}, attachments: [] },
  ]);
  const [activeId, setActiveId] = useState(1);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [clientInput, setClientInput] = useState("");
  const [suggestion, setSuggestion] = useState(null);
  const [editedSug, setEditedSug] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resumoSent, setResumoSent] = useState({});
  const [resumoSending, setResumoSending] = useState(false);
  const [resumoErr, setResumoErr] = useState("");
  const [showResumo, setShowResumo] = useState(false);
  const [showLead, setShowLead] = useState(false);
  // Lightbox
  const [lightbox, setLightbox] = useState(null);

  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    try { const s = localStorage.getItem("aurora_cfg_v3"); if (s) setCfg(JSON.parse(s)); } catch {}
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [convos, activeId, suggestion, loading]);

  const active = convos.find(c => c.id === activeId);
  const msgs = active?.messages || [];
  const leadData = active?.leadData || {};
  const attachments = active?.attachments || [];
  const score = calcScore(leadData);
  const si = scoreInfo(score);

  function updateConvo(id, patch) { setConvos(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c)); }
  function updateLead(id, patch) { setConvos(cs => cs.map(c => c.id === id ? { ...c, leadData: { ...c.leadData, ...patch } } : c)); }
  function saveCfg() { try { localStorage.setItem("aurora_cfg_v3", JSON.stringify(cfg)); } catch {} setShowCfg(false); }

  function addConvo() {
    if (!newName.trim()) return;
    const id = Date.now();
    setConvos(cs => [{ id, name: newName.trim(), phone: "", lastMsg: "Nova conversa", time: ts(), unread: 0, messages: [], leadData: {}, attachments: [] }, ...cs]);
    setActiveId(id); setNewName(""); setShowNew(false);
  }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length || !active) return;
    for (const file of files) {
      const base64 = await fileToBase64(file);
      const type = isImage(file) ? "image" : "doc";
      const attachObj = { id: Date.now() + Math.random(), fileName: file.name, mimeType: file.type, base64, type, fileSize: formatBytes(file.size) };
      const msg = { from: "cliente", type, fileName: file.name, mimeType: file.type, base64, fileSize: formatBytes(file.size), time: ts(), id: Date.now() + Math.random() };
      setConvos(cs => cs.map(c => c.id === activeId ? {
        ...c,
        messages: [...c.messages, msg],
        attachments: [...(c.attachments || []), attachObj],
        lastMsg: type === "image" ? "🖼 Imagem" : `📎 ${file.name}`,
        time: ts(),
      } : c));
    }
    e.target.value = "";
  }

  async function handleSend() {
    const text = clientInput.trim();
    if (!text || loading || !active) return;
    const msg = { from: "cliente", text, time: ts(), id: Date.now(), type: "text" };
    const newMsgs = [...msgs, msg];
    const newLead = extractLead(newMsgs, leadData);
    updateConvo(activeId, { messages: newMsgs, leadData: newLead, lastMsg: text.slice(0, 40), time: ts() });
    setClientInput(""); setSuggestion(null); setEditedSug("");
    setLoading(true);
    try {
      if (!cfg.geminiKey) throw new Error("Configure a chave Gemini em ⚙️");
      const resp = await callGemini(cfg.geminiKey, newMsgs);
      setSuggestion(resp); setEditedSug(resp);
    } catch (e) { setSuggestion(`Erro: ${e.message}`); setEditedSug(`Erro: ${e.message}`); }
    setLoading(false);
  }

  function confirmSend() {
    if (!editedSug.trim() || !active) return;
    const msg = { from: "denise", text: editedSug.trim(), time: ts(), id: Date.now(), type: "text" };
    const newMsgs = [...msgs, msg];
    updateConvo(activeId, { messages: newMsgs, lastMsg: editedSug.trim().slice(0, 40), time: ts() });
    setSuggestion(null); setEditedSug("");
  }

  async function handleSendResumo() {
    setResumoSending(true); setResumoErr("");
    try {
      if (!cfg.evoUrl || !cfg.instance || !cfg.groupId) throw new Error("Configure a Evolution API em ⚙️");
      // 1. Send text summary
      await sendTextEvolution(cfg, buildResumo(msgs, leadData, score, attachments));
      // 2. Send each attachment
      for (const att of attachments) {
        try { await sendMediaEvolution(cfg, att); } catch (e) { console.warn("Falha ao enviar anexo:", att.fileName, e.message); }
      }
      setResumoSent(r => ({ ...r, [activeId]: true }));
    } catch (e) { setResumoErr(e.message); }
    setResumoSending(false);
  }

  const filtered = convos.filter(c => c.name.toLowerCase().includes(searchQ.toLowerCase()));

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", fontFamily: "'Segoe UI',system-ui,sans-serif", overflow: "hidden", background: "#000" }}>

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: "fixed", inset: 0, background: "#000d", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <img src={`data:${lightbox.mimeType};base64,${lightbox.base64}`} alt={lightbox.fileName}
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, boxShadow: "0 0 40px #000" }} />
        </div>
      )}

      {/* WhatsApp Panel Modal */}
      {showWA && <WhatsAppPanel cfg={cfg} onSaveInstance={(name) => { setCfg(c => { const nc = {...c, instance: name}; try { localStorage.setItem("aurora_cfg_v3", JSON.stringify(nc)); } catch {} return nc; }); }} onClose={() => setShowWA(false)} />}

      {/* ════ LEFT ════ */}
      <div style={{ width: 380, minWidth: 300, display: "flex", flexDirection: "column", background: W.leftBg, borderRight: `1px solid ${W.divider}`, flexShrink: 0 }}>

        {/* Header */}
        <div style={{ background: W.leftHdr, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, height: 60, flexShrink: 0 }}>
          <Avatar name="Denise" size={40} />
          <span style={{ flex: 1, color: W.text, fontWeight: 600, fontSize: 15 }}>Denise · PixelSAV</span>
          <button onClick={() => setShowNew(p => !p)} title="Nova conversa" style={{ background: "none", border: "none", color: W.icon, cursor: "pointer", fontSize: 20, padding: "4px 6px", borderRadius: 6 }}>✎</button>
          <button onClick={() => setShowWA(true)} title="Conectar WhatsApp" style={{ background: "none", border: "none", color: W.icon, cursor: "pointer", fontSize: 18, padding: "4px 6px", borderRadius: 6 }}>📱</button>
          <button onClick={() => setShowCfg(p => !p)} title="Configurações" style={{ background: "none", border: "none", color: W.icon, cursor: "pointer", fontSize: 18, padding: "4px 6px", borderRadius: 6 }}>⚙</button>
        </div>

        {/* Config */}
        {showCfg && (
          <div style={{ background: "#0d1418", borderBottom: `1px solid ${W.divider}`, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
            <div style={{ color: W.text, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 2 }}>⚙ CONFIGURAÇÕES</div>
            {[["geminiKey", "Gemini API Key", "AIza...", "password"],
              ["evoUrl", "Evolution API URL", "https://...", "text"],
              ["instance", "Instância", "pixelsav", "text"],
              ["evoKey", "API Key Evolution", "token...", "password"],
              ["groupId", "ID do Grupo WA", "5541...@g.us", "text"]
            ].map(([k, label, ph, type]) => (
              <div key={k} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <label style={{ color: W.sub, fontSize: 10 }}>{label}</label>
                <input type={type} value={cfg[k]} placeholder={ph} onChange={e => setCfg(c => ({ ...c, [k]: e.target.value }))}
                  style={{ background: W.searchBg, border: "none", borderRadius: 6, padding: "6px 9px", color: W.text, fontSize: 12, outline: "none" }} />
              </div>
            ))}
            <button onClick={saveCfg} style={{ background: W.green, color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: 12, cursor: "pointer", marginTop: 2 }}>✓ Salvar</button>
          </div>
        )}

        {/* New convo */}
        {showNew && (
          <div style={{ background: "#0d1418", borderBottom: `1px solid ${W.divider}`, padding: "10px 14px", display: "flex", gap: 8, flexShrink: 0 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addConvo()}
              placeholder="Nome do cliente..." style={{ flex: 1, background: W.searchBg, border: "none", borderRadius: 8, padding: "8px 12px", color: W.text, fontSize: 13, outline: "none" }} />
            <button onClick={addConvo} style={{ background: W.green, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>+</button>
          </div>
        )}

        {/* Search */}
        <div style={{ padding: "8px 12px", flexShrink: 0 }}>
          <div style={{ background: W.searchBg, borderRadius: 8, display: "flex", alignItems: "center", padding: "7px 12px", gap: 8 }}>
            <span style={{ color: W.sub, fontSize: 14 }}>🔍</span>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Pesquisar conversas"
              style={{ flex: 1, background: "transparent", border: "none", color: W.text, fontSize: 13.5, outline: "none" }} />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.map(c => {
            const cs = calcScore(c.leadData); const csi = scoreInfo(cs);
            const isActive = c.id === activeId;
            const hasAttach = (c.attachments || []).length > 0;
            return (
              <div key={c.id} onClick={() => { setActiveId(c.id); setSuggestion(null); setEditedSug(""); setShowResumo(false); }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer", background: isActive ? W.active : "transparent", borderBottom: `1px solid ${W.divider}22`, transition: "background .1s" }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = W.hover; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                <div style={{ position: "relative" }}>
                  <Avatar name={c.name} size={49} />
                  {c.unread > 0 && <div style={{ position: "absolute", top: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: W.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>{c.unread}</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ color: W.text, fontWeight: 600, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{c.name}</span>
                    <span style={{ color: c.unread ? W.green : W.sub, fontSize: 11.5 }}>{c.time}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ color: W.sub, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{c.lastMsg}</span>
                    {hasAttach && <span style={{ fontSize: 12 }}>📎</span>}
                    {cs > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: csi.color, background: csi.bg, borderRadius: 10, padding: "2px 6px", flexShrink: 0 }}>{csi.emoji}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ════ RIGHT ════ */}
      {!active ? (
        <div style={{ flex: 1, background: W.chatBg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <div style={{ fontSize: 64 }}>💬</div>
          <div style={{ color: W.text, fontSize: 20, fontWeight: 300 }}>Agente Aurora · PixelSAV</div>
          <div style={{ color: W.sub, fontSize: 14 }}>Selecione ou crie uma conversa</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Chat Header */}
          <div style={{ background: W.chatHdr, height: 60, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, flexShrink: 0, borderBottom: `1px solid ${W.divider}` }}>
            <Avatar name={active.name} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ color: W.text, fontWeight: 600, fontSize: 15 }}>{active.name}</div>
              <div style={{ color: W.sub, fontSize: 12 }}>{active.phone || "cliente"}{attachments.length > 0 ? ` · 📎 ${attachments.length} anexo${attachments.length > 1 ? "s" : ""}` : ""}</div>
            </div>
            <div style={{ background: si.bg, border: `1px solid ${si.color}44`, borderRadius: 20, padding: "4px 12px", fontSize: 11.5, fontWeight: 700, color: si.color }}>{si.emoji} {si.label} {score}/100</div>
            <button onClick={() => setShowLead(p => !p)} style={{ background: showLead ? W.active : "none", border: "none", color: W.icon, cursor: "pointer", fontSize: 18, padding: "6px 8px", borderRadius: 6 }}>👤</button>
          </div>

          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", background: W.chatBg, padding: "12px 5%", display: "flex", flexDirection: "column", gap: 1 }}>

                {msgs.length === 0 && (
                  <div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
                    <div style={{ background: "#182229", borderRadius: 10, padding: "10px 18px", maxWidth: 340, textAlign: "center" }}>
                      <div style={{ color: W.sub, fontSize: 12, lineHeight: 1.7 }}>
                        ✨ Cole a mensagem ou envie arquivos do cliente.<br />
                        A Aurora vai sugerir a resposta ideal.
                      </div>
                    </div>
                  </div>
                )}

                {msgs.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 12px" }}>
                    <div style={{ background: "#182229", borderRadius: 10, padding: "4px 14px", color: W.sub, fontSize: 12 }}>{dateLabel()}</div>
                  </div>
                )}

                {msgs.map((msg, i) => {
                  const showAvatar = i === 0 || msgs[i - 1].from !== msg.from;
                  return (
                    <div key={msg.id} onClick={() => msg.type === "image" && setLightbox(msg)}>
                      <MessageBubble msg={msg} showAvatar={showAvatar} clientName={active.name} />
                    </div>
                  );
                })}

                {/* Typing */}
                {loading && (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 2 }}>
                    <Avatar name={active.name} size={28} />
                    <div style={{ background: W.bubbleIn, borderRadius: "2px 8px 8px 8px", padding: "10px 14px", display: "flex", gap: 4, alignItems: "center" }}>
                      {[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: W.sub, animation: `wabounce 1.2s ease-in-out ${i * .2}s infinite` }} />)}
                    </div>
                  </div>
                )}

                {/* Suggestion */}
                {suggestion && !loading && (
                  <div style={{ margin: "10px 0 4px", background: "#0d1f2d", border: `1.5px solid ${W.green}44`, borderRadius: 12, padding: "12px", animation: "fadeUp .2s ease" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                      <Avatar gradient size={24} />
                      <span style={{ color: W.green, fontSize: 11, fontWeight: 700, letterSpacing: .8 }}>SUGESTÃO AURORA</span>
                      <span style={{ marginLeft: "auto", color: "#2a5a4a", fontSize: 10 }}>edite se quiser</span>
                    </div>
                    <textarea value={editedSug} onChange={e => setEditedSug(e.target.value)} rows={3}
                      style={{ width: "100%", background: W.inputBg, border: `1px solid ${W.divider}`, borderRadius: 8, color: W.text, fontSize: 14, padding: "9px 11px", resize: "none", outline: "none", lineHeight: 1.55, fontFamily: "inherit", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                      <button onClick={() => { navigator.clipboard.writeText(editedSug); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                        style={{ flex: 1, background: copied ? "#00a88422" : "#2a3942", color: copied ? W.green : W.sub, border: copied ? `1px solid ${W.green}44` : "none", borderRadius: 8, padding: "8px 0", fontSize: 12.5, cursor: "pointer", fontWeight: 600, transition: "all .2s" }}>
                        {copied ? "✓ Copiado!" : "📋 Copiar"}
                      </button>
                      <button onClick={confirmSend} style={{ flex: 2, background: W.green, color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12.5, cursor: "pointer", fontWeight: 700 }}>
                        ✓ Confirmar no chat
                      </button>
                    </div>
                  </div>
                )}

                {/* Resumo / Send */}
                {msgs.length > 0 && !loading && (
                  <div style={{ margin: "8px 0 4px", display: "flex", gap: 7 }}>
                    <button onClick={() => setShowResumo(p => !p)}
                      style={{ flex: 1, background: "#1a2530", border: `1px solid ${W.divider}`, borderRadius: 8, padding: "8px 0", color: W.sub, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                      {showResumo ? "▲ Fechar" : "📋 Ver resumo"}
                    </button>
                    <button onClick={handleSendResumo} disabled={resumoSending || resumoSent[activeId]}
                      style={{
                        flex: 2, borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: resumoSent[activeId] || resumoSending ? "not-allowed" : "pointer", border: "none", transition: "all .2s",
                        background: resumoSent[activeId] ? "#1a3a2a" : resumoSending ? "#1a2530" : "#005c4b",
                        color: resumoSent[activeId] ? W.green : resumoSending ? W.sub : "#fff",
                      }}>
                      {resumoSent[activeId] ? `✓ Enviado! (${attachments.length > 0 ? `${attachments.length} anexo${attachments.length > 1 ? "s" : ""} + resumo` : "resumo"})` : resumoSending ? "Enviando..." : `📤 Enviar resumo${attachments.length > 0 ? ` + ${attachments.length} anexo${attachments.length > 1 ? "s" : ""}` : ""} ao grupo`}
                    </button>
                  </div>
                )}

                {resumoErr && <div style={{ background: "#2a1010", border: "1px solid #ef444444", borderRadius: 8, padding: "7px 12px", color: "#ef4444", fontSize: 12, marginBottom: 4 }}>⚠️ {resumoErr}</div>}

                {/* Resumo preview */}
                {showResumo && (
                  <div style={{ background: "#0d1a22", border: `1px solid ${W.divider}`, borderRadius: 10, padding: "12px", marginBottom: 6, animation: "fadeUp .2s ease" }}>
                    <div style={{ color: W.sub, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>PREVIEW DO RESUMO</div>
                    <pre style={{ color: W.text, fontSize: 11.5, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontFamily: "inherit" }}>
                      {buildResumo(msgs, leadData, score, attachments)}
                    </pre>
                    {attachments.length > 0 && (
                      <div style={{ marginTop: 12, borderTop: `1px solid ${W.divider}`, paddingTop: 10 }}>
                        <div style={{ color: W.sub, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>ANEXOS QUE SERÃO ENVIADOS</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {attachments.map(a => (
                            <div key={a.id} style={{ background: W.inputBg, borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 7, maxWidth: 180 }}>
                              {a.type === "image"
                                ? <img src={`data:${a.mimeType};base64,${a.base64}`} style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover" }} />
                                : <span style={{ fontSize: 22 }}>{docIcon(a.mimeType)}</span>}
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: W.text, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>{a.fileName}</div>
                                <div style={{ color: W.sub, fontSize: 10 }}>{a.fileSize}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div ref={bottomRef} style={{ height: 4 }} />
              </div>

              {/* Input bar */}
              <div style={{ background: W.inputArea, padding: "8px 14px", display: "flex", alignItems: "flex-end", gap: 10, flexShrink: 0, borderTop: `1px solid ${W.divider}` }}>
                {/* Attach button */}
                <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.mp4,.mp3,.csv" onChange={handleFileUpload} style={{ display: "none" }} />
                <button onClick={() => fileRef.current.click()} title="Anexar arquivo"
                  style={{ background: "none", border: "none", color: W.icon, cursor: "pointer", fontSize: 22, padding: "4px", flexShrink: 0, marginBottom: 4 }}>
                  📎
                </button>
                <div style={{ flex: 1, background: W.inputBg, borderRadius: 24, padding: "9px 14px", display: "flex", alignItems: "flex-end" }}>
                  <textarea value={clientInput} onChange={e => setClientInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Cole a mensagem do cliente..."
                    rows={1}
                    style={{ flex: 1, background: "transparent", border: "none", color: W.text, fontSize: 15, outline: "none", resize: "none", lineHeight: 1.5, fontFamily: "inherit", maxHeight: 120, overflowY: "auto" }} />
                </div>
                <button onClick={handleSend} disabled={!clientInput.trim() || loading}
                  style={{ width: 46, height: 46, borderRadius: "50%", background: clientInput.trim() && !loading ? W.green : "#2a3942", border: "none", cursor: clientInput.trim() && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, color: "#fff", flexShrink: 0, transition: "background .2s", marginBottom: 1 }}>
                  {loading ? "⏳" : "➤"}
                </button>
              </div>
            </div>

            {/* Lead panel */}
            {showLead && (
              <div style={{ width: 260, background: "#111b21", borderLeft: `1px solid ${W.divider}`, padding: "14px 12px", overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ color: W.text, fontWeight: 700, fontSize: 13 }}>📊 Dados do Lead</div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ color: W.sub, fontSize: 11 }}>Lead Score</span>
                    <span style={{ color: si.color, fontSize: 11, fontWeight: 700 }}>{score}/100 {si.emoji}</span>
                  </div>
                  <div style={{ background: "#2a3942", borderRadius: 4, height: 5 }}>
                    <div style={{ width: `${score}%`, height: "100%", background: si.color, borderRadius: 4, transition: "width .5s" }} />
                  </div>
                </div>
                <div style={{ background: "#0d1418", borderRadius: 8, padding: 10 }}>
                  <div style={{ color: W.sub, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>BANT</div>
                  {[["💰 Budget", leadData.orcamento || "—"], ["👤 Authority", leadData.decisor || "—"], ["🎯 Need", leadData.projeto ? "Definido" : "Em descoberta"], ["⏰ Timing", leadData.prazo || "—"]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${W.divider}22` }}>
                      <span style={{ color: W.sub, fontSize: 11 }}>{k}</span>
                      <span style={{ color: W.text, fontSize: 11, maxWidth: 110, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                    </div>
                  ))}
                </div>
                {attachments.length > 0 && (
                  <div style={{ background: "#0d1418", borderRadius: 8, padding: 10 }}>
                    <div style={{ color: W.sub, fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>ANEXOS ({attachments.length})</div>
                    {attachments.map(a => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 0", borderBottom: `1px solid ${W.divider}22` }}>
                        {a.type === "image"
                          ? <img src={`data:${a.mimeType};base64,${a.base64}`} style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }} />
                          : <span style={{ fontSize: 18 }}>{docIcon(a.mimeType)}</span>}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: W.text, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{a.fileName}</div>
                          <div style={{ color: W.sub, fontSize: 10 }}>{a.fileSize}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ color: W.sub, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>EDITAR DADOS</div>
                {[["nome", "Nome"], ["empresa", "Empresa"], ["email", "E-mail"], ["telefone", "Telefone"],
                  ["cidade", "Cidade/UF"], ["produto", "Solução"], ["orcamento", "Orçamento"],
                  ["prazo", "Prazo"], ["tipo", "Locação/Venda"], ["decisor", "Decisor"]].map(([k, label]) => (
                  <div key={k} style={{ marginBottom: 4 }}>
                    <div style={{ color: "#4a6a7a", fontSize: 10, marginBottom: 2 }}>{label}</div>
                    <input value={leadData[k] || ""} onChange={e => updateLead(activeId, { [k]: e.target.value })}
                      style={{ width: "100%", background: W.searchBg, border: "none", borderRadius: 5, padding: "5px 8px", color: W.text, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes wabounce{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-5px);opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2a3942;border-radius:4px}
        textarea::placeholder,input::placeholder{color:#3a5a6a}
      `}</style>
    </div>
  );
}
