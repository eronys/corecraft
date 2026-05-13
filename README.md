# Corecraft - Atividades

Este repositório contém as atividades desenvolvidas para o curso.

## Atividade 1: Bitcoin Core Dashboard

O Bitcoin Core Dashboard é uma aplicação web (Frontend em HTML/JS e Backend em PHP) para monitoramento do seu nó Bitcoin local (via RPC).

### Passo a Passo de Instalação e Execução

Para rodar a aplicação da **Atividade 1**, siga as instruções abaixo:

#### 1. Pré-requisitos
- Ter o **PHP** instalado na sua máquina (recomendado versão 7.4 ou superior) juntamente com as bibliotecas necessárias. Para instalar no Ubuntu/Debian, execute o comando abaixo no terminal:
  ```bash
  sudo apt update
  sudo apt install php php-cli php-curl php-json
  ```
- Ter o **Bitcoin Core** rodando localmente (normalmente em modo *regtest* ou *signet*).

#### 2. Configurando o seu nó do Bitcoin Core
Verifique se o seu arquivo `bitcoin.conf` (ou a inicialização do nó) contém as seguintes configurações habilitadas para acesso RPC:
```ini
server=1
rpcuser=dev
rpcpassword=devmode
rpcport=18443

```

Rede (porta padrão)
Mainnet	-	8333
Testnet	-	18333
Signet	-	38333
Regtest	-	18444

*(Se as suas credenciais ou portas forem diferentes, você precisará alterá-las no arquivo `atividade 1/config/bitcoin.php`)*.

#### 3. Iniciando a aplicação

> **Aviso Importante:** A pasta correta para subir a aplicação é **dentro** das pastas das respectivas atividades (ex: `atividade 1`), e nunca na raiz do repositório.

Abra o seu terminal e navegue até a pasta da **atividade 1**:
```bash
cd "atividade 1"
```

Inicie o servidor web embutido do PHP apontando para o arquivo roteador (`router.php`) que gerencia a API e os arquivos estáticos:
```bash
php -S localhost:8000 router.php
```

#### 4. Acessando pelo navegador
Com o servidor rodando, abra o seu navegador de preferência e acesse:
[http://localhost:8000](http://localhost:8000)

Se o nó do Bitcoin estiver rodando corretamente e comunicando pela porta configurada, os dados do seu Dashboard começarão a ser exibidos e atualizados a cada 30 segundos!

## Gerenciamento do Serviço da Rede Bitcoin

Na raiz deste repositório (`corecraft-repo/`), você encontrará o arquivo executável **`commands.sh`**. Este script serve para automatizar os comandos de gestão do serviço da rede do Bitcoin Core para as 4 redes principais (Regtest, Testnet, Signet e Mainnet).

Ele provê uma interface interativa (menu em terminal) onde você pode:
- **Iniciar node:** Sobe o serviço daemon do Bitcoin para a rede selecionada.
- **Status node:** Mostra informações da rede usando `getblockchaininfo` ou lê o `debug.log`.
- **Parar node:** Desliga o node com segurança.
- **Configurar parâmetro especial:** Permite inserir ou alterar valores não padronizados no arquivo `bitcoin.conf` específicos da rede selecionada (ex: `txindex` para Regtest, `prune` para Mainnet, ou `fallbackfee` para Signet/Testnet).



Para rodar a ferramenta de automação:
```bash
./commands.sh
```
