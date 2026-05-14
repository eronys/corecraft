<?php

require_once __DIR__ . '/BitcoinRPC.php';

class BlockchainMonitor {
    private BitcoinRPC $rpc;

    public function __construct(BitcoinRPC $rpc) {
        $this->rpc = $rpc;
    }

    public function getLagInfo(): array {
        $info = $this->rpc->call('getblockchaininfo');

        $blocks = (int)($info['blocks'] ?? 0);
        $headers = (int)($info['headers'] ?? 0);
        $lag = max(0, $headers - $blocks);

        return [
            'blocks' => $blocks,
            'headers' => $headers,
            'lag' => $lag,
            'sync_progress' => $info['verificationprogress'] ?? 0.0,
            'chain' => $info['chain'] ?? 'unknown'
        ];
    }
}
