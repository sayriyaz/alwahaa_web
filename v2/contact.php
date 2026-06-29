<?php
session_start();

function smtp_read($socket)
{
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (isset($line[3]) && $line[3] === ' ') {
            break;
        }
    }
    return $response;
}

function smtp_expect($socket, $expected_code)
{
    $response = smtp_read($socket);
    return substr($response, 0, 3) === (string) $expected_code;
}

function smtp_command($socket, $command, $expected_code)
{
    fwrite($socket, $command . "\r\n");
    return smtp_expect($socket, $expected_code);
}

function clean_header_value($value)
{
    return trim(str_replace(["\r", "\n"], '', $value));
}

function smtp_send_mail($config, $reply_name, $reply_email, $subject, $body)
{
    $host = $config['host'];
    $port = (int) $config['port'];
    $socket = stream_socket_client(
        'tcp://' . $host . ':' . $port,
        $errno,
        $errstr,
        20,
        STREAM_CLIENT_CONNECT
    );

    if (!$socket) {
        return false;
    }

    stream_set_timeout($socket, 20);

    $from_email = clean_header_value($config['from_email']);
    $from_name = clean_header_value($config['from_name']);
    $to_email = clean_header_value($config['to_email']);
    $reply_name = clean_header_value($reply_name);
    $reply_email = clean_header_value($reply_email);
    $subject = clean_header_value($subject);

    $ok = smtp_expect($socket, 220)
        && smtp_command($socket, 'EHLO alwahaagroup.com', 250)
        && smtp_command($socket, 'STARTTLS', 220)
        && stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)
        && smtp_command($socket, 'EHLO alwahaagroup.com', 250)
        && smtp_command($socket, 'AUTH LOGIN', 334)
        && smtp_command($socket, base64_encode($config['username']), 334)
        && smtp_command($socket, base64_encode($config['password']), 235)
        && smtp_command($socket, 'MAIL FROM:<' . $from_email . '>', 250)
        && smtp_command($socket, 'RCPT TO:<' . $to_email . '>', 250)
        && smtp_command($socket, 'DATA', 354);

    if (!$ok) {
        fwrite($socket, "QUIT\r\n");
        fclose($socket);
        return false;
    }

    $headers = [
        'From: ' . $from_name . ' <' . $from_email . '>',
        'To: ' . $to_email,
        'Reply-To: ' . $reply_name . ' <' . $reply_email . '>',
        'Subject: ' . $subject,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
    ];
    $message = implode("\r\n", $headers) . "\r\n\r\n" . $body;
    $message = preg_replace('/^\./m', '..', $message);

    fwrite($socket, $message . "\r\n.\r\n");
    $sent = smtp_expect($socket, 250);
    fwrite($socket, "QUIT\r\n");
    fclose($socket);

    return $sent;
}

$message_sent = false;
$mail_sent = false;
$delivery_note = '';
$send_error = '';

