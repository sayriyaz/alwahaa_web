<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$v2 = $root . '/v2';

function render_php(string $file, array $get = [], array $server = []): string
{
    $_GET = $get;
    $_POST = [];
    $_SERVER = array_merge([
        'REQUEST_METHOD' => 'GET',
        'PHP_SELF' => '/api/contact',
        'REMOTE_ADDR' => '127.0.0.1',
    ], $server);
    ob_start();
    include $file;
    return (string) ob_get_clean();
}

$contact = render_php($v2 . '/contact.php');
$contact = str_replace(
    '<div class="cform-wrap" id="form" data-reveal="left">',
    '<div class="cform-wrap" id="form" data-reveal="left"><div id="deploymentFormStatus"></div>',
    $contact
);
$contactScript = <<<'HTML'
  <script>
    (function () {
      var target = document.getElementById('deploymentFormStatus');
      if (!target) return;
      var params = new URLSearchParams(location.search);
      var copy = params.has('sent')
        ? ['form-success', 'Message sent', 'Thank you. Your enquiry has been sent to the Alwahaa desk.']
        : params.has('invalid')
          ? ['form-alert error', 'Check the form', 'Please enter your name, a valid email address and a message.']
          : params.has('error')
            ? ['form-alert error', 'Message not sent', 'Please call, WhatsApp or email us directly while email delivery is unavailable.']
            : null;
      if (copy) {
        target.className = copy[0];
        target.innerHTML = '<h2>' + copy[1] + '</h2><p>' + copy[2] + '</p>';
        target.scrollIntoView({ block: 'center' });
      }
    })();
  </script>
HTML;
$contact = str_replace('</body>', $contactScript . "\n</body>", $contact);
file_put_contents($v2 . '/contact.html', $contact);

$topics = [
    'free-zone-vs-mainland' => 'free-zone-vs-mainland-dubai.html',
    'document-attestation' => 'document-attestation-uae.html',
    'corporate-tax-vat' => 'corporate-tax-vat-uae.html',
    'family-visa-emirates-id' => 'family-visa-emirates-id-uae.html',
    'pro-services-dubai' => 'pro-services-dubai.html',
];

foreach ($topics as $topic => $filename) {
    file_put_contents($v2 . '/' . $filename, render_php($v2 . '/guide.php', ['topic' => $topic]));
}

echo "Generated Vercel static pages.\n";
