import time
import binascii
import threading
from collections import deque
import zmq
import requests
from requests.auth import HTTPBasicAuth
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Permite que o frontend (porta 8000) consulte a API na porta 8001

# --- Configurações do Bitcoin Core ---
RPC_URL = "http://127.0.0.1:18443"
RPC_USER = "dev"
RPC_PASS = "devmode"
ZMQ_HOST = "127.0.0.1"
ZMQ_TX_PORT = "28332"
ZMQ_BLOCK_PORT = "28333"

# --- Estado em Memória ---
# Vamos manter os últimos 50 eventos
recent_blocks = deque(maxlen=50)
recent_txs = deque(maxlen=50)

# Contadores para estatísticas
stats = {
    "blocks_observed": 0,
    "tx_observed": 0,
    "last_event_time": None,
    "start_time": time.time()
}

# --- Funções RPC ---
def rpc_call(method, params=[], wallet=None):
    try:
        url = RPC_URL
        if wallet:
            url = f"{RPC_URL}/wallet/{wallet}"
            
        payload = {
            "jsonrpc": "1.0",
            "id": "python_backend",
            "method": method,
            "params": params
        }
        r = requests.post(url, json=payload, auth=HTTPBasicAuth(RPC_USER, RPC_PASS), timeout=2)
        if r.status_code == 200:
            return r.json().get("result")
        else:
            print(f"Erro RPC ({r.status_code}): {r.text}")
    except Exception as e:
        print(f"Erro RPC: {e}")
    return None

# --- Listener ZMQ ---
def zmq_listener():
    print(f"Iniciando ZMQ Listener em tcp://{ZMQ_HOST}:{ZMQ_TX_PORT} e {ZMQ_BLOCK_PORT}...")
    context = zmq.Context()
    
    # Socket para Transações
    socket_tx = context.socket(zmq.SUB)
    socket_tx.connect(f"tcp://{ZMQ_HOST}:{ZMQ_TX_PORT}")
    socket_tx.setsockopt_string(zmq.SUBSCRIBE, "rawtx")
    
    # Socket para Blocos
    socket_block = context.socket(zmq.SUB)
    socket_block.connect(f"tcp://{ZMQ_HOST}:{ZMQ_BLOCK_PORT}")
    socket_block.setsockopt_string(zmq.SUBSCRIBE, "rawblock")
    
    # Poller para escutar ambos
    poller = zmq.Poller()
    poller.register(socket_tx, zmq.POLLIN)
    poller.register(socket_block, zmq.POLLIN)
    
    while True:
        try:
            socks = dict(poller.poll(1000))
            
            if socket_tx in socks and socks[socket_tx] == zmq.POLLIN:
                topic, payload, seq = socket_tx.recv_multipart()
                handle_tx(payload, seq)
                
            if socket_block in socks and socks[socket_block] == zmq.POLLIN:
                topic, payload, seq = socket_block.recv_multipart()
                handle_block(payload, seq)
                
        except Exception as e:
            print(f"Erro no loop ZMQ: {e}")

def handle_tx(payload, seq):
    stats["tx_observed"] += 1
    stats["last_event_time"] = int(time.time())
    
    # Para uma transação raw, decodificar não é trivial sem bibliotecas completas de Bitcoin.
    # O hash real da tx seria o duplo SHA256 do payload em ordem reversa, 
    # mas para nosso propósito educacional, podemos gerar um hash simbólico
    # ou usar o decodificador RPC para ver o txid (embora seja pesado fazer por cada evento).
    # Vamos pegar os primeiros 32 bytes em hex como uma representação visual se não quisermos onerar o RPC.
    
    # Método mais lento porém preciso:
    # tx_hex = binascii.hexlify(payload).decode('utf-8')
    # decoded = rpc_call('decoderawtransaction', [tx_hex])
    # txid = decoded.get('txid') if decoded else f"unknown_tx_seq_{int.from_bytes(seq, 'little')}"
    
    # Método rápido visual:
    tx_hex = binascii.hexlify(payload).decode('utf-8')
    txid_visual = tx_hex[:16] + "..." + tx_hex[-16:]
    
    recent_txs.appendleft({
        "txid": txid_visual,
        "ts": int(time.time()),
        "size": len(payload)
    })
    print(f"ZMQ: Nova tx recebida (Seq {int.from_bytes(seq, 'little')})")

def handle_block(payload, seq):
    stats["blocks_observed"] += 1
    stats["last_event_time"] = int(time.time())
    
    # O hash do bloco requer duplo sha256 do header (primeiros 80 bytes).
    # Como não temos biblioteca hashlib aqui fácil pra reverse order do bitcoin, 
    # podemos pegar os primeiros 80 bytes (header) via binascii
    import hashlib
    header = payload[:80]
    hash1 = hashlib.sha256(header).digest()
    hash2 = hashlib.sha256(hash1).digest()
    blockhash = binascii.hexlify(hash2[::-1]).decode('utf-8')
    
    recent_blocks.appendleft({
        "hash": blockhash,
        "ts": int(time.time()),
        "size": len(payload)
    })
    print(f"ZMQ: Novo bloco recebido! Hash: {blockhash}")

