// api/auth/callback.js
// Recibe el código de autorización de Google y lo intercambia por tokens

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "No authorization code provided" });
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.VITE_GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
        grant_type:    "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
      return res.status(400).json({ error: tokens.error });
    }

    // Guardamos los tokens en una cookie segura (httpOnly)
    const cookieValue = JSON.stringify({
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date:   Date.now() + tokens.expires_in * 1000,
    });

    res.setHeader("Set-Cookie", `gcal_tokens=${encodeURIComponent(cookieValue)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
    res.redirect("/?calendar=connected");
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}
