class BitcoinDashboard {
    constructor() {
        this.apiBase = '/api';
        this.init();
    }

    async init() {
        await this.loadData();
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
        document.querySelectorAll('.card .loading').forEach(el => {
            el.innerHTML = `❌ ${message}`;
        });
    }
}

// Inicializa o dashboard quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new BitcoinDashboard();
});
