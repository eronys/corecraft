<?php

require_once __DIR__ . '/BitcoinRPC.php';

class MempoolAnalyzer {
    private BitcoinRPC $rpc;
    private array $feeThresholds;

    public function __construct(BitcoinRPC $rpc, array $feeThresholds) {
        $this->rpc = $rpc;
        $this->feeThresholds = $feeThresholds;
    }

    public function getSummary(): array {
        $mempoolInfo = $this->rpc->call('getmempoolinfo');
        $rawMempool = $this->rpc->call('getrawmempool', [true]);

        $stats = $this->calculateStats($rawMempool);
        
        return [
            'tx_count' => $stats['count'],
            'total_vsize' => $stats['total_vsize'],
            'avg_fee_rate' => round($stats['avg_fee_rate'], 2),
            'min_fee_rate' => round($stats['min_fee_rate'], 2),
            'max_fee_rate' => round($stats['max_fee_rate'], 2),
            'fee_distribution' => $stats['distribution'],
            'mempoolinfo' => [
                'size' => $mempoolInfo['size'] ?? 0,
                'bytes' => $mempoolInfo['bytes'] ?? 0,
                'total_fee_btc' => $mempoolInfo['total_fee'] ?? 0.0
            ]
        ];
    }

    private function calculateStats(array $rawMempool): array {
        $count = 0;
        $totalVsize = 0;
        $feeRateSum = 0.0;
        $minFeeRate = null;
        $maxFeeRate = null;
        $distribution = ['low' => 0, 'medium' => 0, 'high' => 0];

        foreach ($rawMempool as $txid => $entry) {
            $vsize = (int)($entry['vsize'] ?? 0);
            $feeBtc = (float)($entry['fees']['base'] ?? 0.0);

            if ($vsize <= 0) continue;

            $feeSat = $feeBtc * 100_000_000;
            $feeRate = $feeSat / $vsize; // sat/vB

            $count++;
            $totalVsize += $vsize;
            $feeRateSum += $feeRate;

            $minFeeRate = $minFeeRate === null ? $feeRate : min($minFeeRate, $feeRate);
            $maxFeeRate = $maxFeeRate === null ? $feeRate : max($maxFeeRate, $feeRate);

            $bucket = $this->classifyFeeRate($feeRate);
            $distribution[$bucket]++;
        }

        return [
            'count' => $count,
            'total_vsize' => $totalVsize,
            'avg_fee_rate' => $count > 0 ? $feeRateSum / $count : 0.0,
            'min_fee_rate' => $minFeeRate ?? 0.0,
            'max_fee_rate' => $maxFeeRate ?? 0.0,
            'distribution' => $distribution
        ];
    }

    private function classifyFeeRate(float $feeRate): string {
        if ($feeRate < $this->feeThresholds['low_max']) {
            return 'low';
        }
        if ($feeRate <= $this->feeThresholds['medium_max']) {
            return 'medium';
        }
        return 'high';
    }
}
