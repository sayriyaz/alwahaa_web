<?php
$env_file = dirname(__DIR__) . '/.env';
if (is_readable($env_file)) {
    foreach (file($env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        if ($key !== '' && getenv($key) === false) {
            putenv($key . '=' . trim($value));
        }
    }
}

return [
    'host' => getenv('SMTP_HOST') ?: 'smtp.zoho.com',
    'port' => (int) (getenv('SMTP_PORT') ?: 587),
    'username' => getenv('SMTP_USERNAME') ?: '',
    'password' => getenv('SMTP_PASSWORD') ?: '',
    'from_email' => getenv('SMTP_FROM') ?: 'info@alwahaagroup.com',
    'from_name' => 'Alwahaa Website',
    'to_email' => getenv('CONTACT_TO') ?: 'info@alwahaagroup.com',
];
