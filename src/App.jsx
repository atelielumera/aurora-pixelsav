import React, { useState, useEffect, useRef } from "react";

// ─── CORES ───────────────────────────────────────────────────────────────────
const W = {
  leftBg: "#111b21", leftHdr: "#202c33", chatBg: "#0b141a",
  chatHdr: "#202c33", bubbleIn: "#202c33", bubbleOut: "#005c4b",
  inputBg: "#2a3942", inputArea: "#202c33", green: "#00a884",
  text: "#e9edef", sub: "#8696a0", divider: "#2a3942",
  hover: "#2a3942", active: "#2d3b43", icon: "#aebac1",
};

// ─── CSS GLOBAL ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes pulse { 0%,100%{opacity:.4;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes wabounce { 0%,60%,100%{transform:translateY(0);opacity:.35} 30%{transform:translateY(-5px);opacity:1} }
  @keyframes spin { to{transform:rotate(360deg)} }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #000; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #374045; border-radius: 3px; }
  textarea { resize: none; font-family: inherit; }
  button { cursor: pointer; font-family: inherit; }
  input { font-family: inherit; }
`;

// ─── AURORA SYSTEM PROMPT ─────────────────────────────────────────────────────
const AURORA_SYSTEM = `Você é Aurora, SDR sênior da PixelSAV — especialista em experiências audiovisuais imersivas.

MISSÃO: Analisar a conversa e gerar a MELHOR resposta para enviar ao cliente.

PORTFÓLIO: Projeção Mapeada (cenário/fachada/objetos), Sphere 360°, App Realidade Aumentada, RA Real Time Interativo, Realidade Virtual, Raio-X Interativo, Parede Interativa, Holografia em Palco, Display Holográfico, Programação com Sensores, Instalações Fixas (museus/memoriais), Conteúdo 3D/Motion Graphics, Sala Imersiva, Vídeos DOOH/FOOH.

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

DADOS PRIORITÁRIOS A COLETAR (em ordem):
1. Nome completo e empresa/organização
2. Telefone e e-mail para contato
3. Tipo de projeto: evento temporário OU instalação fixa
4. Solução de interesse (do portfólio acima)
5. Data/período do evento ou prazo de instalação
6. Local (cidade/estado/espaço)
7. Se temporário: período de locação (dias/semanas)
8. Orçamento disponível (mesmo que aproximado)

SE o cliente ainda não respondeu o formulário de coleta enviado automaticamente, foque em obter essas respostas antes de qualquer outra coisa.

REGRAS CRÍTICAS:
- Tom WhatsApp: direto, caloroso, máximo 3 linhas por mensagem
- Nunca mais de 1 pergunta por vez (exceto no formulário inicial automático)
- Nunca inventar preços — usar "a partir de X"
- Nunca sugerir acima da faixa declarada pelo cliente
- Sem orçamento declarado → não sugerir solução específica
- Sempre terminar com pergunta ou próximo passo claro
- Máximo 1 emoji por mensagem
- Tom consultivo, empático, nunca robótico

FLUXO: Coleta de dados → Qualificação (PF/PJ) → Locação ou Venda → Orçamento → Apresentação → Próximo passo

RESPONDA APENAS o texto da mensagem. Sem prefixos. Sem explicações. Texto puro.`;

// ─── MENSAGEM DE COLETA DE DADOS (enviada automaticamente 30s após saudação) ──
const COLETA_MSG = `Para preparar a melhor proposta para você, preciso de algumas informações rápidas 📋

*1.* Seu nome completo e empresa/organização?
*2.* É para um *evento temporário* ou *instalação fixa*?
*3.* Qual solução te interessa? (Projeção Mapeada, RA, Holografia, Sala Imersiva...)
*4.* Data prevista e local do projeto (cidade/estado)?
*5.* Se temporário, qual o período de locação?
*6.* Qual o orçamento disponível (mesmo que aproximado)?
*7.* Telefone e e-mail para contato?

