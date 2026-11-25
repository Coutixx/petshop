# PetShop Cotil

Aplicativo desktop para gestão de clientes, produtos, estoque e vendas de um pet shop. A aplicação usa Electron, TypeScript, Bootstrap e MySQL.

## Arquitetura

```text
Renderer -> Preload tipado -> IPC -> Services/Repositories -> MySQL
```

- `src/renderer`: telas e interação da aplicação.
- `src/preload`: APIs seguras expostas ao renderer.
- `src/main`: janela Electron, handlers IPC, regras de negócio e persistência.
- `src/shared`: contratos e regras compartilhadas entre processos.
- `database`: migrações e seed do MySQL.

O renderer não acessa o banco diretamente. As operações passam pelo preload e pelos handlers IPC do processo principal.

## Requisitos

- Node.js 24 LTS
- npm
- MySQL com suporte a InnoDB
- Acesso à rede ou VPN do servidor MySQL, quando necessário

## Configuração

Na raiz do projeto:

```powershell
Copy-Item .env.example .env
npm ci
```

Preencha no `.env`:

```text
DB_HOST=
DB_PORT=3306
DB_NAME=
DB_USER=
DB_PASSWORD=
STORE_ADDRESS=
SEED_ADMIN_NAME=
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
```

Execute as migrações SQL em ordem, uma única vez por banco:

1. `database/migrations/001-inicial.sql`
2. `database/migrations/002-entregadores.sql`
3. `database/migrations/003-catalogo.sql`

Depois, crie os dados iniciais:

```powershell
npm run db:seed
```

Nunca versione ou compartilhe o arquivo `.env`.

## Executar

```powershell
npm run dev
```

O aplicativo abre como uma janela Electron. Faça login com a conta criada pelo seed.

As telas disponíveis são:

- Visão geral e indicadores de estoque.
- Produtos e estoque, com preços em BRL ou USD.
- Clientes e consulta de CEP.
- Caixa, carrinho, frete, entregadores e confirmação de venda.
- Histórico de vendas e recibos.

O envio de recibos por e-mail é simulado; nenhum e-mail real é enviado.

## Verificação

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Para executar os testes de integração com um banco de teste configurado:

```powershell
npm run test:integration
```

Para gerar um executável portátil do Windows:

```powershell
npm run dist:win
```

O executável é criado em `dist/`. O `.env` deve permanecer fora do pacote, ao lado do executável.

## Banco de dados

As migrações, o diagrama e as chaves estrangeiras estão documentados em [database/migrations/README.md](database/migrations/README.md). O fluxo de venda grava o pedido e seus itens, atualiza o estoque e reserva o entregador na mesma transação.
