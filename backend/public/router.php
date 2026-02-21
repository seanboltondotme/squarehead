<?php
/**
 * Router for production: serve /api via Slim, everything else as static or SPA index.
 * Use with: php -S 0.0.0.0:PORT -t public public/router.php
 */
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// API requests go to Slim
if (strpos($uri, '/api') === 0) {
    require __DIR__ . '/index.php';
    return;
}

// Static file: only serve if it exists and is under public (no path traversal)
$file = __DIR__ . $uri;
if ($uri !== '' && $uri !== '/' && file_exists($file) && is_file($file)) {
    $real = realpath($file);
    if ($real !== false && strpos($real, __DIR__) === 0) {
        return false; // let PHP built-in server serve the file
    }
}

// SPA fallback
$index = __DIR__ . '/index.html';
if (file_exists($index)) {
    header('Content-Type: text/html');
    readfile($index);
    return;
}

// No index.html (e.g. dev without frontend build) — 404
http_response_code(404);
echo 'Not found';
