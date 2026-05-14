<?php

class BitcoinRPC {
    private string $url;
    private string $auth;
    private int $timeout;

    public function __construct(array $config) {
        $this->url = "http://{$config['host']}:{$config['port']}/";
        $this->auth = $config['user'] . ':' . $config['pass'];
        $this->timeout = $config['timeout'] ?? 30;
    }

    public function call(string $method, array $params = []): array {
        $payload = json_encode([
            "jsonrpc" => "1.0",
            "id" => "corecraft",
            "method" => $method,
            "params" => $params
        ]);

        $ch = curl_init($this->url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
            CURLOPT_USERPWD => $this->auth,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => $this->timeout
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new Exception("cURL error: $curlError");
        }

        if ($httpCode !== 200) {
            throw new Exception("HTTP error $httpCode: $response");
        }

        $data = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("JSON decode error: " . json_last_error_msg());
        }

        if (isset($data['error']) && $data['error'] !== null) {
            throw new Exception("RPC error: " . json_encode($data['error']));
        }

        return $data['result'] ?? [];
    }
}
