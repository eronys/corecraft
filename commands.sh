#!/usr/bin/env bash
clear

rpcuser=dev
rpcpass=devmode

rpc_running(){
  local dir=$1
  bitcoin-cli -datadir="$dir" -rpcuser="$rpcuser" -rpcpassword="$rpcpass" getblockchaininfo &>/dev/null
}

start_node(){
  local dir=$1
  if rpc_running "$dir"; then
    echo "Node já está rodando em $dir."
  else
    if [ ! -d "$dir" ]; then
      echo "Criando diretório $dir..."
      mkdir -p "$dir"
    fi
    bitcoind -datadir="$dir" -daemon
    echo -n "Iniciando RPC..."
    local max=15
    local i=0
    until rpc_running "$dir" || [ $i -ge $max ]; do
      sleep 1; i=$((i+1))
    done
    if rpc_running "$dir"; then
      echo " pronto!"
    else
      echo
      echo "❌ RPC não respondeu após $max s."
    fi
  fi
}

stop_node(){
  local dir=$1
  if rpc_running "$dir"; then
    bitcoin-cli -datadir="$dir" -rpcuser="$rpcuser" -rpcpassword="$rpcpass" stop \
      && echo -n "Shutdown solicitado..." \
      && until ! rpc_running "$dir"; do sleep 1; done \
      && echo " parado."
  else
    echo "Node não está rodando."
    echo "Tentando parar mesmo assim:"
    bitcoin-cli -datadir="$dir" -rpcuser="$rpcuser" -rpcpassword="$rpcpass" stop 2>&1
  fi
}

status_node(){
  local dir=$1
  if rpc_running "$dir"; then
    echo "Node rodando. getblockchaininfo:"
    bitcoin-cli -datadir="$dir" -rpcuser="$rpcuser" -rpcpassword="$rpcpass" getblockchaininfo
  else
    echo "Node não está rodando."
    echo "Últimas linhas do log:"
    local logfile=$(find "$dir" -name "debug.log" -type f 2>/dev/null | head -n 1)
    if [ -n "$logfile" ] && [ -f "$logfile" ]; then
      tail -n 20 "$logfile"
    else
      echo "  ⚠️ debug.log não encontrado."
    fi
  fi
}

config_param(){
  local dir=$1
  local param=$2
  local conf_file="$dir/bitcoin.conf"
  
  if [ ! -d "$dir" ]; then
    mkdir -p "$dir"
  fi
  if [ ! -f "$conf_file" ]; then
    touch "$conf_file"
  fi

  echo "Configuração do parâmetro: $param"
  local current=$(grep "^$param=" "$conf_file" | cut -d'=' -f2)
  if [ -n "$current" ]; then
    echo "Valor atual: $current"
  else
    echo "Parâmetro não configurado atualmente."
  fi

  read -p "Digite o novo valor para $param (ou deixe em branco para cancelar): " val
  if [ -n "$val" ]; then
    if grep -q "^$param=" "$conf_file"; then
      sed -i "s/^$param=.*/$param=$val/" "$conf_file"
    else
      echo "$param=$val" >> "$conf_file"
    fi
    echo "Parâmetro atualizado com sucesso em $conf_file."
  else
    echo "Operação cancelada."
  fi
}

menu_rede(){
  local rede=$1
  local datadir=$2
  local param=$3

  while true; do
    echo
    echo "╔═══════════════════════════════════╗"
    printf "║ %-33s ║\n" "REDE: ${rede^^}"
    echo "╠═══════════════════════════════════╣"
    echo "║ 1) Iniciar node                   ║"
    echo "║ 2) Status node                    ║"
    echo "║ 3) Parar node                     ║"
    printf "║ 4) Configurar parâmetro %-9s ║\n" "($param)"
    echo "║ 5) Voltar                         ║"
    echo "╚═══════════════════════════════════╝"
    read -p "Opção: " sub_rede

    case $sub_rede in
      1) start_node "$datadir" ;;
      2) status_node "$datadir" ;;
      3) stop_node "$datadir" ;;
      4) config_param "$datadir" "$param" ;;
      5) break ;;
      *) echo "Opção inválida." ;;
    esac
    read -rp "Pressione Enter para continuar…" dummy
  done
}

while true; do
  echo "╔═══════════════════════════╗"
  echo "║       MENU PRINCIPAL      ║"
  echo "╠═══════════════════════════╣"
  echo "║ 1) Comandos Básicos       ║"
  echo "║ 2) Comandos Bitcoin       ║"
  echo "║ 3) Sair                   ║"
  echo "╚═══════════════════════════╝"
  read -p "Escolha (1-3): " opt

  case $opt in
    1)
      while true; do
        echo
        echo "╔═══════════════════════════╗"
        echo "║     COMANDOS BÁSICOS      ║"
        echo "╠═══════════════════════════╣"
        echo "║ 1) Atualizar sistema      ║"
        echo "║ 2) Limpar cache do apt    ║"
        echo "║ 3) Mostrar uso de disco   ║"
        echo "║ 4) Voltar                 ║"
        echo "╚═══════════════════════════╝"
        read -p "Opção: " sub
        case $sub in
          1) sudo apt update && sudo apt upgrade -y ;;
          2) sudo apt clean ;;
          3) df -h ;;
          4) break ;;
          *) echo "Opção inválida." ;;
        esac
        read -rp "Pressione Enter para continuar…" dummy
      done
      ;;
    2)
      while true; do
        echo
        echo "╔════════════════════════════════════╗"
        echo "║        COMANDOS BITCOIN            ║"
        echo "╠════════════════════════════════════╣"
        echo "║ 1) Regtest (Desenvolvimento)       ║"
        echo "║ 2) Testnet (Teste)                 ║"
        echo "║ 3) Signet (Homologação)            ║"
        echo "║ 4) Mainnet (Produção)              ║"
        echo "║ 5) Voltar                          ║"
        echo "╚════════════════════════════════════╝"
        read -p "Selecione a rede: " sub

        case $sub in
          1) menu_rede "regtest" "$HOME/bitcoin-regtest-node1" "txindex" ;;
          2) menu_rede "testnet" "$HOME/bitcoin-testnet-node1" "fallbackfee" ;;
          3) menu_rede "signet" "$HOME/bitcoin-signet-node1" "fallbackfee" ;;
          4) menu_rede "mainnet" "$HOME/bitcoin-mainet-node1" "prune" ;;
          5) break ;;
          *) echo "Opção inválida." ;;
        esac
      done
      ;;
    3)
      echo "Saindo…"
      exit 0
      ;;
    *)
      echo "Opção inválida."
      ;;
  esac
done
