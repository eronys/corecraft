class BitcoinDashboard {
    constructor() {
        this.apiBase = '/api';
        this.zmqBase = 'http://localhost:8001/api';
        this.activeWallet = null;
        this.trackedTxs = new Map(); // Para rastrear as transações enviadas
        this.init();
    }

    async init() {
        await this.loadWallets();
        await this.loadData();
        
        // Configura botão de transação
        const btnTx = document.getElementById('btn-generate-tx');
        if (btnTx) {
            btnTx.addEventListener('click', () => this.generateRandomTx());
        }
        
        setInterval(() => this.loadData(), 30000); // Atualiza a cada 30s
    }
        setInterval(() => this.loadData(), 30000); // Atualiza a cada 30s
    }

    async loadData() {
        try {
            const [syncData, mempoolData] = await Promise.all([
                this.fetchAPI('/blockchain/lag'),
                this.fetchAPI('/mempool/summary')
            ]);

            this.renderSyncStatus(syncData);
            this.renderMempoolIntelligence(mempoolData);
            this.renderRawData({ sync: syncData, mempool: mempoolData });

            // ZMQ API (Port 8001)
            await this.loadZmqData();
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.showError('Erro de conexão com a API');
        }
    }

    async fetchAPI(endpoint) {
        const response = await fetch(this.apiBase + endpoint);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }

    async fetchZmqAPI(endpoint) {
        const response = await fetch(this.zmqBase + endpoint);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }

    async loadZmqData() {
        try {
            const [summary, latest, comparison] = await Promise.all([
                this.fetchZmqAPI('/events/summary'),
                this.fetchZmqAPI('/events/latest'),
                this.fetchZmqAPI('/events/state-comparison')
            ]);

            this.renderZmqActivity(summary);
            this.renderZmqLatest(latest);
            this.renderZmqDivergence(comparison);
        } catch (error) {
            console.error('Erro ao carregar dados ZMQ:', error);
            document.querySelectorAll('.zmq-dashboard .loading').forEach(el => {
                el.innerHTML = `⚠️ Backend ZMQ indisponível (Porta 8001)`;
            });
        }
    }

    async loadWallets() {
        try {
            const data = await this.fetchZmqAPI('/wallets');
            const select = document.getElementById('wallet-select');
            select.innerHTML = '';
            
            if (data.available_wallets.length === 0) {
                select.innerHTML = '<option value="">Nenhuma carteira encontrada</option>';
                return;
            }
            
            data.available_wallets.forEach(w => {
                const opt = document.createElement('option');
                opt.value = w;
                opt.textContent = w;
                select.appendChild(opt);
            });
            
            select.addEventListener('change', (e) => this.selectWallet(e.target.value));
            
            // Seleciona a primeira carregada, ou a primeira da lista
            let defaultWallet = data.loaded_wallets.length > 0 ? data.loaded_wallets[0] : data.available_wallets[0];
            select.value = defaultWallet;
            await this.selectWallet(defaultWallet);
            
        } catch (error) {
            console.error('Erro ao carregar carteiras:', error);
            document.getElementById('wallet-select').innerHTML = '<option value="">Erro ao carregar carteiras</option>';
        }
    }

    async selectWallet(walletName) {
        this.activeWallet = walletName;
        document.getElementById('wallet-info').innerHTML = 'Carregando status...';
        document.getElementById('btn-generate-tx').disabled = true;
        
        try {
            await fetch(this.zmqBase + '/wallet/select', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: walletName })
            });
            
            const status = await this.fetchZmqAPI(`/wallet/status?wallet=${walletName}`);
            document.getElementById('wallet-info').innerHTML = `
                Saldo: <strong>${status.balance} BTC</strong><br>
                UTXOs disponíveis: <strong>${status.utxos}</strong>
            `;
            
            if (status.balance > 0) {
                document.getElementById('btn-generate-tx').disabled = false;
            } else {
                document.getElementById('btn-generate-tx').disabled = true;
                document.getElementById('wallet-info').innerHTML += '<br><small style="color: #ffaa00;">Sem saldo para transacionar.</small>';
            }
        } catch (error) {
            console.error('Erro ao selecionar carteira:', error);
            document.getElementById('wallet-info').innerHTML = 'Erro ao consultar saldo.';
        }
    }

    async generateRandomTx() {
        if (!this.activeWallet) return;
        
        const btn = document.getElementById('btn-generate-tx');
        btn.disabled = true;
        btn.textContent = 'Gerando...';
        
        try {
            const res = await fetch(this.zmqBase + '/tx/random', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: this.activeWallet })
            });
            const data = await res.json();
            
            if (data.success && data.txid) {
                this.trackTx(data.txid, this.activeWallet);
            } else {
                alert('Erro ao gerar transação: ' + (data.error || 'Desconhecido'));
            }
        } catch (error) {
            console.error('Erro ao gerar tx:', error);
        } finally {
            btn.textContent = 'Gerar Transação Aleatória';
            this.selectWallet(this.activeWallet); // Atualiza o saldo
        }
    }

    trackTx(txid, walletName) {
        this.trackedTxs.set(txid, { wallet: walletName, status: 'broadcast' });
        this.renderTrackedTxs();
        this.pollTxStatus(txid, walletName);
    }

    async pollTxStatus(txid, walletName) {
        const check = async () => {
            try {
                const data = await this.fetchZmqAPI(`/tx/${txid}?wallet=${walletName}`);
                if (this.trackedTxs.has(txid)) {
                    this.trackedTxs.set(txid, data);
                    this.renderTrackedTxs();
                    
                    if (data.status === 'confirmed') {
                        return; // Para o polling se confirmou
                    }
                }
            } catch (error) {
                console.error(`Erro ao consultar tx ${txid}:`, error);
            }
            // Chama de novo em 5s se não confirmou
            setTimeout(check, 5000);
        };
        setTimeout(check, 1000);
    }

    renderTrackedTxs() {
        const container = document.getElementById('tx-status-list');
        if (this.trackedTxs.size === 0) {
            container.innerHTML = '<small style="color: #aaa;">Nenhuma transação enviada recentemente.</small>';
            return;
        }
        
        container.innerHTML = '';
        this.trackedTxs.forEach((txData, txid) => {
            let color = '#ccc';
            let icon = '🔄';
            
            if (txData.status === 'mempool') {
                color = '#ffaa00'; icon = '⏳';
            } else if (txData.status === 'confirmed') {
                color = '#00ff88'; icon = '✅';
            }
            
            container.innerHTML += `
                <div style="font-size: 0.8rem; margin-bottom: 0.5rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-left: 3px solid ${color}; border-radius: 4px;">
                    <strong>${icon} TXID:</strong> <span style="font-family: monospace;">${txid.substring(0, 16)}...</span><br>
                    <small style="color: ${color};">${txData.message || 'Enviando...'}</small>
                </div>
            `;
        });
    }

    renderSyncStatus(data) {
        const lagClass = data.lag === 0 ? 'lag-ok' : 
                        data.lag <= 5 ? 'lag-warning' : 'lag-danger';
        
        const lagIcon = data.lag === 0 ? '✅' : 
                       data.lag <= 5 ? '⚠️' : '🚨';

        document.getElementById('sync-status').innerHTML = `
            <h2>⏱ Node Sync Status</h2>
            <div class="lag-indicator ${lagClass}">
                ${lagIcon} Lag: ${data.lag} blocos
            </div>
            <div class="metric">
                <span>Blocos:</span>
                <span class="metric-value">${data.blocks.toLocaleString()}</span>
            </div>
            <div class="metric">
                <span>Headers:</span>
                <span class="metric-value">${data.headers.toLocaleString()}</span>
            </div>
            <div class="metric">
                <span>Chain:</span>
                <span class="metric-value">${data.chain}</span>
            </div>
            <div class="metric">
                <span>Progresso:</span>
                <span class="metric-value">${(data.sync_progress * 100).toFixed(2)}%</span>
            </div>
        `;
    }

    renderMempoolIntelligence(data) {
        const dist = data.fee_distribution;
        
        document.getElementById('mempool-intelligence').innerHTML = `
            <h2>🧠 Mempool Intelligence</h2>
            <div class="metric">
                <span>Total de Transações:</span>
                <span class="metric-value">${data.tx_count.toLocaleString()}</span>
            </div>
            <div class="metric">
                <span>Fee Rate Média:</span>
                <span class="metric-value">${data.avg_fee_rate} sat/vB</span>
            </div>
            <div class="metric">
                <span>Fee Range:</span>
                <span class="metric-value">${data.min_fee_rate} - ${data.max_fee_rate} sat/vB</span>
            </div>
            <div class="metric">
                <span>Total vSize:</span>
                <span class="metric-value">${(data.total_vsize / 1_000_000).toFixed(2)} MB</span>
            </div>
            
            <h3>📊 Distribuição por Fee</h3>
            <div class="fee-distribution">
                <div class="fee-bucket">
                    <div>🟢 Low</div>
                    <div><strong>${dist.low}</strong></div>
                    <div>${((dist.low / data.tx_count) * 100).toFixed(1)}%</div>
                </div>
                <div class="fee-bucket">
                    <div>🟡 Medium</div>
                    <div><strong>${dist.medium}</strong></div>
                    <div>${((dist.medium / data.tx_count) * 100).toFixed(1)}%</div>
                </div>
                <div class="fee-bucket">
                    <div>🔴 High</div>
                    <div><strong>${dist.high}</strong></div>
                    <div>${((dist.high / data.tx_count) * 100).toFixed(1)}%</div>
                </div>
            </div>
        `;
    }

    renderRawData(data) {
        document.getElementById('raw-data').innerHTML = `
            <h2>📊 Dados Técnicos</h2>
            <details>
                <summary>Dados Brutos da API</summary>
                <pre style="margin-top: 1rem; font-size: 0.8rem; overflow: auto;">
${JSON.stringify(data, null, 2)}
                </pre>
            </details>
        `;
    }

    showError(message) {
        document.querySelectorAll('.rpc-group .loading').forEach(el => {
            el.innerHTML = `❌ ${message}`;
        });
    }

    renderZmqActivity(data) {
        const ts = data.last_event_time ? new Date(data.last_event_time * 1000).toLocaleTimeString() : 'N/A';
        document.getElementById('zmq-activity').innerHTML = `
            <h2>⚡ Event Activity</h2>
            <div class="metric">
                <span>Transações Observadas:</span>
                <span class="metric-value">${data.tx_observed.toLocaleString()}</span>
            </div>
            <div class="metric">
                <span>Blocos Observados:</span>
                <span class="metric-value">${data.blocks_observed.toLocaleString()}</span>
            </div>
            <div class="metric">
                <span>Taxa de Eventos (tx/s):</span>
                <span class="metric-value">${data.tx_per_second}</span>
            </div>
            <div class="metric">
                <span>Último Evento:</span>
                <span class="metric-value">${ts}</span>
            </div>
        `;
    }

    renderZmqLatest(data) {
        let txHtml = data.txs.map(tx => `
            <div style="font-size: 0.8rem; margin-bottom: 0.5rem; padding: 0.5rem; background: rgba(0,255,136,0.1); border-radius: 4px;">
                TX: ${tx.txid}<br>
                <small style="color: #aaa;">${new Date(tx.ts * 1000).toLocaleTimeString()} | ${tx.size} bytes</small>
            </div>
        `).join('');

        let blockHtml = data.blocks.map(b => `
            <div style="font-size: 0.8rem; margin-bottom: 0.5rem; padding: 0.5rem; background: rgba(255,215,0,0.1); border-radius: 4px;">
                BLOCK: ${b.hash.substring(0,20)}...<br>
                <small style="color: #aaa;">${new Date(b.ts * 1000).toLocaleTimeString()} | ${b.size} bytes</small>
            </div>
        `).join('');

        document.getElementById('zmq-latest-events').innerHTML = `
            <h2>🔍 Últimos Eventos</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                    <h3 style="margin-bottom: 0.5rem; font-size: 1rem; color: #ffd700;">Blocos</h3>
                    ${blockHtml || '<small style="color:#aaa;">Nenhum bloco ainda</small>'}
                </div>
                <div>
                    <h3 style="margin-bottom: 0.5rem; font-size: 1rem; color: #00ff88;">Transações</h3>
                    ${txHtml || '<small style="color:#aaa;">Nenhuma tx ainda</small>'}
                </div>
            </div>
        `;
    }

    renderZmqDivergence(data) {
        const divClass = data.divergence ? 'lag-danger' : 'lag-ok';
        const divIcon = data.divergence ? '⚠️ DIVERGÊNCIA DETECTADA' : '✅ ESTADO SINCRONIZADO';
        
        document.getElementById('zmq-divergence').innerHTML = `
            <h2>⚠️ Status de Divergência</h2>
            <div class="lag-indicator ${divClass}" style="font-size: 1.2rem; padding: 1rem; border: 1px solid currentColor; border-radius: 8px;">
                ${divIcon}
            </div>
            <div class="metric" style="margin-top: 1.5rem; flex-direction: column; align-items: flex-start;">
                <span style="color: #aaa; font-size: 0.8rem; margin-bottom: 0.2rem;">Best Block Hash (RPC):</span>
                <span class="metric-value" style="font-size: 0.8rem; word-break: break-all;">${data.best_block_rpc || 'N/A'}</span>
            </div>
            <div class="metric" style="flex-direction: column; align-items: flex-start;">
                <span style="color: #aaa; font-size: 0.8rem; margin-bottom: 0.2rem;">Last Seen Block (ZMQ):</span>
                <span class="metric-value" style="font-size: 0.8rem; word-break: break-all;">${data.last_seen_block_zmq || 'N/A'}</span>
            </div>
            <p style="font-size: 0.8rem; color: #aaa; margin-top: 1rem;">
                Divergências podem ocorrer brevemente quando um novo bloco é recebido via ZMQ mas o estado de consenso (RPC) ainda não terminou de validá-lo.
            </p>
        `;
    }
}

// Inicializa o dashboard quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new BitcoinDashboard();
});
