<?php

return [
    'rpc' => [
        'host' => '127.0.0.1',
        'port' => 38332,
        'user' => 'dev',
        'pass' => 'devmode',
        'timeout' => 30
    ],
    'mempool' => [
        'fee_thresholds' => [
            'low_max' => 10.0,    // < 10 sat/vB
            'medium_max' => 50.0  // 10-50 sat/vB, >50 = high
        ]
    ]
];
