<?php
/**
 * Bitcoin Core API - Corecraft
 * API simplificada para interação com Bitcoin Core via RPC
 */

// Configurações do Bitcoin Core RPC
define('RPC_URL', 'http://127.0.0.1:18443/');
define('RPC_USER', 'dev');
define('RPC_PASS', 'devmode');

/**
 * Função para fazer chamadas RPC ao Bitcoin Core
 * @param string $method Método RPC a ser chamado
 * @param array $params Parâmetros do método
 * @return array Resultado da chamada RPC
 * @throws Exception Em caso de erro de conexão ou RPC
 */
function rpc(string $method, array $params = []) : array {
    $payload = json_encode([
        "jsonrpc" => "1.0",
        "id"      => "corecraft",
        "method"  => $method,
        "params"  => $params
    ]);

    $ch = curl_init(RPC_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPAUTH       => CURLAUTH_BASIC,
        CURLOPT_USERPWD        => RPC_USER . ":" . RPC_PASS,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5  // Timeout de conexão
    ]);

    $response = curl_exec($ch);
    
    // Tratamento melhorado de erro de conexão
    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new Exception("Falha na conexão com Bitcoin Core: $error");
    }
    
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($response, true);
    
    // Verificação de JSON inválido
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Resposta inválida do Bitcoin Core");
    }
    
    if ($httpCode !== 200 || !is_array($data) || (isset($data['error']) && $data['error'] !== null)) {
        $errorMsg = $data['error']['message'] ?? "Erro HTTP $httpCode";
        throw new Exception("RPC falhou: $errorMsg");
    }
    
    return $data['result'];
}

/**
 * Endpoint: /api/blockchain/lag
 * Retorna informações sobre o atraso da blockchain local
 */
function api_blockchain_lag() : void {
    try {
        $blockchainInfo = rpc('getblockchaininfo');
        $networkInfo = rpc('getnetworkinfo');
        
        // Validação dos dados retornados
        if (!isset($blockchainInfo['blocks'], $blockchainInfo['headers'])) {
            throw new Exception("Dados de blockchain inválidos");
        }
        
        $localBlocks = $blockchainInfo['blocks'];
        $knownHeaders = $blockchainInfo['headers'];
        $lag = $knownHeaders - $localBlocks;
        
        $syncProgress = $knownHeaders > 0 ? ($localBlocks / $knownHeaders) : 0;
        
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            "blocks" => $localBlocks,
            "headers" => $knownHeaders,
            "lag" => $lag,
            "sync_progress" => $syncProgress,
            "chain" => $blockchainInfo['chain'] ?? 'desconhecido',
            "is_synced" => $lag <= 1,
            "network_connections" => $networkInfo['connections'] ?? 0,
            "timestamp" => date('c')
        ], JSON_PRETTY_PRINT);
        
    } catch (Exception $e) {
        throw new Exception("Erro ao obter informações da blockchain: " . $e->getMessage());
    }
}

/**
 * Endpoint: /api/mempool/summary
 * Retorna resumo estatístico da mempool
 */
function api_mempool_summary() : void {
    try {
        $mempoolInfo = rpc('getmempoolinfo');
        $raw = rpc('getrawmempool', [true]);
        
        // Validação: mempool pode estar vazia
        if (empty($raw) || !is_array($raw)) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                "tx_count" => 0,
                "total_vsize" => 0,
                "total_fee" => 0,
                "avg_fee_rate" => 0,
                "min_fee_rate" => 0,
                "max_fee_rate" => 0,
                "fee_distribution" => [
                    "low" => 0,
                    "medium" => 0,
                    "high" => 0
                ],
                "message" => "Mempool está vazia",
                "timestamp" => date('c')
            ], JSON_PRETTY_PRINT);
            return;
        }
        
        // Análise das transações na mempool
        $totalFee = 0;
        $totalVsize = 0;
        $feeRates = [];
        $distLow = 0;
        $distMedium = 0;
        $distHigh = 0;
        
        foreach ($raw as $txid => $txInfo) {
            if (!isset($txInfo['fees']['base'], $txInfo['vsize'])) {
                continue; // Pula transações com dados inválidos
            }
            
            $fee = $txInfo['fees']['base'] * 100000000; // Convert to sats
            $vsize = $txInfo['vsize'];
            
            $totalFee += $fee;
            $totalVsize += $vsize;
            
            if ($vsize > 0) {
                $rate = $fee / $vsize; // sats/vByte
                $feeRates[] = $rate; 
                
                if ($rate < 5) {
                    $distLow++;
                } elseif ($rate < 20) {
                    $distMedium++;
                } else {
                    $distHigh++;
                }
            }
        }
        
        // Cálculos estatísticos
        $txCount = count($raw);
        $avgFeeRate = $totalVsize > 0 ? $totalFee / $totalVsize : 0;
        
        sort($feeRates);
        $medianFeeRate = 0;
        if (!empty($feeRates)) {
            $middle = floor(count($feeRates) / 2);
            $medianFeeRate = count($feeRates) % 2 === 0 
                ? ($feeRates[$middle - 1] + $feeRates[$middle]) / 2
                : $feeRates[$middle];
        }
        
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            "tx_count" => $txCount,
            "total_vsize" => $totalVsize,
            "total_fee" => (int)$totalFee,
            "avg_fee_rate" => round($avgFeeRate, 2),
            "median_fee_rate" => round($medianFeeRate, 2),
            "min_fee_rate" => !empty($feeRates) ? round(min($feeRates), 2) : 0,
            "max_fee_rate" => !empty($feeRates) ? round(max($feeRates), 2) : 0,
            "fee_distribution" => [
                "low" => $distLow,
                "medium" => $distMedium,
                "high" => $distHigh
            ],
            "mempool_size_mb" => round($mempoolInfo['bytes'] / 1024 / 1024, 2),
            "timestamp" => date('c')
        ], JSON_PRETTY_PRINT);
        
    } catch (Exception $e) {
        throw new Exception("Erro ao processar mempool: " . $e->getMessage());
    }
}

