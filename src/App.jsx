import { useState, useRef, useEffect } from "react";

const AURORA_SYSTEM = `Você é Aurora, SDR sênior da PixelSAV — especialista em experiências audiovisuais imersivas.

MISSÃO: Analisar a conversa e gerar a MELHOR resposta para enviar ao cliente.

PORTFÓLIO PIXELSAV:
Projeção Mapeada (cenário, fachada, objetos), Sphere 360°, Realidade Aumentada, RA Real Time, Realidade Virtual, Raio-X Interativo, Parede Interativa, Holografia em Palco, Display Holográfico, Sensores e Câmeras, Instalações Fixas, Motion Graphics 3D, Sala Imersiva, Vídeos DOOH/FOOH.

TABELA LOCAÇÃO: Até R$10k: games/totens básicos | R$10k–20k: games personalizados | R$20k–50k: holografia | R$50k–100k: mapping/VR/AR | R$100k–200k: sala imersiva | R$200k+: projetos especiais
TABELA VENDA: R$10k–50k: dispositivos simples | R$50k–100k: Raio-X/display | R$100k–200k: instalações fixas | R$200k+: sala imersiva/museus

REGRAS:
- Tom WhatsApp: direto, caloroso, máximo 3 linhas
- Nunca mais de 1 pergunta por vez
- Nunca inventar preços — usar "a partir de X"
- Coletar progressivamente: nome, empresa, tipo (evento/instalação), prazo, orçamento, local
- Sempre terminar com pergunta ou próximo passo
- Nunca robótico

FLUXO: Descoberta → Qualificação → Locação ou Venda → Orçamento → Apresentação → Próximo passo

RESPONDA APENAS o texto da mensagem. Sem prefixos. Texto puro.`;

async function callGemini(apiKey, msgs) {
  const filtered = msgs.filter(m => m.type === "text" || !m.type);
  const contents = [];
  for (const m of filtered) {
    const role = m.from === "cliente" ? "user" : "model";
    const text = m.from === "cliente" ? `CLIENTE: ${m.text}` : `AURORA: ${m.text}`;
    if (contents.length && contents[contents.length-1].role === role) {
      contents.push({ role: role === "user" ? "model" : "user", parts:[{text:"..."}] });
    }
    contents.push({ role, parts:[{text}] });
  }
  if (!contents.length || contents[0].role !== "user") contents.unshift({role:"user",parts:[{text:"início"}]});
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ system_instruction:{parts:[{text:AURORA_SYSTEM}]}, contents, generationConfig:{temperature:0.7,maxOutputTokens:500} })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

function ts() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function scoreCalc(ld) {
  let s=0;
  if(ld.nome)s+=10;if(ld.empresa)s+=15;if(ld.projeto)s+=20;
  if(ld.evento)s+=20;if(ld.prazo)s+=15;if(ld.orcamento)s+=15;if(ld.intencao)s+=20;
  return Math.min(s,100);
}
function scoreInfo(s) {
  if(s>=80) return {label:"QUENTE",color:"#ef4444",bg:"#ef444420",emoji:"🔴"};
  if(s>=40) return {label:"MORNO",color:"#f97316",bg:"#f9731620",emoji:"🟠"};
  return {label:"FRIO",color:"#60a5fa",bg:"#60a5fa20",emoji:"🔵"};
}
function extractLead(msgs, cur) {
  const t = msgs.map(m=>m.text||"").join(" ");
  return {...cur,
    intencao:/quanto custa|orçamento|valor|preço/i.test(t),
    evento:/evento|show|formatura|festa|lançamento|feira/i.test(t),
    projeto:/projeto|instalação|museu|memorial|corporativo|mapping/i.test(t),
    prazo:/janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|\d{4}|semana|urgente/i.test(t),
  };
}

async function buildResumo(msgs, ld, score, attachments, geminiKey) {
  const si = scoreInfo(score);
  const historico = msgs.filter(m=>m.type==="text"||!m.type)
    .map(m=>`[${m.from==="cliente"?"Cliente":"Aurora"}]: ${m.text||""}`).join("\n");
  let resumoIA = "";
  if (geminiKey && historico) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          system_instruction:{parts:[{text:"Gere um resumo executivo comercial em português. Inclua: o que o cliente quer, dados coletados, próximos passos. Máximo 8 linhas, sem markdown."}]},
          contents:[{role:"user",parts:[{text:`Resumo:\n${historico}`}]}],
          generationConfig:{temperature:0.2,maxOutputTokens:400}
        })
      });
      const d = await r.json();
      resumoIA = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim()||"";
    } catch {}
  }
  const hasAttach = attachments?.length > 0;
  return [
    `🎯 *RESUMO — PixelSAV*`, ``,
    `${si.emoji} *Status:* ${si.label} (${score}/100)`, ``,
    `*📋 DADOS*`,
    ld.nome?`• Nome: ${ld.nome}`:null, ld.empresa?`• Empresa: ${ld.empresa}`:null,
    ld.email?`• E-mail: ${ld.email}`:null, ld.telefone?`• Tel: ${ld.telefone}`:null,
    ld.cidade?`• Cidade: ${ld.cidade}`:null, ld.produto?`• Solução: ${ld.produto}`:null,
    ld.orcamento?`• Orçamento: ${ld.orcamento}`:null, ld.prazo?`• Prazo: ${ld.prazo}`:null, ``,
    resumoIA?`*📝 RESUMO*`:null, resumoIA?resumoIA:null,
    hasAttach?``:null, hasAttach?`*📂 ARQUIVOS DO CLIENTE*`:null,
    ...(hasAttach?attachments.map(a=>`• ${a.type==="image"?"🖼":"📎"} ${a.fileName}`):[]),
    ``, `_Aurora · PixelSAV_`
  ].filter(x=>x!==null).join("\n");
}

