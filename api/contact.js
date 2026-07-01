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

// RFC 2047 encode a subject so non-ASCII characters survive.
function encodeSubject(subject) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

// Send a single message over an already-authenticated SMTP session.
// Pass `html` to send a multipart/alternative (HTML + plain-text fallback).
async function sendMessage(socket, { fromName, fromEmail, to, replyTo, subject, text, html }) {
  await command(socket, `MAIL FROM:<${fromEmail}>`, 250);
  await command(socket, `RCPT TO:<${to}>`, 250);
  await command(socket, "DATA", 354);

  const headers = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
  ];

  let bodyBlock;
  if (html) {
    const boundary = `aw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    bodyBlock = [
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      text || "",
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      html,
      "",
      `--${boundary}--`,
      "",
    ].join("\r\n");
  } else {
    headers.push("Content-Type: text/plain; charset=UTF-8");
    bodyBlock = ["", text || "", ""].join("\r\n");
  }

  const raw = (headers.join("\r\n") + "\r\n" + bodyBlock).replace(/^\./gm, "..");
  socket.write(raw + "\r\n.\r\n");
  const result = await readResponse(socket);
  if (!result.startsWith("250")) throw new Error("SMTP server did not accept the message");
}

// --- Branded HTML email templates -------------------------------------------

const BRAND = {
  logo: "https://www.alwahaagroup.com/assets/img/logo.png",
  gold: "#b08d3a",
  ink: "#0a1830",
  site: "https://www.alwahaagroup.com",
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailShell(inner) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f2">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Alwahaa Documents Clearing</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:28px 12px;font-family:'Segoe UI',Arial,Helvetica,sans-serif">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #ececec;border-radius:16px;overflow:hidden">
        <tr><td style="padding:22px 30px;border-bottom:1px solid #f0f0ee">
          <table role="presentation" width="100%"><tr>
            <td style="vertical-align:middle"><img src="${BRAND.logo}" width="42" height="48" alt="Alwahaa" style="display:block;border:0"></td>
            <td align="right" style="vertical-align:middle;font-size:15px;font-weight:700;color:${BRAND.ink};letter-spacing:.2px">Alwahaa <span style="color:${BRAND.gold}">Documents Clearing</span></td>
          </tr></table>
        </td></tr>
        ${inner}
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="padding:18px 30px;text-align:center;color:#9ca3af;font-size:11px;line-height:1.7">
          Alwahaa Documents Clearing · Port Saeed, Deira, Dubai, UAE<br>
          +971 4 255 2895 · <a href="mailto:info@alwahaagroup.com" style="color:#9ca3af">info@alwahaagroup.com</a> · <a href="${BRAND.site}" style="color:${BRAND.gold};text-decoration:none">www.alwahaagroup.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

// Internal notification to the business inbox.
function enquiryHtml({ name, email, phone, message, ip, ua }) {
  const row = (label, value) =>
    `<tr><td style="padding:11px 0;border-bottom:1px solid #eee;color:#6b7280;font-size:13px;width:96px;vertical-align:top">${label}</td>
      <td style="padding:11px 0;border-bottom:1px solid #eee;color:#111827;font-size:14px;font-weight:600">${value}</td></tr>`;
  return emailShell(`
    <tr><td style="padding:30px">
      <div style="display:inline-block;background:rgba(176,141,58,.12);color:${BRAND.gold};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:6px 12px;border-radius:999px">New enquiry</div>
      <h1 style="margin:14px 0 2px;font-size:21px;color:${BRAND.ink}">New website enquiry</h1>
      <p style="margin:0 0 22px;color:#6b7280;font-size:13px">Submitted through the alwahaagroup.com contact form</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row("Name", escapeHtml(name))}
        ${row("Email", `<a href="mailto:${escapeHtml(email)}" style="color:${BRAND.gold};text-decoration:none">${escapeHtml(email)}</a>`)}
        ${row("Phone", phone ? `<a href="tel:${escapeHtml(phone)}" style="color:#111827;text-decoration:none">${escapeHtml(phone)}</a>` : "—")}
      </table>
      <div style="margin-top:22px">
        <div style="color:#6b7280;font-size:13px;margin-bottom:8px">Message</div>
        <div style="background:#f7f7f5;border-left:3px solid ${BRAND.gold};padding:14px 16px;border-radius:8px;color:#111827;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(message)}</div>
      </div>
      <div style="margin-top:26px">
        <a href="mailto:${escapeHtml(email)}" style="background:${BRAND.gold};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:700;display:inline-block">Reply to ${escapeHtml(name)}</a>
      </div>
    </td></tr>
    <tr><td style="padding:14px 30px;background:#fafafa;border-top:1px solid #eee;color:#9ca3af;font-size:11px;line-height:1.7">
      <strong style="color:#9ca3af">Sender details</strong><br>
      IP: ${escapeHtml(ip || "-")} · ${new Date().toUTCString()}<br>
      ${escapeHtml(ua || "-")}
    </td></tr>`);
}

// Confirmation auto-reply to the client.
function autoReplyHtml({ name, message }) {
  return emailShell(`
    <tr><td style="padding:30px">
      <h1 style="margin:0 0 6px;font-size:21px;color:${BRAND.ink}">Thank you for your enquiry</h1>
      <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.6">Dear ${escapeHtml(name)},</p>
      <p style="margin:0 0 18px;color:#374151;font-size:15px;line-height:1.6">Thank you for contacting <strong>Alwahaa Documents Clearing</strong>. Your message has been received and our team will get back to you shortly — usually within one business day.</p>
      <div style="margin:0 0 22px">
        <div style="color:#6b7280;font-size:13px;margin-bottom:8px">Your message</div>
        <div style="background:#f7f7f5;border-left:3px solid ${BRAND.gold};padding:14px 16px;border-radius:8px;color:#111827;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(message)}</div>
      </div>
      <div style="border-top:1px solid #eee;padding-top:20px">
        <div style="color:#6b7280;font-size:13px;margin-bottom:10px">Need to reach us sooner?</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;color:#111827">
          <tr><td style="padding:3px 0">📞 <a href="tel:+97142552895" style="color:#111827;text-decoration:none">+971 4 255 2895</a></td></tr>
          <tr><td style="padding:3px 0">💬 <a href="https://wa.me/971502277187" style="color:#111827;text-decoration:none">WhatsApp +971 50 227 7187</a></td></tr>
          <tr><td style="padding:3px 0">📍 Port Saeed, Deira, Dubai, UAE</td></tr>
        </table>
      </div>
      <div style="margin-top:26px">
        <a href="${BRAND.site}" style="background:${BRAND.ink};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:700;display:inline-block">Visit our website</a>
      </div>
      <p style="margin:24px 0 0;color:#6b7280;font-size:14px;line-height:1.6">Warm regards,<br><strong style="color:${BRAND.ink}">Alwahaa Documents Clearing</strong></p>
    </td></tr>`);
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
    text: [
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
    html: enquiryHtml({ name: safeName, email: safeEmail, phone, message, ip, ua }),
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
      text: [
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
      html: autoReplyHtml({ name: safeName, message }),
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

export { enquiryHtml, autoReplyHtml };