/**
 * Endpoint: /api/node/info
 * Retorna informações gerais do nó Bitcoin
 */
function api_node_info() : void {
    try {
        $networkInfo = rpc('getnetworkinfo');
        $blockchainInfo = rpc('getblockchaininfo');
        $mempoolInfo = rpc('getmempoolinfo');
        
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            "version" => $networkInfo['version'] ?? 'desconhecido',
            "subversion" => $networkInfo['subversion'] ?? 'desconhecido',
            "protocol_version" => $networkInfo['protocolversion'] ?? 0,
            "connections" => $networkInfo['connections'] ?? 0,
            "network_active" => $networkInfo['networkactive'] ?? false,
            "chain" => $blockchainInfo['chain'] ?? 'desconhecido',
            "blocks" => $blockchainInfo['blocks'] ?? 0,
            "difficulty" => $blockchainInfo['difficulty'] ?? 0,
            "mempool_txs" => $mempoolInfo['size'] ?? 0,
            "mempool_bytes" => $mempoolInfo['bytes'] ?? 0,
            "timestamp" => date('c')
        ], JSON_PRETTY_PRINT);
        
    } catch (Exception $e) {
        throw new Exception("Erro ao obter informações do nó: " . $e->getMessage());
    }
}

/**
 * Roteamento principal
 */
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

try {
    switch ($path) {
        case '/api/blockchain/lag':
            api_blockchain_lag();
            break;
            
        case '/api/mempool/summary':
            api_mempool_summary();
            break;
            
        case '/api/node/info':
            api_node_info();
            break;
            
        case '/':
        case '/api':
            // Página de documentação da API
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                "name" => "Bitcoin Core API - Corecraft",
                "version" => "1.0.0",
                "description" => "API simplificada para Bitcoin Core",
                "endpoints" => [
                    "/api/blockchain/lag" => "Informações de sincronização da blockchain",
                    "/api/mempool/summary" => "Estatísticas da mempool",
                    "/api/node/info" => "Informações gerais do nó"
                ],
                "timestamp" => date('c')
            ], JSON_PRETTY_PRINT);
            break;
            
        default:
            header('Content-Type: application/json; charset=utf-8', true, 404);
            echo json_encode([
                "error" => "Endpoint não encontrado",
                "path" => $path,
                "available_endpoints" => [
                    "/api/blockchain/lag",
                    "/api/mempool/summary", 
                    "/api/node/info",
                    "/api"
                ]
            ], JSON_PRETTY_PRINT);
    }
    
} catch (Exception $e) {
    // Log do erro + resposta padronizada
    error_log("Bitcoin Core API Error: " . $e->getMessage());
    
    header('Content-Type: application/json; charset=utf-8', true, 500);
    echo json_encode([
        "error" => "Erro interno do servidor",
        "message" => $e->getMessage(),
        "timestamp" => date('c')
    ], JSON_PRETTY_PRINT);
    
} catch (Throwable $e) {
    // Captura erros fatais também
    error_log("Fatal Error: " . $e->getMessage());
    
    header('Content-Type: application/json; charset=utf-8', true, 500);
    echo json_encode([
        "error" => "Erro fatal",
        "message" => "Algo deu muito errado",
        "timestamp" => date('c')
    ], JSON_PRETTY_PRINT);
}
?>
