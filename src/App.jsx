import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `Eres el asistente virtual de "Clínica Dental Sonrisa Perfecta". Tu nombre es Soni.

INFORMACIÓN:
- Horario: Lunes a Viernes 9:00am - 6:00pm, Sábados 9:00am - 1:00pm
- Teléfono: +56 9 8765 4321
- Dirección: Av. Providencia 1234, Santiago
- Servicios: Limpieza dental ($25.000), Blanqueamiento ($80.000), Ortodoncia (desde $350.000), Implantes (desde $450.000), Urgencias, Revisión general ($15.000)
- Seguros: Fonasa, Banmédica, Cruz Blanca, Consalud, Colmena

PERSONALIDAD: Cálido, profesional, respuestas cortas (máximo 3 líneas), español chileno, emojis con moderación.`;

const SERVICIOS = [
  "Revisión general ($15.000)",
  "Limpieza dental ($25.000)",
  "Blanqueamiento ($80.000)",
  "Ortodoncia (desde $350.000)",
  "Implantes (desde $450.000)",
  "Urgencia dental",
];

const quickReplies = [
  "¿Qué servicios ofrecen?",
  "¿Cuáles son los horarios?",
  "Quiero agendar una cita",
  "¿Aceptan Fonasa?",
];

const STEPS = {
  NONE: "none",
  NOMBRE: "nombre",
  SERVICIO: "servicio",
  SLOTS: "slots",
  TELEFONO: "telefono",
  CONFIRMADO: "confirmado",
};

const quiereAgendar = (t) =>
  ["agendar", "cita", "reservar", "hora", "turno", "appointment"].some(k => t.toLowerCase().includes(k));