# Inicia thread ZMQ
threading.Thread(target=zmq_listener, daemon=True).start()


# --- Rotas da API Flask ---

@app.route('/api/events/summary', methods=['GET'])
def get_summary():
    elapsed = time.time() - stats["start_time"]
    tx_per_second = stats["tx_observed"] / elapsed if elapsed > 0 else 0
    
    return jsonify({
        "blocks_observed": stats["blocks_observed"],
        "tx_observed": stats["tx_observed"],
        "last_event_time": stats["last_event_time"],
        "tx_per_second": round(tx_per_second, 2)
    })

@app.route('/api/events/latest', methods=['GET'])
def get_latest():
    return jsonify({
        "blocks": list(recent_blocks)[:5],  # retorna só os 5 últimos para a UI
        "txs": list(recent_txs)[:10]        # retorna só as 10 últimas para a UI
    })

@app.route('/api/events/state-comparison', methods=['GET'])
def get_state_comparison():
    best_block_rpc = rpc_call("getbestblockhash")
    last_seen_block_zmq = recent_blocks[0]["hash"] if recent_blocks else None
    
    divergence = False
    if best_block_rpc and last_seen_block_zmq:
        divergence = (best_block_rpc != last_seen_block_zmq)
        
    return jsonify({
        "best_block_rpc": best_block_rpc,
        "last_seen_block_zmq": last_seen_block_zmq,
        "divergence": divergence
    })

@app.route('/api/wallets', methods=['GET'])
def get_wallets():
    wallet_dir_info = rpc_call("listwalletdir")
    available_wallets = []
    if wallet_dir_info and "wallets" in wallet_dir_info:
        available_wallets = [w["name"] for w in wallet_dir_info["wallets"]]
    
    loaded_wallets = rpc_call("listwallets") or []
    
    # Se não houver wallets disponíveis, vamos criar as 10 wallets iniciais (apenas para dev)
    if not available_wallets:
        for i in range(1, 11):
            w_name = f"wallet-{i:02d}"
            rpc_call("createwallet", [w_name])
            available_wallets.append(w_name)
            loaded_wallets.append(w_name)
            
    return jsonify({
        "available_wallets": available_wallets,
        "loaded_wallets": loaded_wallets
    })

@app.route('/api/wallet/select', methods=['POST'])
def select_wallet():
    data = request.json
    wallet_name = data.get("wallet") if data else None
    
    loaded = rpc_call("listwallets") or []
    if wallet_name not in loaded:
        rpc_call("loadwallet", [wallet_name])
        
    return jsonify({"success": True, "selected_wallet": wallet_name})

@app.route('/api/wallet/status', methods=['GET'])
def get_wallet_status():
    wallet_name = request.args.get('wallet')
    
    info = rpc_call("getwalletinfo", [], wallet=wallet_name)
    unspent = rpc_call("listunspent", [], wallet=wallet_name)
    
    balance = info.get("balance", 0) if info else 0
    utxos_count = len(unspent) if unspent else 0
    
    return jsonify({
        "wallet": wallet_name,
        "balance": balance,
        "utxos": utxos_count
    })

@app.route('/api/tx/random', methods=['POST'])
def create_random_tx():
    data = request.json
    wallet_name = data.get("wallet") if data else None
    
    # Gera endereço de troco na mesma carteira
    addr = rpc_call("getnewaddress", [], wallet=wallet_name)
    
    if not addr:
        return jsonify({"success": False, "error": "Erro ao gerar endereço"})
        
    # Usando sendtoaddress para simular o fluxo com saldo simbólico (0.0001)
    txid = rpc_call("sendtoaddress", [addr, 0.0001], wallet=wallet_name)
    
    return jsonify({"success": True if txid else False, "txid": txid})

@app.route('/api/tx/<txid>', methods=['GET'])
def get_tx_status(txid):
    wallet_name = request.args.get('wallet')
    
    tx_info = rpc_call("gettransaction", [txid], wallet=wallet_name)
    raw_tx = rpc_call("getrawtransaction", [txid, True])
    
    status = "unknown"
    message = "Transação não localizada."
    confirmations = 0
    
    if tx_info:
        confirmations = tx_info.get("confirmations", 0)
        
        if confirmations > 0:
            status = "confirmed"
            message = "Transação confirmada em bloco."
        else:
            status = "mempool"
            message = "Transação aceita na mempool, aguardando inclusão em bloco."
            
            # Checa tempo
            ts = tx_info.get("timereceived", time.time())
            age = time.time() - ts
            if age > 120:
                message += " (Aviso: na mempool há mais de 2 minutos)"
                
    elif raw_tx:
        status = "broadcast"
        message = "Transação enviada ao node, mas pode não pertencer a esta carteira."
        
    return jsonify({
        "txid": txid,
        "wallet": wallet_name,
        "status": status,
        "confirmations": confirmations,
        "message": message
    })

if __name__ == '__main__':
    # Roda o servidor na porta 8001
    print("Iniciando Backend Python na porta 8001...")
    app.run(host='0.0.0.0', port=8001, debug=False)
