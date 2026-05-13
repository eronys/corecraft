<?php
// router.php para o servidor embutido do PHP

// Pega o caminho requisitado
$path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);

if ($path === '/' || $path === '') {
    $path = '/index.html';
}

$publicPath = __DIR__ . '/public' . $path;

// Se o arquivo existir na pasta public (ex: css, js, imagens, html), serve com o MIME type correto
if (file_exists($publicPath) && is_file($publicPath)) {
    $ext = pathinfo($publicPath, PATHINFO_EXTENSION);
    $mimeTypes = [
        'css' => 'text/css',
        'js'  => 'application/javascript',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'html'=> 'text/html',
        'json'=> 'application/json'
    ];
    if (isset($mimeTypes[$ext])) {
        header('Content-Type: ' . $mimeTypes[$ext]);
    }
    readfile($publicPath);
    return true;
}

// Se a rota for para a API, redireciona para o index.php da API
if (preg_match('#^/api/?#', $path)) {
    $_SERVER["SCRIPT_NAME"] = '/api/index.php';
    require __DIR__ . '/public/api/index.php';
    return true;
}

// Fallback: serve o index.html principal
require __DIR__ . '/public/index.html';
