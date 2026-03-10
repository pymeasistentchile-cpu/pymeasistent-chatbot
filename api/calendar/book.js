// api/calendar/book.js
// Crea el evento en Google Calendar cuando el paciente confirma la cita

function getTokensFromCookie(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/gcal_tokens=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.VITE_GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type:    "refresh_token",
    }),
  });
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  let tokens = getTokensFromCookie(req);
  if (!tokens) {
    return res.status(401).json({ error: "NOT_AUTHENTICATED" });
  }

  // Refrescar token si expiró
  if (Date.now() >= tokens.expiry_date - 60000) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    if (refreshed.error) return res.status(401).json({ error: "TOKEN_EXPIRED" });
    tokens.access_token = refreshed.access_token;
    tokens.expiry_date  = Date.now() + refreshed.expires_in * 1000;
  }

  const { nombre, servicio, telefono, slotStart, slotEnd } = req.body;

  try {
    const event = {
      summary:     `🦷 ${servicio} — ${nombre}`,
      description: `Paciente: ${nombre}\nServicio: ${servicio}\nTeléfono: ${telefono}\n\nAgendado vía PymeAsistent`,
      start: { dateTime: slotStart, timeZone: "America/Santiago" },
      end:   { dateTime: slotEnd,   timeZone: "America/Santiago" },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 30 },
          { method: "email", minutes: 1440 }, // 24 horas antes
        ],
      },
    };

    const calRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    const created = await calRes.json();

    if (created.error) {
      return res.status(400).json({ error: created.error.message });
    }

    res.status(200).json({
      success: true,
      eventId: created.id,
      eventLink: created.htmlLink,
    });
  } catch (error) {
    console.error("Book error:", error);
    res.status(500).json({ error: "Error creating event" });
  }
}