Pode responder no seu tempo, sem pressa! 😊`;

// ─── LEAD SCORE ───────────────────────────────────────────────────────────────
function scoreCalc(ld) {
  let s = 0;
  if (ld.nome) s += 10;
  if (ld.empresa) s += 15;
  if (ld.projeto) s += 20;
  if (ld.evento) s += 20;
  if (ld.prazo) s += 15;
  if (ld.orcamento) s += 15;
  if (ld.intencao) s += 20;
  return Math.min(s, 100);
}

function scoreInfo(s) {
  if (s >= 80) return { label: "QUENTE", color: "#ef4444", bg: "#ef444420", emoji: "🔴" };
  if (s >= 40) return { label: "MORNO", color: "#f97316", bg: "#f9731620", emoji: "🟠" };
  return { label: "FRIO", color: "#60a5fa", bg: "#60a5fa20", emoji: "🔵" };
}

function extractLead(msgs, cur) {
  const clientMsgs = msgs.filter(m => m.from === "cliente");
  const t = clientMsgs.map(m => m.text || "").join("\n");
  const updated = { ...cur };

  // Parsear respostas numeradas do formulário automático
  const lines = t.split(/\n/);
  for (const line of lines) {
    const trim = line.trim();

    // 1. Nome / empresa
    if (/^1[\.\)]\s*/i.test(trim)) {
      const val = trim.replace(/^1[\.\)]\s*/i, "").trim();
      if (val) {
        const parts = val.split(/[\/\-\|]/).map(p => p.trim()).filter(Boolean);
        if (parts[0] && !updated.nome) updated.nome = parts[0];
        if (parts[1] && !updated.empresa) updated.empresa = parts[1];
      }
    }
    // 2. Tipo (temporário ou fixo)
    if (/^2[\.\)]\s*/i.test(trim)) {
      const val = trim.replace(/^2[\.\)]\s*/i, "").trim();
      if (val && !updated.tipo) {
        if (/temporário|temporario|evento|locação|locacao/i.test(val)) updated.tipo = "Evento temporário";
        else if (/fix[ao]|permanente|instalação|instalacao/i.test(val)) updated.tipo = "Instalação fixa";
        else updated.tipo = val;
      }
    }
    // 3. Solução
    if (/^3[\.\)]\s*/i.test(trim)) {
      const val = trim.replace(/^3[\.\)]\s*/i, "").trim();
      if (val && !updated.produto) updated.produto = val;
    }
    // 4. Data / local
    if (/^4[\.\)]\s*/i.test(trim)) {
      const val = trim.replace(/^4[\.\)]\s*/i, "").trim();
      if (val) {
        const parts = val.split(/[\/\-\|,]/).map(p => p.trim()).filter(Boolean);
        if (parts[0] && !updated.prazo) updated.prazo = parts[0];
        if (parts[1] && !updated.cidade) updated.cidade = parts[1];
        else if (!parts[1] && !updated.cidade) updated.cidade = val;
      }
    }
    // 5. Período de locação
    if (/^5[\.\)]\s*/i.test(trim)) {
      const val = trim.replace(/^5[\.\)]\s*/i, "").trim();
      if (val && !updated.periodo) updated.periodo = val;
    }
    // 6. Orçamento
    if (/^6[\.\)]\s*/i.test(trim)) {
      const val = trim.replace(/^6[\.\)]\s*/i, "").trim();
      if (val && !updated.orcamento) updated.orcamento = val;
    }
    // 7. Telefone / e-mail
    if (/^7[\.\)]\s*/i.test(trim)) {
      const val = trim.replace(/^7[\.\)]\s*/i, "").trim();
      const emailM = val.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      if (emailM && !updated.email) updated.email = emailM[0];
      const phoneM = val.match(/\d[\d\s\-\(\)]{7,}/);
      if (phoneM && !updated.telefone) updated.telefone = phoneM[0].trim();
    }
  }

  // Extração livre — complementa o que não veio do formulário
  if (!updated.email) {
    const m = t.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    if (m) updated.email = m[0];
  }
  if (!updated.telefone) {
    const m = t.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)\d{4,5}[-\s]?\d{4}/);
    if (m) updated.telefone = m[0].trim();
  }
  if (!updated.orcamento) {
    const m = t.match(/R\$\s*[\d.,]+(?:\s*(?:mil|k|M|mi))?/i);
    if (m) updated.orcamento = m[0];
  }
  if (!updated.prazo) {
    const m = t.match(/\d{1,2}[\s\/\-](?:de\s+)?(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|\d{1,2})(?:[\s\/\-]\d{2,4})?/i);
    if (m) updated.prazo = m[0];
  }
  if (!updated.tipo) {
    if (/temporário|temporario|locação|locacao/i.test(t)) updated.tipo = "Evento temporário";
    else if (/instalação\s+fixa|permanente|museu|memorial/i.test(t)) updated.tipo = "Instalação fixa";
  }
  if (!updated.produto) {
    const solucoes = ["Projeção Mapeada","Sphere 360","Realidade Aumentada","Realidade Virtual","Raio-X Interativo","Parede Interativa","Holografia","Display Holográfico","Sala Imersiva","PixelDome","DOOH","FOOH","Motion Graphics"];
    for (const s of solucoes) {
      if (new RegExp(s, "i").test(t)) { updated.produto = s; break; }
    }
  }

  // Flags de qualificação
  updated.intencao = /quanto custa|orçamento|valor|preço|quero|preciso|interesse/i.test(t);
  updated.evento = /evento|show|formatura|festa|lançamento|feira|congresso|temporário|temporario/i.test(t);
  updated.projeto = /projeto|instalação|instalacao|museu|memorial|corporativo|fachada|mapping|fixa|permanente/i.test(t);

  return updated;
}

// ─── AVATAR COLOR ─────────────────────────────────────────────────────────────
function avatarColor(name) {
  const colors = ["#6b7280","#8b5cf6","#ec4899","#f97316","#10b981","#3b82f6","#ef4444","#14b8a6","#f59e0b","#6366f1"];
  let h = 0;
  for (let i = 0; i < (name || "?").length; i++) h = (h * 31 + (name || "?").charCodeAt(i)) % colors.length;
  return colors[Math.abs(h)];
}

// ─── TIME HELPER ─────────────────────────────────────────────────────────────
function ts() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}

function formatDateSep(timestamp) {
  const d = timestamp ? new Date(timestamp * 1000) : new Date();
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

// ─── GEMINI ───────────────────────────────────────────────────────────────────
async function callGemini(apiKey, msgs) {
  const filtered = msgs.filter(m => m.type === "text" || !m.type);
  const contents = [];
  for (const m of filtered) {
    const role = m.from === "cliente" ? "user" : "model";
    const text = m.from === "cliente" ? `CLIENTE: ${m.text}` : `AURORA: ${m.text}`;
    if (contents.length && contents[contents.length - 1].role === role) {
      contents.push({ role: role === "user" ? "model" : "user", parts: [{ text: "..." }] });
    }
    contents.push({ role, parts: [{ text }] });
  }
  if (!contents.length || contents[0].role !== "user") {
    contents.unshift({ role: "user", parts: [{ text: "início da conversa" }] });
  }
  const r = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, contents, system: AURORA_SYSTEM })
  });
  const d = await r.json();
  if (d.error) throw new Error(typeof d.error === "string" ? d.error : (d.error?.message || d.error?.status || JSON.stringify(d.error)));
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini não retornou texto. Verifique a API Key em ⚙️");
  return text;
}

// ─── TIMER GLOBAL (fora do componente) ───────────────────────────────────────
let _timerGlobal = null;
let _cdownGlobal = null;
let _onSuggest = null;
let _onCountdown = null;
let _onLoading = null;
let _getConvos = null;
let _getCfg = null;
let _getActiveId = null;

function dispararTimerGlobal(waJid, convoId) {
  if (_timerGlobal) clearTimeout(_timerGlobal);
  if (_cdownGlobal) clearInterval(_cdownGlobal);

  const cfg = _getCfg ? _getCfg() : {};

  if (waJid && cfg.evoUrl && cfg.evoKey && cfg.instance) {
    fetch(`/api/evo?${new URLSearchParams({ evoUrl: cfg.evoUrl, evoKey: cfg.evoKey, path: `chat/presence/${cfg.instance}` })}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: waJid, options: { presence: "composing", delay: 30000 } })
    }).catch(() => {});
  }

  let seg = 30;
  if (_onCountdown) _onCountdown(seg);
  _cdownGlobal = setInterval(() => {
    seg -= 1;
    if (_onCountdown) _onCountdown(seg > 0 ? seg : null);
    if (seg <= 0) clearInterval(_cdownGlobal);
  }, 1000);

  _timerGlobal = setTimeout(() => {
    clearInterval(_cdownGlobal);
    if (_onCountdown) _onCountdown(null);
    const currentCfg = _getCfg ? _getCfg() : {};
    if (!currentCfg.geminiKey) return;
    const convos = _getConvos ? _getConvos() : [];
    const convo = convos.find(c => c.id === convoId || c.waJid === waJid);
    if (!convo) return;
    const msgs = convo.messages || [];
    const ultima = msgs[msgs.length - 1];
    if (!ultima || ultima.from !== "cliente") return;
    if (_onLoading) _onLoading(true);
    callGemini(currentCfg.geminiKey, msgs).then(sug => {
      if (_onLoading) _onLoading(false);
      // Só mostra sugestão se o usuário ainda está na mesma conversa
      const activeId = _getActiveId ? _getActiveId() : null;
      if (_onSuggest) _onSuggest(sug, convo.id, activeId);
    }).catch(() => { if (_onLoading) _onLoading(false); });
  }, 30000);
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function App() {
  const [cfg, setCfg] = useState({ geminiKey: "", evoUrl: "", instance: "", evoKey: "", groupId: "" });
  const [showCfg, setShowCfg] = useState(false);
  const [showWA, setShowWA] = useState(false);

  const [convos, setConvos] = useState([
    { id: 1, name: "Cliente Exemplo", phone: "41 99999-0001", lastMsg: "Oi, vi vocês no Instagram!", time: "09:14", unread: 1, messages: [], leadData: {}, attachments: [], paused: false, waJid: null }
  ]);
  const [activeId, setActiveId] = useState(1);
  const [searchQ, setSearchQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const [suggestion, setSuggestion] = useState(null);
  const [editedSug, setEditedSug] = useState("");
  const [countdown, setCountdown] = useState(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);

  const [resumoSent, setResumoSent] = useState({});
  const [resumoSending, setResumoSending] = useState(false);
  const [resumoErr, setResumoErr] = useState("");
  const [showResumo, setShowResumo] = useState(false);
  const [sugError, setSugError] = useState("");

  const [showLead, setShowLead] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [waError, setWaError] = useState("");
  const [webhookStatus, setWebhookStatus] = useState("ok"); // ok | error

  // WA panel state
  const [waState, setWaState] = useState("form"); // form | loading | qr | connected
  const [waInstanceInput, setWaInstanceInput] = useState("");
  const [waQr, setWaQr] = useState("");
  const [waConnectedName, setWaConnectedName] = useState("");
  const waPollingQrRef = useRef(null);
  const coletaTimerRef = useRef({});

  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const waPollingRef = useRef(null);
  const seenIds = useRef(new Set());
  const saudacaoEnviada = useRef(new Set());
  const lastProcessedId = useRef(null);
  const convosRef = useRef(convos);
  const cfgRef = useRef(cfg);
  const activeIdRef = useRef(activeId);

  useEffect(() => { convosRef.current = convos; }, [convos]);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  useEffect(() => {
    _onSuggest = (sug, targetConvoId, activeIdAtFire) => {
      // Só mostra se o usuário ainda está na conversa que gerou a sugestão
      if (activeIdAtFire !== targetConvoId) return;
      setSuggestion(sug); setEditedSug(sug);
    };
    _onCountdown = (val) => setCountdown(val);
    _onLoading = (val) => setLoading(val);
    _getConvos = () => convosRef.current;
    _getCfg = () => cfgRef.current;
    _getActiveId = () => activeIdRef.current;
    return () => { _onSuggest = null; _onCountdown = null; _onLoading = null; _getConvos = null; _getCfg = null; _getActiveId = null; };
  }, []);

  useEffect(() => {
    try {
      const s = localStorage.getItem("aurora_cfg");
      if (s) {
        const saved = JSON.parse(s);
        setCfg(saved);
        if (saved.instance) setWaInstanceInput(saved.instance);
      }
    } catch {}
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convos, activeId, suggestion, loading]);

  const active = convos.find(c => c.id === activeId);
  const msgs = active?.messages || [];
  const leadData = active?.leadData || {};
  const attachments = active?.attachments || [];
  const score = scoreCalc(leadData);
  const si = scoreInfo(score);

  function updateConvo(id, patch) { setConvos(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c)); }
  function updateLead(id, patch) { setConvos(cs => cs.map(c => c.id === id ? { ...c, leadData: { ...c.leadData, ...patch } } : c)); }
  function saveCfg() { try { localStorage.setItem("aurora_cfg", JSON.stringify(cfg)); } catch {} setShowCfg(false); }

  // ── Webhook polling ────────────────────────────────────────────────────────
  useEffect(() => {
    let lastTs = Date.now() - 30000;
    const SAUDACAO = "Olá! Seja bem-vindo(a) ao atendimento da PixelSAV! 😊 Sou a Aurora, sua consultora de experiências imersivas. Como posso te ajudar hoje?";

    const poll = async () => {
      try {
        const r = await fetch(`/api/webhook?since=${lastTs}`);
        if (!r.ok) { setWebhookStatus("error"); return; }
        setWebhookStatus("ok");
        const data = await r.json();
        if (!data.messages?.length) { lastTs = data.ts || Date.now(); return; }
        lastTs = data.ts || Date.now();

        for (const m of data.messages) {
          const msgId = m.id;
          if (!msgId || seenIds.current.has(msgId)) continue;
          seenIds.current.add(msgId);

          const from = m.remoteJid || "";
          const name = m.pushName || from.replace("@s.whatsapp.net", "");
          const phone = from.replace("@s.whatsapp.net", "").replace("@g.us", "");
          const type = m.type || "text";
          const text = m.text || "[mídia]";
          const msgTime = m.timestamp ? new Date(m.timestamp * 1000) : new Date();
          const timeStr = `${String(msgTime.getHours()).padStart(2,"0")}:${String(msgTime.getMinutes()).padStart(2,"0")}`;
          const novaMsg = { from: "cliente", text, time: timeStr, id: Date.now() + Math.random(), type, waId: msgId };

          const existingConvo = convosRef.current.find(c => c.waJid === from || c.phone === phone);
          const novoId = Date.now() + Math.random();
          const targetConvoId = existingConvo ? existingConvo.id : novoId;

          if (lastProcessedId.current === msgId) continue;
          lastProcessedId.current = msgId;

          // Disparar side-effects FORA do setConvos (que deve ser pura)
          const isNewContact = !existingConvo;
          const currentCfg = cfgRef.current;
          if (isNewContact && !saudacaoEnviada.current.has(from) && currentCfg.evoUrl && currentCfg.evoKey && currentCfg.instance) {
            saudacaoEnviada.current.add(from);
            // 1ª mensagem: saudação imediata
            fetch(`/api/evo?${new URLSearchParams({ evoUrl: currentCfg.evoUrl, evoKey: currentCfg.evoKey, path: `message/sendText/${currentCfg.instance}` })}`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ number: from, text: SAUDACAO })
            }).catch(() => {});
            // 2ª mensagem: formulário de coleta após 30s
            if (!coletaTimerRef.current[from]) {
              coletaTimerRef.current[from] = setTimeout(() => {
                delete coletaTimerRef.current[from];
                const cfg2 = cfgRef.current;
                if (!cfg2.evoUrl || !cfg2.evoKey || !cfg2.instance) return;
                const now = new Date();
                const tStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
                const msgColeta = { from: "aurora", text: COLETA_MSG, time: tStr, id: Date.now() + Math.random(), type: "text" };
                setConvos(cs2 => cs2.map(c => c.waJid === from ? {
                  ...c, messages: [...c.messages, msgColeta], lastMsg: "📋 Formulário de coleta enviado", time: tStr,
                } : c));
                fetch(`/api/evo?${new URLSearchParams({ evoUrl: cfg2.evoUrl, evoKey: cfg2.evoKey, path: `message/sendText/${cfg2.instance}` })}`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ number: from, text: COLETA_MSG })
                }).catch(() => {});
              }, 30000);
            }
          }

          const SAUDACAO_MSG = { from: "aurora", text: SAUDACAO, time: timeStr, id: Date.now() + Math.random(), type: "text" };
          setConvos(cs => {
            const existing = cs.find(c => c.waJid === from || c.phone === phone);
            if (existing) {
              if (existing.messages.some(em => em.waId === msgId)) return cs;
              return cs.map(c => c.id === existing.id ? {
                ...c,
                messages: [...c.messages, novaMsg],
                lastMsg: text.slice(0, 40), time: timeStr,
                unread: activeIdRef.current === c.id ? 0 : (c.unread || 0) + 1,
                leadData: extractLead([...c.messages, novaMsg], c.leadData),
              } : c);
            } else {
              const initialLead = extractLead([novaMsg], { nome: name !== phone ? name : "" });
              setActiveId(novoId);
              return [{ id: novoId, name, phone, waJid: from, lastMsg: text.slice(0, 40), time: timeStr, unread: 0, messages: [SAUDACAO_MSG, novaMsg], leadData: initialLead, attachments: [], paused: false }, ...cs];
            }
          });

          setTimeout(() => {
            const convo = convosRef.current.find(c => c.id === targetConvoId || c.waJid === from);
            if (!convo || convo.paused) return;
            setActiveId(convo.id);
            dispararTimerGlobal(from, convo.id);
          }, 200);
        }
      } catch {}
    };

    poll();
    waPollingRef.current = setInterval(poll, 3000);
    return () => clearInterval(waPollingRef.current);
  }, []);

  // ── Enviar resposta ────────────────────────────────────────────────────────
  async function confirmSend() {
    if (!editedSug.trim() || !active) return;
    setSending(true);
    const text = editedSug.trim();
    const msg = { from: "aurora", text, time: ts(), id: Date.now(), type: "text" };
    updateConvo(activeId, { messages: [...msgs, msg], lastMsg: text.slice(0, 40), time: ts() });
    setSuggestion(null); setEditedSug("");
    if (cfg.evoUrl && cfg.evoKey && cfg.instance && active.waJid) {
      try {
        await fetch(`/api/evo?${new URLSearchParams({ evoUrl: cfg.evoUrl, evoKey: cfg.evoKey, path: `message/sendText/${cfg.instance}` })}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ number: active.waJid, text })
        });
      } catch (e) { console.warn("Falha ao enviar:", e); }
    }
    setSending(false);
  }

  // ── Copiar sugestão ────────────────────────────────────────────────────────
  function copySuggestion() {
    navigator.clipboard.writeText(editedSug).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Gerar sugestão manual ──────────────────────────────────────────────────
  async function generateManual() {
    if (!cfg.geminiKey || !active) return;
    const ultima = msgs[msgs.length - 1];
    if (!ultima || ultima.from !== "cliente") return;
    // Cancelar timer global se estiver rodando
    if (_timerGlobal) { clearTimeout(_timerGlobal); _timerGlobal = null; }
    if (_cdownGlobal) { clearInterval(_cdownGlobal); _cdownGlobal = null; }
    setCountdown(null);
    setLoading(true);
    setSugError("");
    try {
      const sug = await callGemini(cfg.geminiKey, msgs);
      if (!sug) throw new Error("Gemini retornou resposta vazia. Verifique a Gemini API Key em ⚙️");
      setSuggestion(sug);
      setEditedSug(sug);
    } catch (e) {
      setSugError(e.message || "Erro ao conectar com Gemini. Verifique a API Key em ⚙️");
    } finally {
      setLoading(false);
    }
  }

  // ── Resumo ─────────────────────────────────────────────────────────────────
  async function handleSendResumo() {
    setResumoSending(true); setResumoErr("");
    try {
      if (!cfg.evoUrl || !cfg.instance || !cfg.groupId) throw new Error("Configure Evolution API em ⚙️");

      const historico = msgs.filter(m => m.type === "text" || !m.type)
        .map(m => `[${m.from === "cliente" ? "Cliente" : "Aurora"}]: ${m.text || ""}`).join("\n");

      let resumoIA = "";
      if (cfg.geminiKey && historico) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cfg.geminiKey}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: "Gere um resumo executivo comercial em português. Inclua: o que o cliente quer, dados coletados, próximos passos sugeridos. Máximo 8 linhas, sem markdown." }] },
            contents: [{ role: "user", parts: [{ text: `Resumo desta conversa:\n${historico}` }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 400 }
          })
        });
        const d = await r.json();
        resumoIA = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      }

      const siR = scoreInfo(score);
      const hasAttach = attachments.length > 0;
      const resumoTexto = [
        `🎯 *RESUMO DO ATENDIMENTO — PixelSAV*`, ``,
        `${siR.emoji} *Status:* ${siR.label} (${score}/100)`, ``,
        `*📋 DADOS DO CLIENTE*`,
        leadData.nome ? `• Nome: ${leadData.nome}` : null,
        leadData.empresa ? `• Empresa: ${leadData.empresa}` : null,
        leadData.email ? `• E-mail: ${leadData.email}` : null,
        leadData.telefone ? `• Tel: ${leadData.telefone}` : null,
        leadData.cidade ? `• Cidade: ${leadData.cidade}` : null,
        leadData.produto ? `• Solução: ${leadData.produto}` : null,
        leadData.orcamento ? `• Orçamento: ${leadData.orcamento}` : null,
        leadData.prazo ? `• Prazo: ${leadData.prazo}` : null, ``,
        resumoIA ? `*📝 RESUMO DA CONVERSA*` : null,
        resumoIA || null,
        hasAttach ? `` : null,
        hasAttach ? `*📂 ARQUIVOS ENVIADOS PELO CLIENTE (${attachments.length})*` : null,
        ...(hasAttach ? attachments.map(a => `• ${a.type === "image" ? "🖼" : "📎"} ${a.fileName}`) : []),
        ``, `_Gerado por Aurora · PixelSAV_`
      ].filter(x => x !== null).join("\n");

      await fetch(`/api/evo?${new URLSearchParams({ evoUrl: cfg.evoUrl, evoKey: cfg.evoKey, path: `message/sendText/${cfg.instance}` })}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: cfg.groupId, text: resumoTexto })
      });

      for (const att of attachments) {
        try {
          await fetch(`/api/evo?${new URLSearchParams({ evoUrl: cfg.evoUrl, evoKey: cfg.evoKey, path: `message/sendMedia/${cfg.instance}` })}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              number: cfg.groupId,
              mediatype: att.type === "image" ? "image" : "document",
              mimetype: att.mimeType,
              media: att.base64,
              fileName: att.fileName,
              caption: `📎 Arquivo do cliente: ${att.fileName}`
            })
          });
        } catch {}
      }

      setResumoSent(r => ({ ...r, [activeId]: true }));
    } catch (e) { setResumoErr(e.message); }
    setResumoSending(false);
  }

  // ── File attach ────────────────────────────────────────────────────────────
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file || !active) return;
    const targetId = activeId;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(",")[1];
      const attType = file.type.startsWith("image/") ? "image" : "doc";
      const att = {
        id: Date.now(),
        fileName: file.name,
        mimeType: file.type,
        base64,
        type: attType,
        size: file.size,
        url: ev.target.result,
      };
      const msg = {
        from: "cliente", type: attType,
        text: attType === "image" ? `🖼 ${file.name}` : `📎 ${file.name}`,
        time: ts(), id: Date.now() + Math.random(),
        url: ev.target.result, fileName: file.name, size: file.size,
      };
      // Usar setConvos funcional para evitar msgs/attachments stale
      setConvos(cs => cs.map(c => c.id === targetId ? {
        ...c,
        attachments: [...(c.attachments || []), att],
        messages: [...c.messages, msg],
        lastMsg: msg.text.slice(0, 40),
        time: ts(),
      } : c));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ── WA Panel ───────────────────────────────────────────────────────────────
  function extractQrFromResponse(d) {
    // Evolution API v2: { qrcode: { base64, code } }
    // Evolution API v1: { base64 } or { code }
    return d?.qrcode?.base64 || d?.qrcode?.code || d?.base64 || d?.code || "";
  }

  function isConnected(d) {
    return d?.instance?.state === "open" ||
      d?.instance?.connectionStatus === "open" ||
      d?.state === "open" ||
      d?.connectionStatus === "open";
  }

  async function createInstance() {
    if (!waInstanceInput.trim() || !cfg.evoUrl || !cfg.evoKey) return;
    setWaState("loading");
    setWaError("");
    const instanceName = waInstanceInput.trim();
    const newCfg = { ...cfg, instance: instanceName };
    setCfg(newCfg);
    cfgRef.current = newCfg;
    try { localStorage.setItem("aurora_cfg", JSON.stringify(newCfg)); } catch {}
    try {
      const res = await fetch(`/api/evo?${new URLSearchParams({ evoUrl: newCfg.evoUrl, evoKey: newCfg.evoKey, path: `instance/create` })}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" })
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) {
        throw new Error(d.message || d.error || d.response?.message || `Erro ${res.status}`);
      }
      // v2 retorna o QR direto no create — usar se disponível
      const qrDireto = extractQrFromResponse(d);
      if (qrDireto) { setWaQr(qrDireto); setWaState("qr"); return; }
      if (isConnected(d)) { setWaConnectedName(instanceName); setWaState("connected"); return; }
      // Sem QR na resposta — aguardar 1.5s e buscar
      await new Promise(r => setTimeout(r, 1500));
      await refreshQrFor(instanceName, newCfg);
    } catch (e) { setWaError(e.message); setWaState("form"); }
  }

  async function refreshQr() {
    await refreshQrFor(cfg.instance, cfg);
  }

  async function refreshQrFor(instanceName, currentCfg) {
    if (!currentCfg.evoUrl || !currentCfg.evoKey || !instanceName) { setWaState("form"); return; }
    try {
      // Primeiro verificar se já está conectado
      const stateRes = await fetch(`/api/evo?${new URLSearchParams({ evoUrl: currentCfg.evoUrl, evoKey: currentCfg.evoKey, path: `instance/connectionState/${instanceName}` })}`);
      const stateD = await stateRes.json().catch(() => ({}));
      if (isConnected(stateD)) { setWaConnectedName(instanceName); setWaState("connected"); return; }

      // Buscar QR
      const r = await fetch(`/api/evo?${new URLSearchParams({ evoUrl: currentCfg.evoUrl, evoKey: currentCfg.evoKey, path: `instance/connect/${instanceName}` })}`);
      const d = await r.json().catch(() => ({}));
      if (isConnected(d)) { setWaConnectedName(instanceName); setWaState("connected"); return; }
      const qr = extractQrFromResponse(d);
      if (qr) { setWaQr(qr); setWaState("qr"); }
      else { setWaQr(""); setWaState("qr"); }
    } catch { setWaState("form"); }
  }

  useEffect(() => {
    if (!showWA || waState !== "qr") { clearInterval(waPollingQrRef.current); return; }
    const instanceName = cfg.instance;
    const poll = async () => {
      try {
        const r = await fetch(`/api/evo?${new URLSearchParams({ evoUrl: cfg.evoUrl, evoKey: cfg.evoKey, path: `instance/connectionState/${instanceName}` })}`);
        const d = await r.json().catch(() => ({}));
        if (isConnected(d)) { setWaConnectedName(instanceName); setWaState("connected"); clearInterval(waPollingQrRef.current); }
      } catch {}
    };
    waPollingQrRef.current = setInterval(poll, 4000);
    return () => clearInterval(waPollingQrRef.current);
  }, [showWA, waState, cfg]);

  async function disconnectWA() {
    try {
      await fetch(`/api/evo?${new URLSearchParams({ evoUrl: cfg.evoUrl, evoKey: cfg.evoKey, path: `instance/logout/${cfg.instance}` })}`, { method: "DELETE" });
    } catch {}
    setWaState("form");
  }

  // ── Filtered convos ────────────────────────────────────────────────────────
  const filteredConvos = convos.filter(c =>
    !searchQ || c.name.toLowerCase().includes(searchQ.toLowerCase()) || c.phone?.includes(searchQ)
  );

  // ── Nova conversa ──────────────────────────────────────────────────────────
  function addConvo() {
    if (!newName.trim()) return;
    const id = Date.now();
    setConvos(cs => [{ id, name: newName.trim(), phone: "", waJid: null, lastMsg: "", time: ts(), unread: 0, messages: [], leadData: {}, attachments: [], paused: false }, ...cs]);
    setActiveId(id);
    setNewName(""); setShowNew(false);
  }

  // ── Resumo preview text ────────────────────────────────────────────────────
  function resumoPreview() {
    const siR = scoreInfo(score);
    return [
      `🎯 RESUMO DO ATENDIMENTO — PixelSAV`,
      `${siR.emoji} Status: ${siR.label} (${score}/100)`,
      leadData.nome ? `👤 ${leadData.nome}${leadData.empresa ? ` · ${leadData.empresa}` : ""}` : null,
      leadData.produto ? `📦 ${leadData.produto}` : null,
      leadData.orcamento ? `💰 ${leadData.orcamento}` : null,
      leadData.prazo ? `📅 ${leadData.prazo}` : null,
    ].filter(Boolean).join("\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <img src={lightbox} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 }} />
          <button onClick={() => setLightbox(null)} style={{
            position: "absolute", top: 20, right: 20, background: "none", border: "none",
            color: "#fff", fontSize: 28, cursor: "pointer"
          }}>✕</button>
        </div>
      )}

      {/* WA Modal */}
      {showWA && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#202c33", borderRadius: 16, width: 400, padding: 32, position: "relative" }}>
            <button onClick={() => { setShowWA(false); setWaError(""); }} style={{ position: "absolute", top: 12, right: 16, background: "none", border: "none", color: W.sub, fontSize: 20, cursor: "pointer" }}>✕</button>
            <div style={{ fontWeight: 700, color: W.text, fontSize: 18, marginBottom: 20 }}>📱 WhatsApp</div>

            {waState === "form" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(!cfg.evoUrl || !cfg.evoKey) && (
                  <div style={{ background: "#ef444415", border: "1px solid #ef444440", borderRadius: 8, padding: "10px 12px", color: "#ef4444", fontSize: 13 }}>
                    ⚠️ Preencha Evolution URL e API Key em ⚙️ primeiro.
                  </div>
                )}
                {waError && (
                  <div style={{ background: "#ef444415", border: "1px solid #ef444440", borderRadius: 8, padding: "10px 12px", color: "#ef4444", fontSize: 13 }}>
                    ❌ {waError}
                  </div>
                )}
                <input value={waInstanceInput} onChange={e => setWaInstanceInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createInstance()}
                  placeholder="Nome da instância (ex: pixelsav-comercial)"
                  style={{ background: W.inputBg, border: "none", borderRadius: 8, padding: "10px 14px", color: W.text, fontSize: 14, outline: "none" }} />
                <button onClick={createInstance} disabled={!cfg.evoUrl || !cfg.evoKey || !waInstanceInput.trim()}
                  style={{ background: W.green, border: "none", borderRadius: 8, padding: "11px 0", color: "#fff", fontWeight: 700, fontSize: 14, opacity: (!cfg.evoUrl || !cfg.evoKey || !waInstanceInput.trim()) ? .5 : 1 }}>
                  Criar e gerar QR Code
                </button>
                {cfg.instance && (
                  <button onClick={refreshQr}
                    style={{ background: W.inputBg, border: "none", borderRadius: 8, padding: "10px 0", color: W.text, fontSize: 13 }}>
                    Verificar instância: {cfg.instance}
                  </button>
                )}
              </div>
            )}

            {waState === "loading" && (
              <div style={{ textAlign: "center", color: W.sub, padding: "30px 0" }}>
                <div style={{ fontSize: 28, marginBottom: 12, animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</div>
                <div>Criando instância...</div>
              </div>
            )}

            {waState === "qr" && (
              <div style={{ textAlign: "center" }}>
                {waQr ? (
                  <div style={{ background: "#fff", display: "inline-block", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                    <img src={waQr.startsWith("data:") ? waQr : `data:image/png;base64,${waQr}`} alt="QR Code" style={{ width: 230, height: 230, display: "block" }} />
                  </div>
                ) : (
                  <div style={{ color: W.sub, marginBottom: 16 }}>Aguardando QR Code...</div>
                )}
                <div style={{ color: W.sub, fontSize: 13, marginBottom: 16 }}>Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo</div>
                <button onClick={refreshQr} style={{ background: W.inputBg, border: "none", borderRadius: 8, padding: "10px 20px", color: W.text, fontSize: 13, cursor: "pointer" }}>🔄 Atualizar</button>
              </div>
            )}

            {waState === "connected" && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ color: W.green, fontWeight: 700, fontSize: 18, marginBottom: 8 }}>WhatsApp Conectado!</div>
                <div style={{ color: W.sub, fontSize: 14, marginBottom: 24 }}>{waConnectedName}</div>
                <button onClick={disconnectWA} style={{ background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 24px", color: "#ef4444", fontSize: 13, cursor: "pointer" }}>Desconectar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* App layout */}
      <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#000", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

        {/* ── COLUNA ESQUERDA ─────────────────────────────────────────────── */}
        <div style={{ width: 360, minWidth: 360, display: "flex", flexDirection: "column", background: W.leftBg, borderRight: `1px solid ${W.divider}` }}>

          {/* Header esquerdo */}
          <div style={{ height: 60, background: W.leftHdr, display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#00a884,#005c4b)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0
            }}>A</div>
            <div style={{ flex: 1, color: W.text, fontWeight: 600, fontSize: 15 }}>
              Aurora · PixelSAV
              <span style={{ marginLeft: 6, fontSize: 9, color: webhookStatus === "ok" ? W.green : "#ef4444" }}>
                {webhookStatus === "ok" ? "● online" : "● erro"}
              </span>
            </div>
            <button onClick={() => { setShowNew(v => !v); setShowCfg(false); }} title="Nova conversa"
              style={{ background: "none", border: "none", color: W.icon, fontSize: 18, padding: "4px 6px", borderRadius: 6 }}>✎</button>
            <button onClick={() => { setShowWA(true); setShowCfg(false); }} title="WhatsApp"
              style={{ background: "none", border: "none", color: W.icon, fontSize: 18, padding: "4px 6px", borderRadius: 6 }}>📱</button>
            <button onClick={() => { setShowCfg(v => !v); setShowNew(false); }} title="Configurações"
              style={{ background: "none", border: "none", color: showCfg ? W.green : W.icon, fontSize: 18, padding: "4px 6px", borderRadius: 6 }}>⚙</button>
          </div>

          {/* Painel configurações */}
          {showCfg && (
            <div style={{ background: "#1a2730", padding: 14, borderBottom: `1px solid ${W.divider}`, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Gemini API Key", "geminiKey", "AIza..."],
                ["Evolution URL", "evoUrl", "https://api.evolution..."],
                ["Instância", "instance", "pixelsav-comercial"],
                ["API Key Evolution", "evoKey", "chave..."],
                ["ID Grupo WA", "groupId", "5541999...@g.us"],
              ].map(([label, key, ph]) => (
                <div key={key}>
                  <div style={{ color: W.sub, fontSize: 11, marginBottom: 3 }}>{label}</div>
                  <input
                    value={cfg[key]}
                    onChange={e => setCfg(c => ({ ...c, [key]: e.target.value }))}
                    placeholder={ph}
                    type={key.toLowerCase().includes("key") ? "password" : "text"}
                    style={{ width: "100%", background: W.inputBg, border: "none", borderRadius: 6, padding: "7px 10px", color: W.text, fontSize: 12, outline: "none" }}
                  />
                </div>
              ))}
              <button onClick={saveCfg}
                style={{ background: W.green, border: "none", borderRadius: 6, padding: "8px 0", color: "#fff", fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                ✓ Salvar
              </button>
            </div>
          )}

          {/* Nova conversa */}
          {showNew && (
            <div style={{ background: "#1a2730", padding: 12, borderBottom: `1px solid ${W.divider}`, display: "flex", gap: 8 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addConvo()}
                placeholder="Nome do contato..." autoFocus
                style={{ flex: 1, background: W.inputBg, border: "none", borderRadius: 6, padding: "8px 10px", color: W.text, fontSize: 13, outline: "none" }} />
              <button onClick={addConvo}
                style={{ background: W.green, border: "none", borderRadius: 6, padding: "8px 14px", color: "#fff", fontWeight: 700, fontSize: 16 }}>+</button>
            </div>
          )}

          {/* Busca */}
          <div style={{ padding: "8px 12px", background: W.leftBg, flexShrink: 0 }}>
            <div style={{ background: W.inputBg, borderRadius: 8, display: "flex", alignItems: "center", padding: "0 10px", gap: 8 }}>
              <span style={{ color: W.sub, fontSize: 14 }}>🔍</span>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Pesquisar ou começar conversa"
                style={{ flex: 1, background: "none", border: "none", color: W.text, fontSize: 14, padding: "8px 0", outline: "none" }} />
            </div>
          </div>

          {/* Lista de conversas */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredConvos.map(c => {
              const sc = scoreCalc(c.leadData || {});
              const sci = scoreInfo(sc);
              const isActive = c.id === activeId;
              return (
                <div key={c.id}
                  onClick={() => { setActiveId(c.id); updateConvo(c.id, { unread: 0 }); setSuggestion(null); setEditedSug(""); setCountdown(null); setShowResumo(false); setSugError(""); }}
                  style={{
                    display: "flex", alignItems: "center", padding: "12px 16px", gap: 12,
                    background: isActive ? W.active : "transparent", cursor: "pointer",
                    borderBottom: `1px solid ${W.divider}20`,
                    transition: "background .15s",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = W.hover; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{
                      width: 49, height: 49, borderRadius: "50%", background: avatarColor(c.name),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 700, fontSize: 20
                    }}>{(c.name || "?")[0].toUpperCase()}</div>
                    {c.unread > 0 && (
                      <div style={{
                        position: "absolute", top: -2, right: -2,
                        background: W.green, borderRadius: "50%",
                        width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 11, fontWeight: 700
                      }}>{c.unread > 9 ? "9+" : c.unread}</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <span style={{ color: W.text, fontWeight: 500, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                      <span style={{ color: W.sub, fontSize: 11, flexShrink: 0, marginLeft: 8 }}>{c.time}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ color: W.sub, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{c.lastMsg || "Sem mensagens"}</span>
                      <span style={{ fontSize: 10, background: sci.bg, color: sci.color, borderRadius: 10, padding: "1px 6px", flexShrink: 0 }}>{sci.emoji}</span>
                      {c.paused && <span style={{ fontSize: 10, background: "#ef444420", color: "#ef4444", borderRadius: 10, padding: "1px 6px", flexShrink: 0 }}>⏸</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── COLUNA DIREITA ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: W.chatBg, position: "relative" }}>

          {active ? (
            <>
              {/* Chat header */}
              <div style={{ height: 60, background: W.chatHdr, display: "flex", alignItems: "center", padding: "0 16px", gap: 12, flexShrink: 0, borderBottom: `1px solid ${W.divider}20` }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", background: avatarColor(active.name),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: 17, flexShrink: 0
                }}>{(active.name || "?")[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: W.text, fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{active.name}</div>
                  <div style={{ color: W.sub, fontSize: 12 }}>{active.waJid ? active.waJid.replace("@s.whatsapp.net", "") : active.phone || "sem número"}</div>
                </div>
                <div style={{ background: si.bg, borderRadius: 20, padding: "4px 10px", fontSize: 12, color: si.color, fontWeight: 600, flexShrink: 0 }}>
                  {si.emoji} {si.label} {score}/100
                </div>
                <button
                  onClick={() => updateConvo(activeId, { paused: !active.paused })}
                  style={{
                    background: active.paused ? "#ef444415" : "none",
                    border: active.paused ? "1px solid #ef4444" : "none",
                    borderRadius: 6, padding: "6px 10px",
                    color: active.paused ? "#ef4444" : W.icon, fontSize: 14, flexShrink: 0
                  }}>
                  {active.paused ? "⏸ Pausado" : "⏸"}
                </button>
                <button
                  onClick={() => setShowLead(v => !v)}
                  style={{ background: showLead ? W.active : "none", border: "none", borderRadius: 6, padding: "6px 10px", color: showLead ? W.green : W.icon, fontSize: 16, flexShrink: 0 }}>
                  👤
                </button>
              </div>

              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* Mensagens */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column" }}>

                  {msgs.length === 0 && (
                    <div style={{ textAlign: "center", color: W.sub, marginTop: 60, fontSize: 14 }}>
                      Nenhuma mensagem ainda.<br />Mensagens chegam automaticamente do WhatsApp.
                    </div>
                  )}

                  {msgs.map((m, i) => {
                    const isCliente = m.from === "cliente";
                    const prev = msgs[i - 1];
                    const showAvatar = !prev || prev.from !== m.from;
                    const showDate = !prev || Math.floor((m.id || 0) / 86400000) !== Math.floor(((prev.id || 0)) / 86400000);

                    return (
                      <React.Fragment key={m.id || i}>
                        {showDate && i > 0 && (
                          <div style={{ textAlign: "center", margin: "12px 0" }}>
                            <span style={{ background: "#1f2d35", color: W.sub, fontSize: 12, borderRadius: 8, padding: "4px 12px" }}>
                              {formatDateSep(m.timestamp)}
                            </span>
                          </div>
                        )}
                        <div style={{
                          display: "flex", flexDirection: isCliente ? "row" : "row-reverse",
                          alignItems: "flex-end", marginBottom: 2, gap: 6,
                          animation: "fadeUp .2s ease"
                        }}>
                          {showAvatar ? (
                            <div style={{
                              width: 28, height: 28, borderRadius: "50%",
                              background: isCliente ? avatarColor(active.name) : "linear-gradient(135deg,#00a884,#005c4b)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0
                            }}>{isCliente ? (active.name || "?")[0].toUpperCase() : "A"}</div>
                          ) : <div style={{ width: 28, flexShrink: 0 }} />}

                          <div style={{
                            maxWidth: "65%",
                            background: isCliente ? W.bubbleIn : W.bubbleOut,
                            borderRadius: isCliente ? "2px 8px 8px 8px" : "8px 2px 8px 8px",
                            padding: "7px 10px",
                          }}>
                            {m.type === "image" && m.url ? (
                              <div>
                                <img src={m.url} alt={m.fileName} onClick={() => setLightbox(m.url)}
                                  style={{ maxWidth: 220, maxHeight: 180, borderRadius: 6, cursor: "pointer", display: "block", marginBottom: 4 }} />
                                {m.fileName && <div style={{ color: W.sub, fontSize: 11 }}>{m.fileName}</div>}
                              </div>
                            ) : m.type === "doc" ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 28 }}>📄</span>
                                <div>
                                  <div style={{ color: W.text, fontSize: 13 }}>{m.fileName || m.text}</div>
                                  {m.size && <div style={{ color: W.sub, fontSize: 11 }}>{(m.size / 1024).toFixed(1)} KB</div>}
                                </div>
                              </div>
                            ) : m.type === "audio" ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, color: W.text, fontSize: 13 }}>
                                <span style={{ fontSize: 18 }}>🎤</span>
                                <span>{m.text || "[áudio]"}</span>
                              </div>
                            ) : (
                              <div style={{ color: W.text, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
                            )}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 3 }}>
                              <span style={{ color: W.sub, fontSize: 11 }}>{m.time}</span>
                              {!isCliente && <span style={{ color: "#53bdeb", fontSize: 13 }}>✓✓</span>}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}

                  {/* Erro de sugestão — sempre visível quando houver */}
                  {sugError && !suggestion && (
                    <div style={{
                      background: "#ef444415", border: "1px solid #ef444440", borderRadius: 10,
                      padding: "10px 16px", marginTop: 10, color: "#ef4444", fontSize: 13,
                      animation: "fadeUp .2s ease"
                    }}>
                      ❌ {sugError}
                    </div>
                  )}

                  {/* Loading Gemini após timer */}
                  {loading && !suggestion && !countdown && !active.paused && (
                    <div style={{
                      background: "#0d1f2d", border: "1px solid #00a88433", borderRadius: 10,
                      padding: "10px 16px", marginTop: 10, display: "flex", alignItems: "center", gap: 10,
                      animation: "fadeUp .2s ease"
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: W.green, animation: "pulse 1.2s infinite" }} />
                      <span style={{ color: W.sub, fontSize: 13 }}>Aurora gerando sugestão...</span>
                    </div>
                  )}

                  {/* Contador regressivo */}
                  {countdown !== null && !suggestion && !active.paused && (
                    <div style={{
                      background: "#0d1f2d", border: "1px solid #00a88433", borderRadius: 10,
                      padding: "10px 16px", marginTop: 10, display: "flex", alignItems: "center", gap: 10,
                      animation: "fadeUp .2s ease"
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: W.green, animation: "pulse 1.2s infinite" }} />
                      <span style={{ color: W.sub, fontSize: 13, flex: 1 }}>Aurora analisando... proposta em <b style={{ color: W.green }}>{countdown}s</b></span>
                      <button onClick={() => { if (_timerGlobal) clearTimeout(_timerGlobal); if (_cdownGlobal) clearInterval(_cdownGlobal); setCountdown(null); }}
                        style={{ background: "none", border: "1px solid #374045", borderRadius: 6, padding: "3px 10px", color: W.sub, fontSize: 12, cursor: "pointer" }}>
                        cancelar
                      </button>
                    </div>
                  )}

                  {/* Sugestão Aurora */}
                  {suggestion && !active.paused && (
                    <div style={{
                      background: "#0d1f2d", border: "1.5px solid #00a88444", borderRadius: 12,
                      padding: 14, marginTop: 10, animation: "fadeUp .25s ease"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: "linear-gradient(135deg,#00a884,#005c4b)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 13, fontWeight: 700
                        }}>A</div>
                        <span style={{ color: W.green, fontWeight: 700, fontSize: 13 }}>SUGESTÃO AURORA</span>
                        <span style={{ color: W.sub, fontSize: 12 }}>— edite se quiser</span>
                      </div>
                      <textarea
                        value={editedSug}
                        onChange={e => setEditedSug(e.target.value)}
                        rows={Math.min(6, (editedSug.split("\n").length + 1))}
                        style={{
                          width: "100%", background: W.inputBg, border: "none", borderRadius: 8,
                          padding: "10px 12px", color: W.text, fontSize: 14, lineHeight: 1.5,
                          outline: "none", marginBottom: 10
                        }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={copySuggestion}
                          style={{ flex: 1, background: W.inputBg, border: "none", borderRadius: 8, padding: "9px 0", color: W.text, fontSize: 13, fontWeight: 500 }}>
                          {copied ? "✓ Copiado!" : "📋 Copiar"}
                        </button>
                        <button onClick={confirmSend} disabled={sending}
                          style={{ flex: 2, background: W.green, border: "none", borderRadius: 8, padding: "9px 0", color: "#fff", fontSize: 13, fontWeight: 700, opacity: sending ? .7 : 1 }}>
                          {sending ? "Enviando..." : active.waJid ? "✓ Enviar como Aurora" : "✓ Confirmar no chat"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Botão gerar sugestão manual */}
                  {msgs.length > 0 && msgs[msgs.length - 1]?.from === "cliente" && !suggestion && countdown === null && !active.paused && cfg.geminiKey && (
                    <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
                      <button onClick={generateManual} disabled={loading}
                        style={{ background: "#0d1f2d", border: "1px solid #00a88433", borderRadius: 8, padding: "8px 20px", color: W.green, fontSize: 13, opacity: loading ? .7 : 1 }}>
                        {loading ? "⏳ Gerando..." : "✨ Gerar sugestão agora"}
                      </button>
                    </div>
                  )}

                  {/* Botões resumo */}
                  {msgs.length > 0 && (
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => setShowResumo(v => !v)}
                        style={{ flex: 1, minWidth: 120, background: W.inputBg, border: "none", borderRadius: 8, padding: "9px 0", color: W.text, fontSize: 13 }}>
                        📋 Ver resumo
                      </button>
                      {resumoSent[activeId] ? (
                        <div style={{ flex: 2, minWidth: 160, background: "#00a88420", border: "1px solid #00a88444", borderRadius: 8, padding: "9px 0", color: W.green, fontSize: 13, textAlign: "center" }}>
                          ✓ Resumo enviado!
                        </div>
                      ) : (
                        <button onClick={handleSendResumo} disabled={resumoSending}
                          style={{ flex: 2, minWidth: 160, background: "#005c4b", border: "none", borderRadius: 8, padding: "9px 0", color: "#fff", fontSize: 13, fontWeight: 600, opacity: resumoSending ? .7 : 1 }}>
                          {resumoSending ? "Enviando..." : `📤 Enviar resumo${attachments.length ? ` + ${attachments.length} anexos` : ""} ao grupo`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Erro resumo */}
                  {resumoErr && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 6 }}>{resumoErr}</div>}

                  {/* Preview resumo */}
                  {showResumo && (
                    <div style={{ background: "#0d1f2d", border: "1px solid #2a3942", borderRadius: 10, padding: 14, marginTop: 8, animation: "fadeUp .2s ease" }}>
                      <pre style={{ color: W.text, fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{resumoPreview()}</pre>
                      {attachments.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ color: W.sub, fontSize: 12, marginBottom: 6 }}>📂 Anexos ({attachments.length})</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {attachments.map(a => (
                              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, background: W.inputBg, borderRadius: 6, padding: "6px 10px" }}>
                                {a.type === "image" ? (
                                  <img src={a.url} alt={a.fileName} style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover", cursor: "pointer" }} onClick={() => setLightbox(a.url)} />
                                ) : <span style={{ fontSize: 22 }}>📎</span>}
                                <div>
                                  <div style={{ color: W.text, fontSize: 12 }}>{a.fileName}</div>
                                  <div style={{ color: W.sub, fontSize: 11 }}>{(a.size / 1024).toFixed(1)} KB</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>

                {/* ── Painel lead ────────────────────────────────────────── */}
                {showLead && (
                  <div style={{
                    width: 260, background: W.leftBg, borderLeft: `1px solid ${W.divider}`,
                    overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14, flexShrink: 0
                  }}>
                    <div style={{ color: W.text, fontWeight: 700, fontSize: 14 }}>📊 Dados do Lead</div>

                    {/* Score bar */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ color: si.color, fontSize: 13, fontWeight: 600 }}>{si.emoji} {si.label}</span>
                        <span style={{ color: W.sub, fontSize: 13 }}>{score}/100</span>
                      </div>
                      <div style={{ background: W.divider, borderRadius: 4, height: 6 }}>
                        <div style={{ width: `${score}%`, background: si.color, height: "100%", borderRadius: 4, transition: "width .5s" }} />
                      </div>
                    </div>

                    {/* BANT */}
                    <div>
                      <div style={{ color: W.sub, fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>BANT</div>
                      {[
                        ["Budget", leadData.orcamento ? "✓" : "—", leadData.orcamento],
                        ["Authority", leadData.decisor ? "✓" : "—", leadData.decisor],
                        ["Need", leadData.produto ? "✓" : "—", leadData.produto],
                        ["Timing", leadData.prazo ? "✓" : "—", leadData.prazo],
                      ].map(([k, icon, val]) => (
                        <div key={k} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                          <span style={{ color: val ? W.green : W.sub, fontSize: 13, width: 14, flexShrink: 0 }}>{icon}</span>
                          <div>
                            <div style={{ color: W.sub, fontSize: 11 }}>{k}</div>
                            <div style={{ color: W.text, fontSize: 12 }}>{val || "—"}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Editar dados */}
                    <div>
                      <div style={{ color: W.sub, fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>EDITAR DADOS</div>
                      {[
                        ["nome", "Nome"],
                        ["empresa", "Empresa"],
                        ["email", "E-mail"],
                        ["telefone", "Telefone"],
                        ["cidade", "Cidade"],
                        ["produto", "Solução"],
                        ["orcamento", "Orçamento"],
                        ["prazo", "Prazo"],
                        ["tipo", "Tipo (evento/inst.)"],
                        ["decisor", "Decisor"],
                      ].map(([k, label]) => (
                        <div key={k} style={{ marginBottom: 7 }}>
                          <div style={{ color: W.sub, fontSize: 11, marginBottom: 2 }}>{label}</div>
                          <input
                            value={leadData[k] || ""}
                            onChange={e => updateLead(activeId, { [k]: e.target.value })}
                            style={{ width: "100%", background: W.inputBg, border: "none", borderRadius: 5, padding: "5px 8px", color: W.text, fontSize: 12, outline: "none" }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Anexos */}
                    {attachments.length > 0 && (
                      <div>
                        <div style={{ color: W.sub, fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>ARQUIVOS ({attachments.length})</div>
                        {attachments.map(a => (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            {a.type === "image" ? (
                              <img src={a.url} alt={a.fileName} style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover", cursor: "pointer" }} onClick={() => setLightbox(a.url)} />
                            ) : <span style={{ fontSize: 22 }}>📎</span>}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: W.text, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.fileName}</div>
                              <div style={{ color: W.sub, fontSize: 11 }}>{(a.size / 1024).toFixed(1)} KB</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div style={{ background: W.inputArea, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, borderTop: `1px solid ${W.divider}20`, flexShrink: 0 }}>
                <input ref={fileRef} type="file" onChange={handleFile} style={{ display: "none" }}
                  accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.zip,.mp4,.mp3,.csv" />
                <button onClick={() => fileRef.current?.click()}
                  style={{ background: "none", border: "none", color: W.icon, fontSize: 20, padding: "4px 6px", flexShrink: 0 }}>📎</button>
                <div style={{ flex: 1, background: W.inputBg, borderRadius: 24, padding: "10px 16px", color: W.sub, fontSize: 14, cursor: "default", userSelect: "none" }}>
                  Mensagens chegam automaticamente do WhatsApp...
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 48 }}>💬</div>
              <div style={{ color: W.sub, fontSize: 16 }}>Selecione uma conversa</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