if (isset($_SESSION['contact_success'])) {
    $message_sent = true;
    $name = $_SESSION['contact_success']['name'];
    $delivery_note = $_SESSION['contact_success']['delivery_note'];
    unset($_SESSION['contact_success']);
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name = trim($_POST['name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $phone = trim($_POST['phone'] ?? '');
    $message = trim($_POST['message'] ?? '');
    $honeypot = trim($_POST['company'] ?? '');
    $client_ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '-';
    $client_ip = trim(explode(',', $client_ip)[0]);
    $client_ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '-', 0, 300);

    // Honeypot: bots fill the hidden "company" field; fake a success and drop it.
    if ($honeypot !== '') {
        error_log("Spam dropped (honeypot) from {$client_ip}: {$client_ua}");
        $_SESSION['contact_success'] = [
            'name' => $name,
            'delivery_note' => 'Your message has been sent. We will get back to you shortly.'
        ];
        header('Location: ' . $_SERVER['PHP_SELF'] . '?sent=1');
        exit;
    }

    if ($name === '' || $message === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $send_error = 'Please enter your name, a valid email address, and a message.';
    } else {
        $smtp_config = require __DIR__ . '/../contact/smtp-config.php';
        $to = $smtp_config['to_email'];
        $subject = 'New website enquiry from ' . $name;
        $body = "New enquiry from the Alwahaa website:\n\n"
            . "Name: {$name}\n"
            . "Email: {$email}\n"
            . "Phone: " . ($phone !== '' ? $phone : '-') . "\n\n"
            . "Message:\n{$message}\n\n"
            . "---\n"
            . "IP: {$client_ip}\n"
            . "User-Agent: {$client_ua}\n";

        $mail_sent = smtp_send_mail($smtp_config, $name, $email, $subject, $body);

        // Local audit trail — one line per submission. Never blocks the request.
        // Stored as .php with an exit-guard: web fetches return nothing (this
        // host ignores .htaccess), but `tail`/`grep` read the lines fine.
        $log_path = __DIR__ . '/../contact/submissions.log.php';
        if (!file_exists($log_path)) {
            @file_put_contents($log_path, "<?php http_response_code(404); exit; ?>\n", LOCK_EX);
        }
        $log_line = sprintf(
            "%s\t%s\tip=%s\tname=%s\temail=%s\tphone=%s\n",
            date('c'),
            $mail_sent ? 'SENT' : 'FAILED',
            $_SERVER['REMOTE_ADDR'] ?? '-',
            str_replace(["\t", "\r", "\n"], ' ', $name),
            str_replace(["\t", "\r", "\n"], ' ', $email),
            str_replace(["\t", "\r", "\n"], ' ', $phone !== '' ? $phone : '-')
        );
        @file_put_contents($log_path, $log_line, FILE_APPEND | LOCK_EX);

        if ($mail_sent) {
            // Best-effort confirmation auto-reply to the client (never blocks success).
            $client_config = $smtp_config;
            $client_config['to_email'] = $email;
            $client_config['from_name'] = 'Alwahaa Documents Clearing';
            $autoreply_body = "Dear {$name},\n\n"
                . "Thank you for contacting Alwahaa Documents Clearing.\n"
                . "Your message has been received and our team will get back to you shortly.\n\n"
                . "Your message:\n{$message}\n\n"
                . "Warm regards,\n"
                . "Alwahaa Documents Clearing\n"
                . "+971 4 255 2895 \xC2\xB7 info@alwahaagroup.com\n"
                . "www.alwahaagroup.com\n";
            @smtp_send_mail($client_config, 'Alwahaa Documents Clearing', $smtp_config['to_email'], 'We received your enquiry — Alwahaa Documents Clearing', $autoreply_body);

            $_SESSION['contact_success'] = [
                'name' => $name,
                'delivery_note' => 'Your message has been sent to info@alwahaagroup.com. We will get back to you shortly — a confirmation has also been emailed to you.'
            ];
            header('Location: ' . $_SERVER['PHP_SELF'] . '?sent=1');
            exit;
        } else {
            $send_error = 'Sorry, email delivery is unavailable right now. Please call, WhatsApp or email us directly.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#f7f7f5" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#06080c" media="(prefers-color-scheme: dark)" />
  <title>Contact Alwahaa Documents Clearing | Dubai Business Setup &amp; PRO Services</title>
  <meta name="description" content="Contact Alwahaa Documents Clearing in Port Saeed, Deira, Dubai for company formation, visas, Emirates ID, attestation, tax and corporate PRO services." />
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />
  <link rel="canonical" href="https://www.alwahaagroup.com/contact" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Alwahaa Documents Clearing" />
  <meta property="og:title" content="Contact Alwahaa Documents Clearing in Dubai" />
  <meta property="og:description" content="Call, WhatsApp, email or visit Alwahaa's Port Saeed, Deira office for Dubai business and government services." />
  <meta property="og:url" content="https://www.alwahaagroup.com/contact" />
  <meta property="og:image" content="https://www.alwahaagroup.com/assets/img/services/svc-pro.webp" />

  <link rel="icon" type="image/x-icon" href="./assets/icons/favicon.ico" />
  <link rel="apple-touch-icon" href="./assets/icons/apple-touch-icon.png" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preconnect" href="https://cdnjs.cloudflare.com" />
  <link rel="stylesheet" href="./assets/css/main.css?v=20260627n" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": "https://www.alwahaagroup.com/contact#webpage",
    "url": "https://www.alwahaagroup.com/contact",
    "name": "Contact Alwahaa Documents Clearing",
    "about": { "@id": "https://www.alwahaagroup.com/#business" },
    "mainEntity": {
      "@type": "ProfessionalService",
      "@id": "https://www.alwahaagroup.com/#business",
      "name": "Alwahaa Documents Clearing",
      "telephone": ["+97142552895", "+971503554871", "+971502277187", "+971505095099"],
      "email": ["info@alwahaagroup.com", "alwahaadocument@gmail.com"],
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "M-01 Mezzanine Floor, Ismail Anbar Building, Opposite Al Bassam Center, Port Saeed, Deira",
        "addressLocality": "Dubai",
        "postalCode": "91270",
        "addressCountry": "AE"
      }
    },
    "inLanguage": "en-AE"
  }
  </script>

  <script>
    (function () {
      document.documentElement.classList.remove('no-js');
      try {
        var t = localStorage.getItem('aw-theme');
        if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', t);
      } catch (e) {}
    })();
  </script>
</head>

<body class="no-js">

  <div class="preloader" id="preloader" aria-hidden="true">
    <div class="preloader__inner">
      <img class="preloader__logo" src="./assets/img/logo.webp" alt="" width="64" height="74" />
      <div class="preloader__bar"><i id="pl-bar"></i></div>
      <div class="preloader__num"><span id="pl-num">0</span>%</div>
    </div>
  </div>

  <div class="atmosphere" aria-hidden="true">
    <span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>
  </div>
  <div class="noise" aria-hidden="true"></div>
  <div class="cursor-ring" aria-hidden="true"></div>
  <div class="cursor-dot" aria-hidden="true"></div>
  <div class="scroll-progress" id="scrollProgress" aria-hidden="true"></div>

  <header class="site-header" id="header">
    <nav class="nav" aria-label="Primary">
      <a class="brand" href="/" aria-label="Alwahaa Documents Clearing home">
        <img src="./assets/img/logo.webp" alt="Alwahaa Documents Clearing logo" width="30" height="35" />
        <span class="brand__txt"><span class="wahaa">Alwahaa</span><small>Document Clearing</small></span>
      </a>
      <div class="nav__links">
        <a href="/about" data-cursor>About Us</a>
        <a href="/#services" data-cursor>Services</a>
        <a href="/resources">Resources</a>
        <a href="/blog" data-cursor>Newsroom</a>
        <a href="/contact" data-cursor aria-current="page">Contact</a>
      </div>
      <div class="nav__right">
        <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle dark mode" data-cursor>
          <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
          <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>
        </button>
        <button class="menu-toggle" id="menuToggle" type="button" aria-expanded="false" aria-controls="mobileNav" aria-label="Open menu"><span></span><span></span><span></span></button>
      </div>
    </nav>
  </header>

  <div class="mobile-nav" id="mobileNav">
    <a href="/about"><span>01</span>About Us</a>
    <a href="/#services"><span>02</span>Services</a>
    <a href="/resources"><span>03</span>Resources</a>
    <a href="/blog"><span>04</span>Newsroom</a>
    <a href="/contact" aria-current="page"><span>05</span>Contact</a>
  </div>

  <main>
    <section class="contact-page" id="contact">
      <div class="container">
        <div class="sec-head" data-reveal>
          <p class="eyebrow">Start a case</p>
          <h1>Let's get your <span class="grad-text">paperwork moving.</span></h1>
          <p class="lead">Tell us what you need handled and the Alwahaa desk will guide you from the first document to the finished approval. We reply within one business day.</p>
        </div>

        <div class="contact-layout">
          <!-- Form -->
          <div class="cform-wrap" id="form" data-reveal="left">
            <?php if($message_sent): ?>
              <div class="form-success">
                <div class="tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg></div>
                <h2>Thank you, <?php echo htmlspecialchars($name); ?>!</h2>
                <p class="lead" style="margin:0 auto 1.6rem"><?php echo htmlspecialchars($delivery_note); ?></p>
                <a class="btn btn--ghost" href="/" data-magnetic data-cursor>Back to home</a>
              </div>
            <?php else: ?>
              <?php if($send_error): ?>
                <div class="form-alert error">
                  <h3>Message not sent</h3>
                  <p><?php echo htmlspecialchars($send_error); ?></p>
                </div>
              <?php endif; ?>
              <form class="cform" action="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]); ?>" method="POST">
                <div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden">
                  <label for="company">Company (leave blank)</label>
                  <input type="text" id="company" name="company" tabindex="-1" autocomplete="off" />
                </div>
                <div class="row2">
                  <div class="field">
                    <label for="name">Your name</label>
                    <input type="text" id="name" name="name" required placeholder="e.g. Abdullah" />
                  </div>
                  <div class="field">
                    <label for="phone">Phone (optional)</label>
                    <input type="tel" id="phone" name="phone" placeholder="e.g. +971 50 123 4567" />
                  </div>
                </div>
                <div class="field">
                  <label for="email">Email</label>
                  <input type="email" id="email" name="email" required placeholder="e.g. info@mail.com" />
                </div>
                <div class="field">
                  <label for="message">How can we help?</label>
                  <textarea id="message" name="message" required placeholder="Tell us what you need handled…"></textarea>
                </div>
                <button class="btn btn--gold btn--lg submit" type="submit" data-magnetic data-cursor>
                  Send message
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </button>
                <p class="cform-note">Prefer to talk now? Call <a href="tel:+97142552895" style="color:var(--gold)">+971 4 255 2895</a> or <a href="https://wa.me/971502277187" target="_blank" rel="noopener" style="color:var(--gold)">message us on WhatsApp</a>.</p>
              </form>
            <?php endif; ?>
          </div>

          <!-- Info + map -->
          <div class="contact-side" data-reveal="right">
            <div class="ci-card">
              <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg></span>
              <div><h4>Call us</h4><div class="lines"><a href="tel:+97142552895">+971 4 255 2895 <span class="muted">· Office</span></a><a href="tel:+971503554871">+971 50 355 4871</a><a href="tel:+971502277187">+971 50 227 7187</a><a href="tel:+971505095099">+971 50 509 5099</a></div></div>
            </div>
            <div class="ci-card">
              <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.2-5.5A8.5 8.5 0 1 1 21 11.5Z"/></svg></span>
              <div><h4>WhatsApp &amp; Email</h4><div class="lines"><a href="https://wa.me/971502277187" target="_blank" rel="noopener">WhatsApp +971 50 227 7187</a><a href="mailto:info@alwahaagroup.com">info@alwahaagroup.com</a><a href="mailto:alwahaadocument@gmail.com">alwahaadocument@gmail.com</a></div></div>
            </div>
            <div class="ci-card">
              <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>
              <div><h4>Visit us</h4><div class="lines"><a href="https://maps.app.goo.gl/jDmFBcpCrozWuxY5A" target="_blank" rel="noopener">M-01 Mezzanine Floor, Ismail Anbar Building, Opp. Al Bassam Center, Port Saeed, Deira, Dubai, UAE</a><span class="muted">P.O. Box 91270 · Mon–Sat 8:00 AM – 7:00 PM · Sun closed</span></div></div>
            </div>
            <div class="contact-map">
              <iframe title="Alwahaa Documents Clearing location on Google Maps" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3561.311886418894!2d55.329092900000006!3d25.260659999999994!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e5f5dd6081e38d3%3A0x841d9f74e30a7d55!2sAlwahaa%20Documents%20Clearing!5e1!3m2!1sen!2sae!4v1781075277506!5m2!1sen!2sae" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
            </div>
          </div>
        </div>

        <div class="contact-social" data-reveal>
          <span>Follow Alwahaa</span>
          <div class="social-row">
            <a href="https://www.instagram.com/alwahaa_documents_clearing/" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a>
            <a href="https://www.facebook.com/profile.php?id=61555383792308" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7h2.3l.4-2.8h-2.7V9.4c0-.8.2-1.4 1.4-1.4h1.5V5.5c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.2H7.9V14h2.4v7h3.2z"/></svg></a>
            <a href="https://x.com/al_wahaabiz" target="_blank" rel="noopener" aria-label="X"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3l-6.6 7.6L21.7 21h-6.1l-4.3-5.6L6.3 21H3.3l7-8.1L2.6 3h6.2l3.9 5.1L17.5 3zm-1.1 16h1.7L8.1 4.8H6.3L16.4 19z"/></svg></a>
            <a href="https://www.tiktok.com/@al_wahaa_biz_consultant" target="_blank" rel="noopener" aria-label="TikTok"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3c.3 2 1.6 3.6 3.5 3.9v2.4c-1.3 0-2.5-.4-3.5-1.1v5.6c0 2.9-2.1 5.2-5 5.2s-5-2.3-5-5.1 2.4-5.2 5.3-5v2.5c-1.6-.2-2.9 1-2.9 2.5 0 1.4 1 2.6 2.6 2.6 1.5 0 2.6-1.2 2.6-2.7V3H16z"/></svg></a>
            <a href="https://www.alwahaagroup.com" target="_blank" rel="noopener" aria-label="Website"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg></a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer__top">
        <div class="footer__brand">
          <a class="brand" href="/"><img src="./assets/img/logo.webp" alt="Alwahaa" width="30" height="35" /><span class="brand__txt"><span class="wahaa">Alwahaa</span><small>Document Clearing</small></span></a>
          <p>Dubai business setup, visa, attestation and PRO services — handled end to end with calm precision since 1983.</p>
        </div>
        <div class="footer__col">
          <h4>Services</h4>
          <a href="/#services">Business Setup</a>
          <a href="/#services">Visa &amp; Immigration</a>
          <a href="/#services">PRO &amp; Government</a>
          <a href="/#services">Attestation</a>
          <a href="/#services">VAT &amp; Corporate Tax</a>
        </div>
        <div class="footer__col">
          <h4>Company</h4>
          <a href="/#story">About</a>
          <a href="/#why">Why Us</a>
          <a href="/resources">Resources</a>
          <a href="/contact" aria-current="page">Contact</a>
        </div>
        <div class="footer__col">
          <h4>Get in touch</h4>
          <a href="tel:+97142552895">+971 4 255 2895</a>
          <a href="https://wa.me/971502277187" target="_blank" rel="noopener">WhatsApp +971 50 227 7187</a>
          <a href="mailto:info@alwahaagroup.com">info@alwahaagroup.com</a>
          <a href="https://maps.app.goo.gl/jDmFBcpCrozWuxY5A" target="_blank" rel="noopener">Port Saeed, Deira, Dubai, UAE</a>
          <a href="https://www.alwahaagroup.com" target="_blank" rel="noopener">www.alwahaagroup.com</a>
        </div>
      </div>
      <div class="footer__bottom">
        <p>© <span id="year">2026</span> Alwahaa Documents Clearing. All rights reserved.</p>
        <div class="footer__social">
          <a href="https://www.instagram.com/alwahaa_documents_clearing/" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></a>
          <a href="https://www.facebook.com/profile.php?id=61555383792308" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7h2.3l.4-2.8h-2.7V9.4c0-.8.2-1.4 1.4-1.4h1.5V5.5c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.2H7.9V14h2.4v7h3.2z"/></svg></a>
          <a href="https://x.com/al_wahaabiz" target="_blank" rel="noopener" aria-label="X"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3l-6.6 7.6L21.7 21h-6.1l-4.3-5.6L6.3 21H3.3l7-8.1L2.6 3h6.2l3.9 5.1L17.5 3zm-1.1 16h1.7L8.1 4.8H6.3L16.4 19z"/></svg></a>
          <a href="https://www.tiktok.com/@al_wahaa_biz_consultant" target="_blank" rel="noopener" aria-label="TikTok"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3c.3 2 1.6 3.6 3.5 3.9v2.4c-1.3 0-2.5-.4-3.5-1.1v5.6c0 2.9-2.1 5.2-5 5.2s-5-2.3-5-5.1 2.4-5.2 5.3-5v2.5c-1.6-.2-2.9 1-2.9 2.5 0 1.4 1 2.6 2.6 2.6 1.5 0 2.6-1.2 2.6-2.7V3H16z"/></svg></a>
        </div>
      </div>
    </div>
  </footer>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" defer></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js" defer></script>
  <script src="./assets/js/main.js?v=20260627m" defer></script>
</body>
</html>