export default function App() {
  const [messages, setMessages]     = useState([{ role: "assistant", content: "¡Hola! 👋 Soy Soni, asistente virtual de **Clínica Dental Sonrisa Perfecta**. ¿En qué puedo ayudarte hoy?" }]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [step, setStep]             = useState(STEPS.NONE);
  const [slots, setSlots]           = useState([]);
  const [calendarReady, setCalendarReady] = useState(true);
  const [booking, setBooking]       = useState({ nombre: "", servicio: "", telefono: "", slotStart: "", slotEnd: "", slotLabel: "" });
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Detectar si volvió de auth de Google
  useEffect(() => {
    if (window.location.search.includes("calendar=connected")) {
      addBot("✅ ¡Google Calendar conectado! Ahora puedo mostrarte horas disponibles en tiempo real. ¿Quieres agendar una cita?");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const addBot = (content) => setMessages(prev => [...prev, { role: "assistant", content }]);

  // ── Obtener slots de Google Calendar ──────────────────
  const fetchSlots = async () => {
    try {
      const res  = await fetch("/api/calendar/slots");
      const data = await res.json();

      if (data.error === "NOT_AUTHENTICATED" || data.error === "TOKEN_EXPIRED") {
        setCalendarReady(false);
        addBot(`Para mostrarte las horas disponibles necesito conectar con el calendario de la clínica. Un momento mientras el administrador lo autoriza... 🔗\n\n[Haz clic aquí para conectar el calendario](${data.authUrl})`);
        return false;
      }

      if (!data.slots?.length) {
        addBot("No encontré horas disponibles en los próximos días 😔 Te recomiendo llamarnos al **+56 9 8765 4321** para buscar una opción.");
        return false;
      }

      setSlots(data.slots);
      return true;
    } catch {
      addBot("Tuve un problema consultando el calendario. Por favor intenta de nuevo. 🙏");
      return false;
    }
  };

  // ── Crear cita en Google Calendar ─────────────────────
  const createBooking = async (data) => {
    try {
      const res = await fetch("/api/calendar/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      return { error: "connection_error" };
    }
  };

  // ── Flujo de agendamiento ──────────────────────────────
  const handleBooking = async (texto) => {
    setMessages(prev => [...prev, { role: "user", content: texto }]);
    setInput("");

    if (step === STEPS.NOMBRE) {
      const newB = { ...booking, nombre: texto };
      setBooking(newB);
      setStep(STEPS.SERVICIO);
      setTimeout(() => addBot("¿Qué servicio necesitas? Elige una opción 👇"), 300);

    } else if (step === STEPS.SERVICIO) {
      const newB = { ...booking, servicio: texto };
      setBooking(newB);
      setStep(STEPS.SLOTS);
      addBot("⏳ Consultando horas disponibles en el calendario...");
      const ok = await fetchSlots();
      if (ok) setTimeout(() => addBot("Elige la hora que más te acomoda 👇"), 400);

    } else if (step === STEPS.SLOTS) {
      // El slot se maneja desde los botones, no desde input

    } else if (step === STEPS.TELEFONO) {
      const newB = { ...booking, telefono: texto };
      setBooking(newB);

      // Crear evento en Google Calendar
      addBot("⏳ Confirmando tu cita en el calendario...");
      const result = await createBooking({
        nombre:    newB.nombre,
        servicio:  newB.servicio,
        telefono:  texto,
        slotStart: newB.slotStart,
        slotEnd:   newB.slotEnd,
      });

      setStep(STEPS.CONFIRMADO);

      if (result.success) {
        setTimeout(() => addBot(
          `✅ **¡Cita confirmada, ${newB.nombre}!**\n\n🦷 **Servicio:** ${newB.servicio}\n📅 **Fecha:** ${newB.slotLabel}\n📱 **WhatsApp:** ${texto}\n\nTu cita quedó registrada en nuestro calendario. ¡Te esperamos! 😊`
        ), 400);
      } else {
        setTimeout(() => addBot("Hubo un problema al confirmar la cita. Por favor llámanos al **+56 9 8765 4321** para agendar. 🙏"), 400);
      }
      setTimeout(() => { addBot("¿Puedo ayudarte con algo más?"); setStep(STEPS.NONE); }, 2500);
    }
  };

  const selectSlot = (slot) => {
    const newB = { ...booking, slotStart: slot.start, slotEnd: slot.end, slotLabel: slot.label };
    setBooking(newB);
    setMessages(prev => [...prev, { role: "user", content: slot.label }]);
    setStep(STEPS.TELEFONO);
    setSlots([]);
    setTimeout(() => addBot("¡Perfecto! ¿Cuál es tu número de WhatsApp para confirmarte? 📱"), 300);
  };

  // ── Llamada a Claude ───────────────────────────────────
  const callClaude = async (msgs) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: msgs.map(m => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || "Lo siento, hubo un problema. Intenta de nuevo.";
  };

  // ── Envío principal ────────────────────────────────────
  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;

    if (step !== STEPS.NONE && step !== STEPS.SERVICIO && step !== STEPS.SLOTS) {
      return handleBooking(userText);
    }

    if (step === STEPS.NONE && quiereAgendar(userText)) {
      setMessages(prev => [...prev, { role: "user", content: userText }]);
      setInput("");
      setStep(STEPS.NOMBRE);
      setTimeout(() => addBot("¡Perfecto! 😊 Para agendar tu cita necesito algunos datos.\n\n¿Cuál es tu **nombre completo**?"), 300);
      return;
    }

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const reply = await callClaude(newMessages);
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Hubo un error. Por favor intenta de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  const renderText = (text) =>
    text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#1a6b4e;text-decoration:underline">$1</a>')
        .replace(/\n/g, "<br/>");

  // ── UI ─────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"sans-serif", minHeight:"100vh", background:"linear-gradient(135deg,#f0f7f4,#e8f4f0)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ width:"100%", maxWidth:"440px" }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#1a6b4e,#228b67)", borderRadius:"20px 20px 0 0", padding:"18px 22px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <div style={{ width:"46px", height:"46px", borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px" }}>🦷</div>
            <div>
              <div style={{ color:"white", fontWeight:"bold", fontSize:"15px" }}>Soni — Asistente Virtual</div>
              <div style={{ color:"rgba(255,255,255,0.75)", fontSize:"12px", display:"flex", alignItems:"center", gap:"5px" }}>
                <span style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#7fffbc", display:"inline-block" }} />
                Sonrisa Perfecta · En línea
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ background:"white", height:"420px", overflowY:"auto", padding:"18px 14px", display:"flex", flexDirection:"column", gap:"12px" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display:"flex", justifyContent:msg.role==="user"?"flex-end":"flex-start", alignItems:"flex-end", gap:"8px" }}>
              {msg.role==="assistant" && (
                <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:"linear-gradient(135deg,#1a6b4e,#228b67)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", flexShrink:0 }}>🦷</div>
              )}
              <div style={{ maxWidth:"78%", padding:"10px 14px",
                borderRadius:msg.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                background:msg.role==="user"?"linear-gradient(135deg,#1a6b4e,#228b67)":"#f4faf7",
                color:msg.role==="user"?"white":"#2d4a3e", fontSize:"14px", lineHeight:"1.5",
                border:msg.role==="assistant"?"1px solid #d8f0e8":"none",
                boxShadow:msg.role==="user"?"0 2px 10px rgba(26,107,78,0.3)":"0 1px 3px rgba(0,0,0,0.07)" }}
                dangerouslySetInnerHTML={{ __html: renderText(msg.content) }}
              />
            </div>
          ))}
          {loading && (
            <div style={{ display:"flex", alignItems:"flex-end", gap:"8px" }}>
              <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:"linear-gradient(135deg,#1a6b4e,#228b67)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px" }}>🦷</div>
              <div style={{ padding:"12px 16px", background:"#f4faf7", borderRadius:"18px 18px 18px 4px", border:"1px solid #d8f0e8", display:"flex", gap:"5px" }}>
                {[0,1,2].map(i => <div key={i} style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#1a6b4e", animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Slots de Google Calendar */}
        {step === STEPS.SLOTS && slots.length > 0 && (
          <div style={{ background:"#f0faf5", borderTop:"1px solid #d0ead8", padding:"12px", display:"flex", gap:"8px", flexWrap:"wrap" }}>
            {slots.map((s, i) => (
              <button key={i} onClick={() => selectSlot(s)} style={{ padding:"8px 12px", borderRadius:"10px", border:"1.5px solid #1a6b4e", background:"white", color:"#1a6b4e", fontSize:"12px", cursor:"pointer", fontWeight:"600", fontFamily:"monospace" }}>{s.label}</button>
            ))}
          </div>
        )}

        {/* Botones servicio */}
        {step === STEPS.SERVICIO && (
          <div style={{ background:"#f9fdfc", borderTop:"1px solid #e0f0e8", padding:"10px 12px", display:"flex", gap:"6px", flexWrap:"wrap" }}>
            {SERVICIOS.map((s, i) => (
              <button key={i} onClick={() => handleBooking(s)} style={{ padding:"7px 12px", borderRadius:"20px", border:"1.5px solid #1a6b4e", background:"white", color:"#1a6b4e", fontSize:"12px", cursor:"pointer", fontWeight:"500" }}>{s}</button>
            ))}
          </div>
        )}

        {/* Quick replies */}
        {messages.length <= 2 && step === STEPS.NONE && (
          <div style={{ background:"#f9fdfc", borderTop:"1px solid #e0f0e8", padding:"10px 12px", display:"flex", gap:"6px", flexWrap:"wrap" }}>
            {quickReplies.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)} style={{ padding:"6px 11px", borderRadius:"20px", border:"1.5px solid #1a6b4e", background:"white", color:"#1a6b4e", fontSize:"12px", cursor:"pointer", fontWeight:"500" }}>{q}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ background:"white", borderRadius:"0 0 20px 20px", padding:"12px 14px", borderTop:"1px solid #e8f4ef", display:"flex", gap:"10px", alignItems:"center", boxShadow:"0 8px 30px rgba(26,107,78,0.12)" }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==="Enter" && sendMessage()}
            placeholder={step===STEPS.NOMBRE?"Escribe tu nombre...":step===STEPS.TELEFONO?"Ej: +56 9 1234 5678...":"Escribe tu consulta..."}
            disabled={loading || step===STEPS.SERVICIO || step===STEPS.SLOTS}
            style={{ flex:1, padding:"10px 16px", borderRadius:"25px", border:"1.5px solid #cce8dc", outline:"none", fontSize:"14px", background:"#f7fdf9", color:"#2d4a3e" }}
          />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim() || step===STEPS.SERVICIO || step===STEPS.SLOTS}
            style={{ width:"40px", height:"40px", borderRadius:"50%", background:input.trim()&&!loading?"linear-gradient(135deg,#1a6b4e,#228b67)":"#d0e8dc", border:"none", cursor:input.trim()&&!loading?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"17px" }}>➤</button>
        </div>

        <div style={{ textAlign:"center", marginTop:"10px", fontSize:"11px", color:"#8aaa9a" }}>
          ⚡ Powered by IA · <strong style={{ color:"#1a6b4e" }}>PymeAsistent.Chile</strong>
        </div>
      </div>

      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.7);opacity:.5}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}