async function sendTextEvo(cfg, number, text) {
  await fetch(`/api/evo?${new URLSearchParams({evoUrl:cfg.evoUrl,evoKey:cfg.evoKey,path:`message/sendText/${cfg.instance}`})}`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({number, text})
  });
}

async function sendMediaEvo(cfg, number, att) {
  await fetch(`/api/evo?${new URLSearchParams({evoUrl:cfg.evoUrl,evoKey:cfg.evoKey,path:`message/sendMedia/${cfg.instance}`})}`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({number, mediatype:att.type==="image"?"image":"document", mimetype:att.mimeType, media:att.base64, fileName:att.fileName, caption:`📎 ${att.fileName}`})
  });
}

function fileToBase64(file) {
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
}
function isImage(f) { return f.type.startsWith("image/"); }
function fmtBytes(b) { if(b<1024)return`${b}B`; if(b<1048576)return`${(b/1024).toFixed(1)}KB`; return`${(b/1048576).toFixed(1)}MB`; }
function docIcon(m) {
  if(m.includes("pdf"))return"📄"; if(m.includes("word")||m.includes("doc"))return"📝";
  if(m.includes("sheet")||m.includes("excel"))return"📊"; return"📎";
}

const W = {
  leftBg:"#111b21",leftHdr:"#202c33",chatBg:"#0b141a",chatHdr:"#202c33",
  bubbleIn:"#202c33",bubbleOut:"#005c4b",inputBg:"#2a3942",inputArea:"#202c33",
  green:"#00a884",text:"#e9edef",sub:"#8696a0",divider:"#2a3942",
  hover:"#2a3942",active:"#2d3b43",icon:"#aebac1",
};

