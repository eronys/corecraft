<?php
error_reporting(E_ALL);
ini_set('display_errors',1);

$url    = 'http://127.0.0.1:18443/';
$user   = 'dev';
$pass   = 'devmode';
$payload = json_encode([
  "jsonrpc" => "1.0",
  "id"      => "corecraft",
  "method"  => "getblockchaininfo",
  "params"  => []
]);

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST           => true,
  CURLOPT_POSTFIELDS     => $payload,
  CURLOPT_HTTPAUTH       => CURLAUTH_BASIC,
  CURLOPT_USERPWD        => "$user:$pass",
  CURLOPT_HTTPHEADER     => ['Content-Type: application/json']
]);

$response = curl_exec($ch);
if ($response === false) {
  die("cURL error: ".curl_error($ch));
}
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

//echo "<pre>HTTP Status: $httpCode\n\nRaw response:\n$response</pre>";


$data =json_decode($response,true);

echo"<h1>Status do Node Bitcoin</h1>";
echo"<p>Chain: " .$data["result"]["chain"] ."</p>";
echo"<p>Altura: " .$data["result"]["blocks"] ."</p>";

exit;
