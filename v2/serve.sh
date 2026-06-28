#!/usr/bin/env bash
# Start the Alwahaa site locally WITH clean-URL routing.
# Without router.php, the PHP built-in server serves files directly and
# pretty URLs like /about, /contact, /blog fall through to the homepage.
#
# Usage:  sh serve.sh        (then open http://localhost:8080/)
cd "$(dirname "$0")" || exit 1
echo "Alwahaa dev server -> http://localhost:8080/  (Ctrl+C to stop)"
php -S localhost:8080 router.php
