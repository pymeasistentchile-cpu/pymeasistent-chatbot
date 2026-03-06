import { useState, useRef, useEffect } from "react";

// ─── Configuración EmailJS ───────────────────────────────
// Reemplaza estos valores con los tuyos de emailjs.com
const EMAILJS_SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

const SYSTEM_PROMPT = `Eres el asistente virtual de "Clínica Dental Sonrisa Perfecta". Tu nombre es Soni.

INFORMACIÓN DE LA CLÍNICA:
- Horario: Lunes a Viernes 9:00am - 7:00pm, Sábados 9:00am - 2:00pm
- Teléfono: +56 9 8765 4321
- Dirección: Av. Providencia 1234, Santiago
- Servicios: Limpieza dental ($25.000), Blanqueamiento ($80.000), Ortodoncia (desde $350.000), Implantes (desde $450.000), Urgencias dentales, Revisión general ($15.000)
- Seguros: Fonasa, Banmédica, Cruz Blanca, Consalud, Colmena

PERSONALIDAD: Cálido, profesional, respuestas cortas (máximo 3 líneas), español chileno natural, emojis con moderación.`;

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

// Estados del flujo de agendamiento
const BOOKING_STEPS = {
  NONE: "none",
  NOMBRE: "nombre",
  SERVICIO: "servicio",
  FECHA: "fecha",
  TELEFONO: "telefono",
  CONFIRMADO: "confirmado",
};

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "¡Hola! 👋 Soy Soni, asistente virtual de **Clínica Dental Sonrisa Perfecta**. ¿En qué puedo ayudarte hoy?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookingStep, setBookingStep] = useState(BOOKING_STEPS.NONE);
  const [bookingData, setBookingData] = useState({ nombre: "", servicio: "", fecha: "", telefono: "" });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Agregar mensaje del bot ───────────────────────────
  const addBotMessage = (content) => {
    setMessages((prev) => [...prev, { role: "assistant", content }]);
  };

  // ─── Enviar email con EmailJS REST API ────────────────
  const enviarEmail = async (datos) => {
    try {
      await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id:  EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id:     EMAILJS_PUBLIC_KEY,
          template_params: {
            paciente_nombre:   datos.nombre,
            servicio_elegido:  datos.servicio,
            fecha_preferida:   datos.fecha,
            paciente_telefono: datos.telefono,
            to_email:          "pymeasistentchile@gmail.com",
          },
        }),
      });
    } catch (err) {
      console.error("Error enviando email:", err);
    }
  };

  // ─── Flujo de agendamiento paso a paso ────────────────
  const handleBookingInput = async (texto) => {
    setMessages((prev) => [...prev, { role: "user", content: texto }]);
    setInput("");

    if (bookingStep === BOOKING_STEPS.NOMBRE) {
      const newData = { ...bookingData, nombre: texto };
      setBookingData(newData);
      setBookingStep(BOOKING_STEPS.SERVICIO);
      setTimeout(() => addBotMessage("¿Qué servicio necesitas? Elige una opción 👇"), 400);

    } else if (bookingStep === BOOKING_STEPS.SERVICIO) {
      const newData = { ...bookingData, servicio: texto };
      setBookingData(newData);
      setBookingStep(BOOKING_STEPS.FECHA);
      setTimeout(() => addBotMessage(
        "¿Qué día y hora te acomoda? 📅\nAtendemos lunes a viernes 9am–7pm y sábados 9am–2pm.\n\nEj: *Jueves 15 de enero a las 15:00*"
      ), 400);

    } else if (bookingStep === BOOKING_STEPS.FECHA) {
      const newData = { ...bookingData, fecha: texto };
      setBookingData(newData);
      setBookingStep(BOOKING_STEPS.TELEFONO);
      setTimeout(() => addBotMessage("¿Cuál es tu número de WhatsApp para confirmar la cita? 📱"), 400);

    } else if (bookingStep === BOOKING_STEPS.TELEFONO) {
      const newData = { ...bookingData, telefono: texto };
      setBookingData(newData);
      setBookingStep(BOOKING_STEPS.CONFIRMADO);

      // Enviar email
      await enviarEmail(newData);

      setTimeout(() => addBotMessage(
        `✅ **¡Listo, ${newData.nombre}!** Recibimos tu solicitud:\n\n🦷 **Servicio:** ${newData.servicio}\n📅 **Fecha preferida:** ${newData.fecha}\n📱 **WhatsApp:** ${newData.telefono}\n\nTe contactaremos pronto para confirmar tu hora. ¡Hasta pronto! 😊`
      ), 400);

      setTimeout(() => {
        addBotMessage("¿Hay algo más en que te pueda ayudar?");
        setBookingStep(BOOKING_STEPS.NONE);
      }, 2000);
    }
  };

  // ─── Detectar intención de agendar ────────────────────
  const quiereAgendar = (texto) => {
    const t = texto.toLowerCase();
    return ["agendar", "cita", "reservar", "hora", "appointment", "turno", "quiero una hora", "necesito una hora"].some(k => t.includes(k));
  };

  // ─── Llamada a Claude API ──────────────────────────────
  const callClaude = async (msgs) => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await response.json();
    return data.content?.[0]?.text || "Lo siento, hubo un problema. Intenta de nuevo.";
  };

  // ─── Envío principal ───────────────────────────────────
  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;

    // Si estamos en flujo de agendamiento
    if (bookingStep !== BOOKING_STEPS.NONE && bookingStep !== BOOKING_STEPS.SERVICIO) {
      return handleBookingInput(userText);
    }

    // Detectar intención de agendar antes de llamar a Claude
    if (bookingStep === BOOKING_STEPS.NONE && quiereAgendar(userText)) {
      setMessages((prev) => [...prev, { role: "user", content: userText }]);
      setInput("");
      setBookingStep(BOOKING_STEPS.NOMBRE);
      setTimeout(() => addBotMessage("¡Perfecto! 😊 Para agendar tu cita necesito algunos datos.\n\n¿Cuál es tu **nombre completo**?"), 300);
      return;
    }

    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const reply = await callClaude(newMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Hubo un error. Por favor intenta de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  const renderText = (text) =>
    text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br/>");

  // ─── UI ───────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "sans-serif", minHeight: "100vh",
      background: "linear-gradient(135deg, #f0f7f4, #e8f4f0)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <div style={{ width: "100%", maxWidth: "440px" }}>

        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1a6b4e, #228b67)",
          borderRadius: "20px 20px 0 0", padding: "18px 22px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "46px", height: "46px", borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px",
            }}>🦷</div>
            <div>
              <div style={{ color: "white", fontWeight: "bold", fontSize: "15px" }}>Soni — Asistente Virtual</div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#7fffbc", display: "inline-block" }} />
                Sonrisa Perfecta · En línea
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          background: "white", height: "420px", overflowY: "auto",
          padding: "18px 14px", display: "flex", flexDirection: "column", gap: "12px",
        }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              alignItems: "flex-end", gap: "8px",
            }}>
              {msg.role === "assistant" && (
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #1a6b4e, #228b67)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "13px", flexShrink: 0,
                }}>🦷</div>
              )}
              <div
                style={{
                  maxWidth: "78%", padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: msg.role === "user" ? "linear-gradient(135deg, #1a6b4e, #228b67)" : "#f4faf7",
                  color: msg.role === "user" ? "white" : "#2d4a3e",
                  fontSize: "14px", lineHeight: "1.5",
                  border: msg.role === "assistant" ? "1px solid #d8f0e8" : "none",
                  boxShadow: msg.role === "user" ? "0 2px 10px rgba(26,107,78,0.3)" : "0 1px 3px rgba(0,0,0,0.07)",
                }}
                dangerouslySetInnerHTML={{ __html: renderText(msg.content) }}
              />
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%",
                background: "linear-gradient(135deg, #1a6b4e, #228b67)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px",
              }}>🦷</div>
              <div style={{
                padding: "12px 16px", background: "#f4faf7",
                borderRadius: "18px 18px 18px 4px", border: "1px solid #d8f0e8",
                display: "flex", gap: "5px", alignItems: "center",
              }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: "7px", height: "7px", borderRadius: "50%", background: "#1a6b4e",
                    animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Botones de servicio durante agendamiento */}
        {bookingStep === BOOKING_STEPS.SERVICIO && (
          <div style={{
            background: "#f9fdfc", borderTop: "1px solid #e0f0e8",
            padding: "10px 12px", display: "flex", gap: "6px", flexWrap: "wrap",
          }}>
            {SERVICIOS.map((s, i) => (
              <button key={i} onClick={() => handleBookingInput(s)} style={{
                padding: "7px 12px", borderRadius: "20px",
                border: "1.5px solid #1a6b4e", background: "white",
                color: "#1a6b4e", fontSize: "12px", cursor: "pointer", fontWeight: "500",
              }}>{s}</button>
            ))}
          </div>
        )}

        {/* Quick replies iniciales */}
        {messages.length <= 2 && bookingStep === BOOKING_STEPS.NONE && (
          <div style={{
            background: "#f9fdfc", borderTop: "1px solid #e0f0e8",
            padding: "10px 12px", display: "flex", gap: "6px", flexWrap: "wrap",
          }}>
            {quickReplies.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)} style={{
                padding: "6px 11px", borderRadius: "20px",
                border: "1.5px solid #1a6b4e", background: "white",
                color: "#1a6b4e", fontSize: "12px", cursor: "pointer", fontWeight: "500",
              }}>{q}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          background: "white", borderRadius: "0 0 20px 20px",
          padding: "12px 14px", borderTop: "1px solid #e8f4ef",
          display: "flex", gap: "10px", alignItems: "center",
          boxShadow: "0 8px 30px rgba(26,107,78,0.12)",
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder={
              bookingStep === BOOKING_STEPS.NOMBRE ? "Escribe tu nombre completo..." :
              bookingStep === BOOKING_STEPS.FECHA   ? "Ej: Jueves 15 enero a las 15:00..." :
              bookingStep === BOOKING_STEPS.TELEFONO? "Ej: +56 9 1234 5678..." :
              "Escribe tu consulta..."
            }
            disabled={loading || bookingStep === BOOKING_STEPS.SERVICIO}
            style={{
              flex: 1, padding: "10px 16px", borderRadius: "25px",
              border: "1.5px solid #cce8dc", outline: "none",
              fontSize: "14px", background: "#f7fdf9", color: "#2d4a3e",
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim() || bookingStep === BOOKING_STEPS.SERVICIO}
            style={{
              width: "40px", height: "40px", borderRadius: "50%",
              background: input.trim() && !loading ? "linear-gradient(135deg, #1a6b4e, #228b67)" : "#d0e8dc",
              border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "17px", flexShrink: 0,
            }}
          >➤</button>
        </div>

        <div style={{ textAlign: "center", marginTop: "10px", fontSize: "11px", color: "#8aaa9a" }}>
          ⚡ Powered by IA · <strong style={{ color: "#1a6b4e" }}>PymeAsistent.Chile</strong>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