function Avatar({name,size=40,gradient=false}) {
  const colors=["#6b7cff","#ff6b6b","#ffd166","#06d6a0","#118ab2","#ef476f","#ff9f1c"];
  const idx = name ? name.charCodeAt(0)%colors.length : 0;
  const initials = (name||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  return <div style={{width:size,height:size,borderRadius:"50%",flexShrink:0,userSelect:"none",
    background:gradient?"linear-gradient(135deg,#ff3a1a,#1a6aff,#00cc66)":colors[idx],
    display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.38,fontWeight:700,color:"#fff"}}>
    {gradient?"A":initials}
  </div>;
}

function Bubble({msg,showAvatar,clientName,onImgClick}) {
  const isClient = msg.from==="cliente";
  const renderContent = () => {
    if(msg.type==="image") return <div>
      <img src={`data:${msg.mimeType};base64,${msg.base64}`} alt={msg.fileName} onClick={()=>onImgClick&&onImgClick(msg)}
        style={{maxWidth:200,maxHeight:160,borderRadius:6,cursor:"pointer",display:"block",objectFit:"cover"}}/>
      <div style={{color:"#8696a077",fontSize:11,marginTop:3}}>{msg.fileName}</div>
    </div>;
    if(msg.type==="doc") return <div style={{display:"flex",alignItems:"center",gap:10,background:"#ffffff10",borderRadius:8,padding:"8px 10px",minWidth:180}}>
      <span style={{fontSize:28}}>{docIcon(msg.mimeType||"")}</span>
      <div><div style={{color:W.text,fontSize:13,fontWeight:600}}>{msg.fileName}</div><div style={{color:W.sub,fontSize:11}}>{msg.fileSize}</div></div>
    </div>;
    if(msg.type==="audio") return <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
      <span style={{fontSize:20}}>🎤</span><span style={{color:W.text,fontSize:13}}>{msg.text||"[áudio]"}</span>
    </div>;
    return <div style={{color:W.text,fontSize:14.5,lineHeight:1.55,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{msg.text}</div>;
  };
  return <div style={{display:"flex",justifyContent:isClient?"flex-start":"flex-end",marginBottom:2,alignItems:"flex-end",gap:6}}>
    {isClient && <div style={{width:28,flexShrink:0}}>{showAvatar&&<Avatar name={clientName} size={28}/>}</div>}
    <div style={{maxWidth:"68%",position:"relative"}}>
      {showAvatar&&<div style={{position:"absolute",bottom:0,[isClient?"left":"right"]:-6,width:0,height:0,borderStyle:"solid",
        borderWidth:isClient?"0 0 8px 8px":"0 8px 8px 0",
        borderColor:isClient?`transparent transparent ${W.bubbleIn} transparent`:`transparent ${W.bubbleOut} transparent transparent`}}/>}
      <div style={{background:isClient?W.bubbleIn:W.bubbleOut,borderRadius:isClient?(showAvatar?"2px 8px 8px 8px":"8px"):(showAvatar?"8px 2px 8px 8px":"8px"),padding:"6px 10px 4px",boxShadow:"0 1px 1px #0005"}}>
        {isClient&&showAvatar&&<div style={{color:W.green,fontSize:11,fontWeight:600,marginBottom:2}}>{clientName}</div>}
        {renderContent()}
        <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:3,marginTop:2}}>
          <span style={{color:"#8696a077",fontSize:11}}>{msg.time}</span>
          {!isClient&&<span style={{color:"#53bdeb",fontSize:13}}>✓✓</span>}
        </div>
      </div>
    </div>
    {!isClient&&<div style={{width:28,flexShrink:0}}>{showAvatar&&<Avatar gradient size={28}/>}</div>}
  </div>;
}

function WaPanel({cfg,onSave,onClose}) {
  const [name,setName]=useState("");
  const [step,setStep]=useState("form");
  const [qr,setQr]=useState(null);
  const [err,setErr]=useState("");
  const pollRef=useRef(null);
  useEffect(()=>()=>{if(pollRef.current)clearInterval(pollRef.current)},[]);

  async function evoCall(path,method="GET",body=null) {
    const r=await fetch(`/api/evo?${new URLSearchParams({evoUrl:cfg.evoUrl,evoKey:cfg.evoKey,path})}`,
      {method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
    return r.json();
  }

  async function criar() {
    if(!name.trim()||!cfg.evoUrl||!cfg.evoKey){setErr("Configure Evolution API em ⚙️ primeiro.");return;}
    setErr("");setStep("loading");
    try {
      const check = await evoCall(`instance/connectionState/${name.trim()}`);
      if((check.instance?.state||check.state)==="open"){onSave(name.trim());setStep("connected");return;}
      await evoCall("instance/create","POST",{instanceName:name.trim(),qrcode:true,integration:"WHATSAPP-BAILEYS"});
      await new Promise(r=>setTimeout(r,2000));
      const conn = await evoCall(`instance/connect/${name.trim()}`);
      if(conn.base64){setQr(conn.base64);setStep("qr");onSave(name.trim());
        pollRef.current=setInterval(async()=>{
          const s=await evoCall(`instance/connectionState/${name.trim()}`);
          if((s.instance?.state||s.state)==="open"){clearInterval(pollRef.current);setStep("connected");}
          else{const c2=await evoCall(`instance/connect/${name.trim()}`);if(c2.base64)setQr(c2.base64);}
        },4000);
      } else if((conn.instance?.state||conn.state)==="open"){onSave(name.trim());setStep("connected");}
      else{setErr("Não foi possível gerar QR Code.");setStep("form");}
    } catch(e){setErr(e.message);setStep("form");}
  }

  async function desconectar() {
    if(pollRef.current)clearInterval(pollRef.current);
    try{await evoCall(`instance/logout/${name.trim()}`,"DELETE");}catch{}
    onSave("");setStep("form");setQr(null);setName("");
  }

  return <div style={{position:"fixed",inset:0,background:"#000c",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{background:"#111b21",border:`1px solid ${W.divider}`,borderRadius:16,padding:28,width:400,maxWidth:"95vw",display:"flex",flexDirection:"column",gap:16,boxShadow:"0 20px 60px #000a"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:24}}>📱</span>
        <div style={{flex:1}}><div style={{color:W.text,fontWeight:700,fontSize:16}}>WhatsApp · Conexão</div><div style={{color:W.sub,fontSize:12}}>Evolution API</div></div>
        <button onClick={()=>{if(pollRef.current)clearInterval(pollRef.current);onClose();}} style={{background:"none",border:"none",color:W.sub,fontSize:22,cursor:"pointer"}}>✕</button>
      </div>
      {(step==="form")&&<>
        <div>
          <label style={{color:W.sub,fontSize:11,display:"block",marginBottom:6}}>NOME DA INSTÂNCIA</label>
          <input value={name} onChange={e=>setName(e.target.value.replace(/\s/g,""))} onKeyDown={e=>e.key==="Enter"&&criar()}
            placeholder="ex: pixelsav-comercial"
            style={{width:"100%",background:W.inputBg,border:`1px solid ${W.divider}`,borderRadius:8,padding:"10px 14px",color:W.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
        </div>
        {err&&<div style={{background:"#2a1010",border:"1px solid #ef444444",borderRadius:8,padding:"9px 12px",color:"#ef4444",fontSize:12}}>⚠️ {err}</div>}
        <button onClick={criar} disabled={!name.trim()} style={{background:name.trim()?W.green:"#2a3942",color:"#fff",border:"none",borderRadius:10,padding:"12px 0",fontWeight:700,fontSize:14,cursor:name.trim()?"pointer":"not-allowed"}}>
          Criar e gerar QR Code
        </button>
      </>}
      {step==="loading"&&<div style={{textAlign:"center",padding:"24px 0",color:W.sub,fontSize:13}}>⚙️ Criando instância...</div>}
      {step==="qr"&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        <div style={{color:W.green,fontSize:12,fontWeight:700}}>📷 ESCANEIE COM O WHATSAPP</div>
        <div style={{background:"#fff",borderRadius:12,padding:10}}>
          {qr?<img src={qr.startsWith("data:")?qr:`data:image/png;base64,${qr}`} alt="QR" style={{width:230,height:230,display:"block"}}/>
            :<div style={{width:230,height:230,display:"flex",alignItems:"center",justifyContent:"center",color:"#333"}}>Gerando...</div>}
        </div>
        <div style={{color:W.sub,fontSize:11,textAlign:"center",lineHeight:1.7}}>WhatsApp → Dispositivos conectados → Conectar dispositivo</div>
      </div>}
      {step==="connected"&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
        <div style={{background:"#0d2a1a",border:`1px solid ${W.green}66`,borderRadius:12,padding:"20px 28px",textAlign:"center",width:"100%",boxSizing:"border-box"}}>
          <div style={{fontSize:48,marginBottom:8}}>✅</div>
          <div style={{color:W.green,fontWeight:700,fontSize:16}}>WhatsApp Conectado!</div>
          <div style={{color:W.sub,fontSize:13}}>Instância: <strong style={{color:W.text}}>{name}</strong></div>
        </div>
        <button onClick={desconectar} style={{width:"100%",background:"#2a1010",border:"1px solid #ef444444",borderRadius:8,padding:"10px 0",color:"#ef4444",fontSize:13,cursor:"pointer",fontWeight:600}}>Desconectar</button>
      </div>}
    </div>
  </div>;
}

export default function App() {
  const [cfg,setCfg]=useState({geminiKey:"",evoUrl:"",instance:"",evoKey:"",groupId:""});
  const [showCfg,setShowCfg]=useState(false);
  const [showWA,setShowWA]=useState(false);
  const [convos,setConvos]=useState([
    {id:1,name:"Cliente Exemplo",phone:"41 99999-0001",lastMsg:"Oi, vi vocês no Instagram!",time:"09:14",unread:1,messages:[],leadData:{},attachments:[],paused:false,waJid:null}
  ]);
  const [activeId,setActiveId]=useState(1);
  const [searchQ,setSearchQ]=useState("");
  const [showNew,setShowNew]=useState(false);
  const [newName,setNewName]=useState("");
  const [suggestion,setSuggestion]=useState(null);
  const [editedSug,setEditedSug]=useState("");
  const [countdown,setCountdown]=useState(null);
  const [copied,setCopied]=useState(false);
  const [resumoSent,setResumoSent]=useState({});
  const [resumoSending,setResumoSending]=useState(false);
  const [resumoErr,setResumoErr]=useState("");
  const [showResumo,setShowResumo]=useState(false);
  const [showLead,setShowLead]=useState(false);
  const [lightbox,setLightbox]=useState(null);
  const [sending,setSending]=useState(false);

  const bottomRef=useRef(null);
  const fileRef=useRef(null);
  const waPollingRef=useRef(null);
  const seenIds=useRef(new Set());
  const saudacaoEnviada=useRef(new Set()); // números que já receberam saudação
  const cfgRef=useRef(cfg);
  const convosRef=useRef(convos);
  const activeIdRef=useRef(activeId);
  const timerRef=useRef(null);
  const cdownRef=useRef(null);
  const lastProcessedRef=useRef(null);

  useEffect(()=>{cfgRef.current=cfg;},[cfg]);
  useEffect(()=>{convosRef.current=convos;},[convos]);
  useEffect(()=>{activeIdRef.current=activeId;},[activeId]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[convos,activeId,suggestion,loading]);
  useEffect(()=>{try{const s=localStorage.getItem("aurora_v4");if(s)setCfg(JSON.parse(s));}catch{}},[]);

  const active=convos.find(c=>c.id===activeId);
  const msgs=active?.messages||[];
  const leadData=active?.leadData||{};
  const attachments=active?.attachments||[];
  const score=scoreCalc(leadData);
  const si=scoreInfo(score);
  const [loading,setLoading]=useState(false);

  function updateConvo(id,patch){setConvos(cs=>cs.map(c=>c.id===id?{...c,...patch}:c));}
  function updateLead(id,patch){setConvos(cs=>cs.map(c=>c.id===id?{...c,leadData:{...c.leadData,...patch}}:c));}
  function saveCfg(){try{localStorage.setItem("aurora_v4",JSON.stringify(cfg));}catch{}setShowCfg(false);}

  // ── TIMER 30s ─────────────────────────────────────────────────────────────
  // Chamado quando chega msg do cliente. Reinicia a cada nova msg.
  function dispararTimer(waJid, convoId) {
    if(timerRef.current) clearTimeout(timerRef.current);
    if(cdownRef.current) clearInterval(cdownRef.current);

    let seg=30;
    setCountdown(seg);
    cdownRef.current=setInterval(()=>{
      seg-=1;
      setCountdown(seg>0?seg:null);
      if(seg<=0) clearInterval(cdownRef.current);
    },1000);

    // Mostra digitando no WhatsApp
    const c=cfgRef.current;
    if(waJid&&c.evoUrl&&c.evoKey&&c.instance){
      fetch(`/api/evo?${new URLSearchParams({evoUrl:c.evoUrl,evoKey:c.evoKey,path:`chat/presence/${c.instance}`})}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({number:waJid,options:{presence:"composing",delay:30000}})
      }).catch(()=>{});
    }

    timerRef.current=setTimeout(()=>{
      clearInterval(cdownRef.current);
      setCountdown(null);
      const currentCfg=cfgRef.current;
      if(!currentCfg.geminiKey) return;
      // Pega msgs atuais da conversa
      const convo=convosRef.current.find(c=>c.id===convoId);
      if(!convo) return;
      const msgsAtuais=convo.messages||[];
      const ultima=msgsAtuais[msgsAtuais.length-1];
      if(!ultima||ultima.from!=="cliente") return;
      callGemini(currentCfg.geminiKey,msgsAtuais).then(sug=>{
        setSuggestion(sug);
        setEditedSug(sug);
      }).catch(()=>{});
    },30000);
  }

  // ── WEBHOOK POLLING ────────────────────────────────────────────────────────
  useEffect(()=>{
    let lastTs=Date.now()-30000;
    const poll=async()=>{
      try{
        const r=await fetch(`/api/webhook?since=${lastTs}`);
        if(!r.ok) return;
        const data=await r.json();
        if(!data.messages?.length){lastTs=data.ts||Date.now();return;}
        lastTs=data.ts||Date.now();

        for(const m of data.messages){
          const msgId=m.id;
          if(!msgId||seenIds.current.has(msgId)) continue;
          seenIds.current.add(msgId);

          const from=m.remoteJid||"";
          const name=m.pushName||from.replace("@s.whatsapp.net","");
          const phone=from.replace("@s.whatsapp.net","").replace("@g.us","");
          const type=m.type||"text";
          const text=m.text||"[mídia]";
          const msgTime=m.timestamp?new Date(m.timestamp*1000):new Date();
          const timeStr=`${String(msgTime.getHours()).padStart(2,"0")}:${String(msgTime.getMinutes()).padStart(2,"0")}`;
          const novaMsg={from:"cliente",text,time:timeStr,id:Date.now()+Math.random(),type,waId:msgId};
          const saudacao="Olá! Seja bem-vindo(a) ao atendimento da PixelSAV! 😊 Sou a Aurora, sua consultora de experiências imersivas. Como posso te ajudar hoje?";

          let convoId=null;
          setConvos(cs=>{
            const existing=cs.find(c=>c.phone===phone||c.waJid===from);
            if(existing){
              if(existing.messages.some(em=>em.waId===msgId)) return cs;
              convoId=existing.id;
              return cs.map(c=>c.id===existing.id?{...c,
                messages:[...c.messages,novaMsg],
                lastMsg:text.slice(0,40),time:timeStr,
                unread:activeIdRef.current===c.id?0:(c.unread||0)+1,
              }:c);
            } else {
              const novoId=Date.now()+Math.random();
              convoId=novoId;
              // Envia saudação automática — só uma vez por número
              const currentCfg=cfgRef.current;
              if(!saudacaoEnviada.current.has(from)&&currentCfg.evoUrl&&currentCfg.evoKey&&currentCfg.instance){
                saudacaoEnviada.current.add(from);
                fetch(`/api/evo?${new URLSearchParams({evoUrl:currentCfg.evoUrl,evoKey:currentCfg.evoKey,path:`message/sendText/${currentCfg.instance}`})}`,{
                  method:"POST",headers:{"Content-Type":"application/json"},
                  body:JSON.stringify({number:from,text:saudacao})
                }).catch(()=>{});
              }
              const msgSaudacao={from:"aurora",text:saudacao,time:timeStr,id:Date.now()+Math.random(),type:"text"};
              setActiveId(novoId);
              return [{id:novoId,name,phone,waJid:from,lastMsg:text.slice(0,40),time:timeStr,unread:0,
                messages:[msgSaudacao,novaMsg],leadData:{},attachments:[],paused:false},
                ...cs];
            }
          });

          // Dispara timer usando waJid (from) — não depende de convoId
          if(lastProcessedRef.current!==msgId){
            lastProcessedRef.current=msgId;
            setTimeout(()=>{
              const convo=convosRef.current.find(c=>c.waJid===from||c.phone===phone);
              if(!convo||convo.paused) return;
              setActiveId(convo.id);
              dispararTimer(from, convo.id);
            },200);
          }
        }
      }catch(e){}
    };
    poll();
    waPollingRef.current=setInterval(poll,3000);
    return()=>clearInterval(waPollingRef.current);
  },[]);

  async function handleFileUpload(e){
    const files=Array.from(e.target.files);
    if(!files.length||!active) return;
    for(const file of files){
      const base64=await fileToBase64(file);
      const type=isImage(file)?"image":"doc";
      const att={id:Date.now()+Math.random(),fileName:file.name,mimeType:file.type,base64,type,fileSize:fmtBytes(file.size)};
      const msg={from:"cliente",type,fileName:file.name,mimeType:file.type,base64,fileSize:fmtBytes(file.size),time:ts(),id:Date.now()+Math.random()};
      setConvos(cs=>cs.map(c=>c.id===activeId?{...c,messages:[...c.messages,msg],attachments:[...(c.attachments||[]),att],lastMsg:type==="image"?"🖼 Imagem":`📎 ${file.name}`,time:ts()}:c));
    }
    e.target.value="";
  }

  async function confirmSend(){
    if(!editedSug.trim()||!active) return;
    setSending(true);
    const text=editedSug.trim();
    const msg={from:"aurora",text,time:ts(),id:Date.now(),type:"text"};
    setConvos(cs=>cs.map(c=>c.id===activeId?{...c,messages:[...c.messages,msg],lastMsg:text.slice(0,40),time:ts()}:c));
    setSuggestion(null);setEditedSug("");
    if(cfg.evoUrl&&cfg.evoKey&&cfg.instance&&active.waJid){
      try{await sendTextEvo(cfg,active.waJid,text);}catch(e){console.warn(e);}
    }
    setSending(false);
  }

  async function handleSendResumo(){
    setResumoSending(true);setResumoErr("");
    try{
      if(!cfg.evoUrl||!cfg.instance||!cfg.groupId) throw new Error("Configure Evolution API em ⚙️");
      const txt=await buildResumo(msgs,leadData,score,attachments,cfg.geminiKey);
      await sendTextEvo(cfg,cfg.groupId,txt);
      for(const att of attachments){try{await sendMediaEvo(cfg,cfg.groupId,att);}catch{}}
      setResumoSent(r=>({...r,[activeId]:true}));
    }catch(e){setResumoErr(e.message);}
    setResumoSending(false);
  }

  function addConvo(){
    if(!newName.trim()) return;
    const id=Date.now();
    setConvos(cs=>[{id,name:newName.trim(),phone:"",lastMsg:"Nova conversa",time:ts(),unread:0,messages:[],leadData:{},attachments:[],paused:false,waJid:null},...cs]);
    setActiveId(id);setNewName("");setShowNew(false);
  }

  const filtered=convos.filter(c=>c.name.toLowerCase().includes(searchQ.toLowerCase()));

  return <div style={{width:"100%",height:"100vh",display:"flex",fontFamily:"'Segoe UI',system-ui,sans-serif",overflow:"hidden",background:"#000"}}>
    {lightbox&&<div onClick={()=>setLightbox(null)} style={{position:"fixed",inset:0,background:"#000d",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <img src={`data:${lightbox.mimeType};base64,${lightbox.base64}`} style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:8}}/>
    </div>}
    {showWA&&<WaPanel cfg={cfg} onSave={name=>{setCfg(c=>{const n={...c,instance:name};try{localStorage.setItem("aurora_v4",JSON.stringify(n));}catch{}return n;});}} onClose={()=>setShowWA(false)}/>}

    {/* LEFT */}
    <div style={{width:360,minWidth:280,display:"flex",flexDirection:"column",background:W.leftBg,borderRight:`1px solid ${W.divider}`,flexShrink:0}}>
      <div style={{background:W.leftHdr,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,height:60,flexShrink:0}}>
        <Avatar name="Denise" size={40}/>
        <span style={{flex:1,color:W.text,fontWeight:600,fontSize:15}}>Denise · PixelSAV</span>
        <button onClick={()=>setShowNew(p=>!p)} style={{background:"none",border:"none",color:W.icon,cursor:"pointer",fontSize:20,padding:"4px 6px",borderRadius:6}}>✎</button>
        <button onClick={()=>setShowWA(true)} style={{background:"none",border:"none",color:W.icon,cursor:"pointer",fontSize:18,padding:"4px 6px",borderRadius:6}}>📱</button>
        <button onClick={()=>setShowCfg(p=>!p)} style={{background:"none",border:"none",color:W.icon,cursor:"pointer",fontSize:18,padding:"4px 6px",borderRadius:6}}>⚙</button>
      </div>

      {showCfg&&<div style={{background:"#0d1418",borderBottom:`1px solid ${W.divider}`,padding:"12px 14px",display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
        <div style={{color:W.text,fontWeight:700,fontSize:12,marginBottom:2}}>⚙ CONFIGURAÇÕES</div>
        {[["geminiKey","Gemini API Key","AIza...","password"],["evoUrl","Evolution URL","https://...","text"],
          ["instance","Instância","pixelsav","text"],["evoKey","API Key Evolution","token...","password"],
          ["groupId","ID Grupo WA","5541...@g.us","text"]
        ].map(([k,label,ph,type])=><div key={k} style={{display:"flex",flexDirection:"column",gap:2}}>
          <label style={{color:W.sub,fontSize:10}}>{label}</label>
          <input type={type} value={cfg[k]} placeholder={ph} onChange={e=>setCfg(c=>({...c,[k]:e.target.value}))}
            style={{background:W.inputBg,border:"none",borderRadius:6,padding:"6px 9px",color:W.text,fontSize:12,outline:"none"}}/>
        </div>)}
        <button onClick={saveCfg} style={{background:W.green,color:"#fff",border:"none",borderRadius:8,padding:"8px 0",fontWeight:700,fontSize:12,cursor:"pointer",marginTop:2}}>✓ Salvar</button>
      </div>}

      {showNew&&<div style={{background:"#0d1418",borderBottom:`1px solid ${W.divider}`,padding:"10px 14px",display:"flex",gap:8,flexShrink:0}}>
        <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addConvo()}
          placeholder="Nome do cliente..." style={{flex:1,background:W.inputBg,border:"none",borderRadius:8,padding:"8px 12px",color:W.text,fontSize:13,outline:"none"}}/>
        <button onClick={addConvo} style={{background:W.green,color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:13,cursor:"pointer",fontWeight:700}}>+</button>
      </div>}

      <div style={{padding:"8px 12px",flexShrink:0}}>
        <div style={{background:W.inputBg,borderRadius:8,display:"flex",alignItems:"center",padding:"7px 12px",gap:8}}>
          <span style={{color:W.sub,fontSize:14}}>🔍</span>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Pesquisar conversas"
            style={{flex:1,background:"transparent",border:"none",color:W.text,fontSize:13.5,outline:"none"}}/>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto"}}>
        {filtered.map(c=>{
          const cs=scoreCalc(c.leadData);const csi=scoreInfo(cs);const isAct=c.id===activeId;
          return <div key={c.id} onClick={()=>{setActiveId(c.id);setSuggestion(null);setEditedSug("");setShowResumo(false);updateConvo(c.id,{unread:0});}}
            style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",cursor:"pointer",
              background:isAct?W.active:"transparent",borderBottom:`1px solid ${W.divider}22`,transition:"background .1s"}}
            onMouseEnter={e=>{if(!isAct)e.currentTarget.style.background=W.hover;}}
            onMouseLeave={e=>{if(!isAct)e.currentTarget.style.background="transparent";}}>
            <div style={{position:"relative"}}>
              <Avatar name={c.name} size={49}/>
              {c.unread>0&&<div style={{position:"absolute",top:-2,right:-2,width:18,height:18,borderRadius:"50%",background:W.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:700}}>{c.unread}</div>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <span style={{color:W.text,fontWeight:600,fontSize:14.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:150}}>{c.name}</span>
                <span style={{color:c.unread?W.green:W.sub,fontSize:11.5,flexShrink:0}}>{c.time}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{color:W.sub,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{c.lastMsg}</span>
                {c.paused&&<span style={{fontSize:9,fontWeight:700,color:"#ef4444",background:"#ef444420",borderRadius:10,padding:"2px 6px",flexShrink:0}}>⏸</span>}
                {!c.paused&&cs>0&&<span style={{fontSize:9,fontWeight:700,color:csi.color,background:csi.bg,borderRadius:10,padding:"2px 6px",flexShrink:0}}>{csi.emoji}</span>}
              </div>
            </div>
          </div>;
        })}
      </div>
    </div>

    {/* RIGHT */}
    {!active?<div style={{flex:1,background:W.chatBg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14}}>
      <div style={{fontSize:64}}>💬</div>
      <div style={{color:W.text,fontSize:20,fontWeight:300}}>Agente Aurora · PixelSAV</div>
      <div style={{color:W.sub,fontSize:14}}>Selecione ou crie uma conversa</div>
    </div>:
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
      {/* Chat Header */}
      <div style={{background:W.chatHdr,height:60,display:"flex",alignItems:"center",padding:"0 16px",gap:12,flexShrink:0,borderBottom:`1px solid ${W.divider}`}}>
        <Avatar name={active.name} size={40}/>
        <div style={{flex:1}}>
          <div style={{color:W.text,fontWeight:600,fontSize:15}}>{active.name}</div>
          <div style={{color:W.sub,fontSize:12}}>{active.phone||"cliente"}{attachments.length>0?` · 📎 ${attachments.length} anexo${attachments.length>1?"s":""}`:""}</div>
        </div>
        <div style={{background:si.bg,border:`1px solid ${si.color}44`,borderRadius:20,padding:"4px 12px",fontSize:11.5,fontWeight:700,color:si.color}}>{si.emoji} {si.label} {score}/100</div>
        <button onClick={()=>updateConvo(activeId,{paused:!active.paused})}
          style={{background:active.paused?"#2a1010":"none",border:active.paused?"1px solid #ef444444":"none",color:active.paused?"#ef4444":W.icon,cursor:"pointer",fontSize:14,padding:"6px 8px",borderRadius:6,fontWeight:active.paused?700:400}}>
          {active.paused?"⏸ Pausado":"⏸"}
        </button>
        <button onClick={()=>setShowLead(p=>!p)} style={{background:showLead?W.active:"none",border:"none",color:W.icon,cursor:"pointer",fontSize:18,padding:"6px 8px",borderRadius:6}}>👤</button>
      </div>

      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",background:W.chatBg,padding:"12px 5%",display:"flex",flexDirection:"column",gap:1}}>
            {msgs.length===0&&<div style={{display:"flex",justifyContent:"center",margin:"20px 0"}}>
              <div style={{background:"#182229",borderRadius:10,padding:"10px 18px",color:W.sub,fontSize:12,lineHeight:1.7,textAlign:"center"}}>
                ✨ Mensagens do cliente aparecerão aqui automaticamente.<br/>Aurora propõe respostas após 30s da última mensagem.
              </div>
            </div>}

            {msgs.length>0&&<div style={{display:"flex",justifyContent:"center",margin:"8px 0 12px"}}>
              <div style={{background:"#182229",borderRadius:10,padding:"4px 14px",color:W.sub,fontSize:12}}>
                {new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}
              </div>
            </div>}

            {msgs.map((msg,i)=>{
              const showAvatar=i===0||msgs[i-1].from!==msg.from;
              return <div key={msg.id} onClick={()=>msg.type==="image"&&setLightbox(msg)}>
                <Bubble msg={msg} showAvatar={showAvatar} clientName={active.name} onImgClick={setLightbox}/>
              </div>;
            })}

            {/* Countdown */}
            {countdown!==null&&!suggestion&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#0d1f2d",border:`1px solid ${W.green}33`,borderRadius:10,margin:"4px 0"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:W.green,animation:"pulse 1s ease-in-out infinite"}}/>
              <span style={{color:W.sub,fontSize:12}}>Aurora analisando... proposta em <strong style={{color:W.green}}>{countdown}s</strong></span>
              <button onClick={()=>{if(timerRef.current)clearTimeout(timerRef.current);if(cdownRef.current)clearInterval(cdownRef.current);setCountdown(null);}}
                style={{marginLeft:"auto",background:"none",border:"none",color:W.sub,cursor:"pointer",fontSize:12}}>cancelar</button>
            </div>}

            {/* Suggestion */}
            {suggestion&&!loading&&<div style={{margin:"10px 0 4px",background:"#0d1f2d",border:`1.5px solid ${W.green}44`,borderRadius:12,padding:"12px",animation:"fadeUp .2s ease"}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:9}}>
                <Avatar gradient size={24}/>
                <span style={{color:W.green,fontSize:11,fontWeight:700,letterSpacing:.8}}>SUGESTÃO AURORA</span>
                <span style={{marginLeft:"auto",color:"#2a5a4a",fontSize:10}}>edite se quiser</span>
              </div>
              <textarea value={editedSug} onChange={e=>setEditedSug(e.target.value)} rows={3}
                style={{width:"100%",background:W.inputBg,border:`1px solid ${W.divider}`,borderRadius:8,color:W.text,fontSize:14,padding:"9px 11px",resize:"none",outline:"none",lineHeight:1.55,fontFamily:"inherit",boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:7,marginTop:8}}>
                <button onClick={()=>{navigator.clipboard.writeText(editedSug);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
                  style={{flex:1,background:copied?"#00a88422":"#2a3942",color:copied?W.green:W.sub,border:copied?`1px solid ${W.green}44`:"none",borderRadius:8,padding:"8px 0",fontSize:12.5,cursor:"pointer",fontWeight:600}}>
                  {copied?"✓ Copiado!":"📋 Copiar"}
                </button>
                <button onClick={confirmSend} disabled={sending}
                  style={{flex:2,background:sending?"#2a3942":W.green,color:"#fff",border:"none",borderRadius:8,padding:"8px 0",fontSize:12.5,cursor:sending?"not-allowed":"pointer",fontWeight:700}}>
                  {sending?"Enviando...":active?.waJid?"✓ Enviar como Aurora":"✓ Confirmar no chat"}
                </button>
              </div>
            </div>}

            {/* Resumo buttons */}
            {msgs.length>0&&!loading&&<div style={{margin:"8px 0 4px",display:"flex",gap:7}}>
              <button onClick={()=>setShowResumo(p=>!p)}
                style={{flex:1,background:"#1a2530",border:`1px solid ${W.divider}`,borderRadius:8,padding:"8px 0",color:W.sub,fontSize:12,cursor:"pointer",fontWeight:600}}>
                {showResumo?"▲ Fechar":"📋 Ver resumo"}
              </button>
              <button onClick={handleSendResumo} disabled={resumoSending||resumoSent[activeId]}
                style={{flex:2,background:resumoSent[activeId]?"#1a3a2a":resumoSending?"#1a2530":"#005c4b",
                  color:resumoSent[activeId]?W.green:resumoSending?W.sub:"#fff",
                  border:resumoSent[activeId]?`1px solid ${W.green}44`:`1px solid ${W.divider}`,
                  borderRadius:8,padding:"8px 0",fontSize:12,fontWeight:700,cursor:resumoSent[activeId]||resumoSending?"not-allowed":"pointer"}}>
                {resumoSent[activeId]?"✓ Resumo enviado!":resumoSending?"Gerando...":"📤 Enviar resumo ao grupo"}
              </button>
            </div>}

            {resumoErr&&<div style={{background:"#2a1010",border:"1px solid #ef444444",borderRadius:8,padding:"7px 12px",color:"#ef4444",fontSize:12,marginBottom:4}}>⚠️ {resumoErr}</div>}
            {showResumo&&<ResumoBox msgs={msgs} ld={leadData} score={score} att={attachments} gkey={cfg.geminiKey}/>}

            <div ref={bottomRef} style={{height:4}}/>
          </div>

          {/* Input */}
          <div style={{background:W.inputArea,padding:"8px 14px",display:"flex",alignItems:"flex-end",gap:10,flexShrink:0,borderTop:`1px solid ${W.divider}`}}>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.mp4,.mp3,.csv" onChange={handleFileUpload} style={{display:"none"}}/>
            <button onClick={()=>fileRef.current.click()} style={{background:"none",border:"none",color:W.icon,cursor:"pointer",fontSize:22,padding:"4px",flexShrink:0,marginBottom:4}}>📎</button>
            <div style={{flex:1,background:W.inputBg,borderRadius:24,padding:"9px 14px",display:"flex",alignItems:"flex-end"}}>
              <textarea value="" readOnly placeholder="Mensagens chegam automaticamente do WhatsApp..." rows={1}
                style={{flex:1,background:"transparent",border:"none",color:W.sub,fontSize:14.5,outline:"none",resize:"none",lineHeight:1.5,fontFamily:"inherit"}}/>
            </div>
          </div>
        </div>

        {/* Lead Panel */}
        {showLead&&<div style={{width:260,background:"#111b21",borderLeft:`1px solid ${W.divider}`,padding:"14px 12px",overflowY:"auto",flexShrink:0,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{color:W.text,fontWeight:700,fontSize:13}}>📊 Dados do Lead</div>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{color:W.sub,fontSize:11}}>Lead Score</span>
              <span style={{color:si.color,fontSize:11,fontWeight:700}}>{score}/100 {si.emoji}</span>
            </div>
            <div style={{background:"#2a3942",borderRadius:4,height:5}}>
              <div style={{width:`${score}%`,height:"100%",background:si.color,borderRadius:4,transition:"width .5s"}}/>
            </div>
          </div>
          <div style={{background:"#0d1418",borderRadius:8,padding:10}}>
            <div style={{color:W.sub,fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:8}}>BANT</div>
            {[["💰 Budget",leadData.orcamento||"—"],["👤 Authority",leadData.decisor||"—"],["🎯 Need",leadData.projeto?"Definido":"Em descoberta"],["⏰ Timing",leadData.prazo||"—"]].map(([k,v])=>
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${W.divider}22`}}>
                <span style={{color:W.sub,fontSize:11}}>{k}</span>
                <span style={{color:W.text,fontSize:11,maxWidth:110,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</span>
              </div>)}
          </div>
          <div style={{color:W.sub,fontSize:10,fontWeight:700,letterSpacing:1}}>EDITAR DADOS</div>
          {[["nome","Nome"],["empresa","Empresa"],["email","E-mail"],["telefone","Telefone"],
            ["cidade","Cidade/UF"],["produto","Solução"],["orcamento","Orçamento"],
            ["prazo","Prazo"],["tipo","Locação/Venda"],["decisor","Decisor"]].map(([k,label])=>
            <div key={k} style={{marginBottom:4}}>
              <div style={{color:"#4a6a7a",fontSize:10,marginBottom:2}}>{label}</div>
              <input value={leadData[k]||""} onChange={e=>updateLead(activeId,{[k]:e.target.value})}
                style={{width:"100%",background:W.inputBg,border:"none",borderRadius:5,padding:"5px 8px",color:W.text,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
            </div>)}
        </div>}
      </div>
    </div>}

    <style>{`
      @keyframes pulse{0%,100%{opacity:.4;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      *{box-sizing:border-box}
      ::-webkit-scrollbar{width:4px;height:4px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:#2a3942;border-radius:4px}
      textarea::placeholder,input::placeholder{color:#3a5a6a}
    `}</style>
  </div>;
}

function ResumoBox({msgs,ld,score,att,gkey}) {
  const [text,setText]=useState("Gerando resumo...");
  useEffect(()=>{buildResumo(msgs,ld,score,att,gkey).then(setText);},[]);
  return <div style={{background:"#0d1a22",border:"1px solid #2a3942",borderRadius:10,padding:"12px",marginBottom:6}}>
    <div style={{color:"#8696a0",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:8}}>PREVIEW DO RESUMO</div>
    <pre style={{color:"#e9edef",fontSize:11.5,lineHeight:1.65,whiteSpace:"pre-wrap",wordBreak:"break-word",margin:0,fontFamily:"inherit"}}>{text}</pre>
  </div>;
}
