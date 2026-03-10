// api/calendar/slots.js
// Devuelve las horas disponibles del calendario del cliente

const SLOT_DURATION = 60; // duración en minutos de cada cita
const DAYS_AHEAD = 5;     // cuántos días hacia adelante mostrar

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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  let tokens = getTokensFromCookie(req);
  if (!tokens) {
    return res.status(401).json({ error: "NOT_AUTHENTICATED", authUrl: buildAuthUrl() });
  }

  // Refrescar token si expiró
  if (Date.now() >= tokens.expiry_date - 60000) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    if (refreshed.error) return res.status(401).json({ error: "TOKEN_EXPIRED", authUrl: buildAuthUrl() });
    tokens.access_token = refreshed.access_token;
    tokens.expiry_date  = Date.now() + refreshed.expires_in * 1000;
  }

  try {
    const now   = new Date();
    const end   = new Date(now);
    end.setDate(end.getDate() + DAYS_AHEAD);

    // Obtener eventos existentes del calendario
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${now.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const calData = await calRes.json();
    const busySlots = (calData.items || []).map(ev => ({
      start: new Date(ev.start.dateTime || ev.start.date),
      end:   new Date(ev.end.dateTime   || ev.end.date),
    }));

    // Generar horas disponibles (lunes a sábado, 9am-6pm)
    const available = [];
    for (let d = 0; d < DAYS_AHEAD; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() + d);
      const dayOfWeek = day.getDay();
      if (dayOfWeek === 0) continue; // no domingo

      const startHour = 9;
      const endHour   = dayOfWeek === 6 ? 13 : 18; // sábado hasta 13:00

      for (let h = startHour; h < endHour; h++) {
        const slotStart = new Date(day);
        slotStart.setHours(h, 0, 0, 0);
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + SLOT_DURATION);

        if (slotStart < now) continue;

        const isBusy = busySlots.some(
          b => slotStart < b.end && slotEnd > b.start
        );

        if (!isBusy) {
          available.push({
            id:    slotStart.toISOString(),
            label: formatSlot(slotStart),
            start: slotStart.toISOString(),
            end:   slotEnd.toISOString(),
          });
        }
      }
    }

    res.status(200).json({ slots: available.slice(0, 9) }); // máximo 9 opciones
  } catch (error) {
    console.error("Calendar error:", error);
    res.status(500).json({ error: "Error fetching calendar" });
  }
}

function formatSlot(date) {
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const day  = days[date.getDay()];
  const num  = date.getDate();
  const mon  = months[date.getMonth()];
  const hour = date.getHours().toString().padStart(2, "0");
  return `${day} ${num} ${mon} · ${hour}:00`;
}

function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id:     process.env.VITE_GOOGLE_CLIENT_ID,
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/calendar",
    access_type:   "offline",
    prompt:        "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
