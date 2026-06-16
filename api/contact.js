import net from "node:net";
import tls from "node:tls";

const MAX_FIELD_LENGTH = 5000;

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

async function sendMail({ name, email, phone, message }) {
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
  await command(secureSocket, `MAIL FROM:<${fromEmail}>`, 250);
  await command(secureSocket, `RCPT TO:<${toEmail}>`, 250);
  await command(secureSocket, "DATA", 354);

  const safeName = name.replace(/[\r\n]/g, " ").trim();
  const safeEmail = email.replace(/[\r\n]/g, "").trim();
  const subject = `New website enquiry from ${safeName}`;
  const body = [
    "New enquiry from the Alwahaa website:",
    "",
    `Name: ${safeName}`,
    `Email: ${safeEmail}`,
    `Phone: ${phone || "-"}`,
    "",
    "Message:",
    message,
  ].join("\r\n");
  const mail = [
    `From: Alwahaa Website <${fromEmail}>`,
    `To: ${toEmail}`,
    `Reply-To: ${safeName} <${safeEmail}>`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body.replace(/^\./gm, ".."),
    ".",
    "",
  ].join("\r\n");

  secureSocket.write(mail);
  const result = await readResponse(secureSocket);
  secureSocket.write("QUIT\r\n");
  secureSocket.end();
  if (!result.startsWith("250")) throw new Error("SMTP server did not accept the message");
}

function redirect(res, state) {
  res.statusCode = 303;
  res.setHeader("Location", `/contact?${state}=1`);
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
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!name || !emailValid || !message) {
    return redirect(res, "invalid");
  }

  try {
    await sendMail({ name, email, phone, message });
    return redirect(res, "sent");
  } catch (error) {
    console.error("Contact form delivery failed:", error.message);
    return redirect(res, "error");
  }
}
