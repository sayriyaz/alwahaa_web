import net from "node:net";
import tls from "node:tls";

const MAX_FIELD_LENGTH = 5000;

// Verify a Cloudflare Turnstile token. Returns true when the token is valid.
async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "-") body.append("remoteip", ip);
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await resp.json();
    return data.success === true;
  } catch (error) {
    console.error("Turnstile verify failed:", error.message);
    return false;
  }
}

function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let response = "";
    const onData = (chunk) => {
      response += chunk.toString();
      const lines = response.split("\r\n").filter(Boolean);
      const last = lines.at(-1) || "";
      if (/^\d{3} /.test(last)) {
        cleanup();
        resolve(response);
      }
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function command(socket, value, expectedCode) {
  socket.write(`${value}\r\n`);
  const response = await readResponse(socket);
  if (!response.startsWith(String(expectedCode))) {
    throw new Error(`SMTP command failed with ${response.slice(0, 3)}`);
  }
}

// Send a single message over an already-authenticated SMTP session.
async function sendMessage(socket, { fromName, fromEmail, to, replyTo, subject, body }) {
  await command(socket, `MAIL FROM:<${fromEmail}>`, 250);
  await command(socket, `RCPT TO:<${to}>`, 250);
  await command(socket, "DATA", 354);
  const mail = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body.replace(/^\./gm, ".."),
    ".",
    "",
  ].join("\r\n");
  socket.write(mail);
  const result = await readResponse(socket);
  if (!result.startsWith("250")) throw new Error("SMTP server did not accept the message");
}

async function sendMail({ name, email, phone, message, ip, ua }) {
  const host = process.env.SMTP_HOST || "smtp.zoho.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const username = process.env.SMTP_USERNAME;
  const password = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM || username;
  const toEmail = process.env.CONTACT_TO || "info@alwahaagroup.com";

  if (!username || !password || !fromEmail) {
    throw new Error("SMTP environment variables are not configured");
  }

  const socket = net.createConnection({ host, port });
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });

  const greeting = await readResponse(socket);
  if (!greeting.startsWith("220")) throw new Error("SMTP server did not accept the connection");

  await command(socket, "EHLO alwahaagroup.com", 250);
  await command(socket, "STARTTLS", 220);

  const secureSocket = tls.connect({ socket, servername: host });
  await new Promise((resolve, reject) => {
    secureSocket.once("secureConnect", resolve);
    secureSocket.once("error", reject);
  });

  await command(secureSocket, "EHLO alwahaagroup.com", 250);
  await command(secureSocket, "AUTH LOGIN", 334);
  await command(secureSocket, Buffer.from(username).toString("base64"), 334);
  await command(secureSocket, Buffer.from(password).toString("base64"), 235);

  const safeName = name.replace(/[\r\n]/g, " ").trim();
  const safeEmail = email.replace(/[\r\n]/g, "").trim();

  // 1) Enquiry to the business inbox (this one must succeed).
  await sendMessage(secureSocket, {
    fromName: "Alwahaa Website",
    fromEmail,
    to: toEmail,
    replyTo: `${safeName} <${safeEmail}>`,
    subject: `New website enquiry from ${safeName}`,
    body: [
      "New enquiry from the Alwahaa website:",
      "",
      `Name: ${safeName}`,
      `Email: ${safeEmail}`,
      `Phone: ${phone || "-"}`,
      "",
      "Message:",
      message,
      "",
      "---",
      `IP: ${ip || "-"}`,
      `User-Agent: ${ua || "-"}`,
      `Received: ${new Date().toISOString()}`,
    ].join("\r\n"),
  });

  // 2) Confirmation auto-reply to the client (best effort — never fails the request).
  try {
    await command(secureSocket, "RSET", 250);
    await sendMessage(secureSocket, {
      fromName: "Alwahaa Documents Clearing",
      fromEmail,
      to: safeEmail,
      replyTo: `Alwahaa Documents Clearing <${toEmail}>`,
      subject: "We received your enquiry — Alwahaa Documents Clearing",
      body: [
        `Dear ${safeName},`,
        "",
        "Thank you for contacting Alwahaa Documents Clearing.",
        "Your message has been received and our team will get back to you shortly.",
        "",
        "Your message:",
        message,
        "",
        "Warm regards,",
        "Alwahaa Documents Clearing",
        "+971 4 255 2895 · info@alwahaagroup.com",
        "www.alwahaagroup.com",
      ].join("\r\n"),
    });
  } catch (autoReplyError) {
    console.error("Auto-reply to client failed (non-fatal):", autoReplyError.message);
  }

  secureSocket.write("QUIT\r\n");
  secureSocket.end();
}

function redirect(res, state, params = {}) {
  const query = new URLSearchParams({ [state]: "1", ...params }).toString();
  res.statusCode = 303;
  res.setHeader("Location", `/contact?${query}`);
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const name = String(req.body?.name || "").trim().slice(0, 200);
  const email = String(req.body?.email || "").trim().slice(0, 320);
  const phone = String(req.body?.phone || "").trim().slice(0, 80);
  const message = String(req.body?.message || "").trim().slice(0, MAX_FIELD_LENGTH);
  const honeypot = String(req.body?.company || "").trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Client IP / agent — Vercel sets x-forwarded-for; first hop is the real client.
  const ip =
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    String(req.headers["x-real-ip"] || "").trim() ||
    req.socket?.remoteAddress ||
    "-";
  const ua = String(req.headers["user-agent"] || "-").slice(0, 300);

  // Honeypot: real users never fill the hidden "company" field — bots do.
  // Silently accept (fake success) so spam bots don't learn they were blocked.
  if (honeypot) {
    console.warn(`Spam dropped (honeypot) from ${ip}: ${ua}`);
    return redirect(res, "sent", { name: name.slice(0, 60) });
  }

  if (!name || !emailValid || !message) {
    return redirect(res, "invalid");
  }

  // Cloudflare Turnstile — only enforced when the secret is configured, so the
  // form keeps working if keys are ever missing. Set TURNSTILE_SECRET in Vercel.
  const turnstileSecret = process.env.TURNSTILE_SECRET;
  if (turnstileSecret) {
    const token = String(req.body?.["cf-turnstile-response"] || "");
    const human = await verifyTurnstile(turnstileSecret, token, ip);
    if (!human) {
      console.warn(`Turnstile rejected submission from ${ip}: ${ua}`);
      return redirect(res, "invalid");
    }
  }

  try {
    await sendMail({ name, email, phone, message, ip, ua });
    return redirect(res, "sent", { name: name.slice(0, 60) });
  } catch (error) {
    console.error("Contact form delivery failed:", error.message);
    return redirect(res, "error");
  }
}
