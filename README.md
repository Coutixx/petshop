# PetShop Cotil

Aplicativo desktop para gerenciamento de um PetShop, desenvolvido para a disciplina de Desenvolvimento de Aplicativos Desktop (DAD).

## Tecnologias e arquitetura

Electron, TypeScript, MySQL da escola e Bootstrap. A aplicação seguirá este fluxo:

```text
Interface (renderer) -> preload tipado -> IPC (main) -> service/repository -> MySQL
```

O banco MySQL é mantido pelo servidor da escola, então não depende do Docker nem de um notebook ligado. Cada integrante deve usar suas próprias credenciais em um `.env` local; não compartilhe credenciais pessoais. Para um banco compartilhado pela equipe, solicite ao professor uma conta de projeto com permissões limitadas.

## Arquitetura

O código é separado por responsabilidades, organizando a aplicação em camadas:

| **Camada** | **Responsabilidade** |
| ------------------------- | ------------------------------------------------------------------------------- |
| `Renderer` | Interface gráfica, telas, componentes e interação com o usuário |
| `Preload` | Comunicação segura entre o Renderer e o processo principal, expondo APIs tipadas |
| `Main` | Inicialização do Electron, gerenciamento de janelas e registro dos handlers IPC |
| `Services` | Regras de negócio e execução dos casos de uso da aplicação |
| `Repositories` | Acesso ao banco de dados MySQL e execução das operações de persistência |
| `Database` | Configuração da conexão e estrutura de acesso ao banco de dados |

A comunicação entre as camadas ocorre por meio de IPC (Inter-Process Communication). O Renderer solicita operações através das APIs disponibilizadas pelo Preload, que encaminha as chamadas ao processo principal do Electron.

No processo principal, os handlers IPC acionam os Services, que executam as regras de negócio e utilizam os Repositories para acessar o banco de dados MySQL. Dessa forma, a interface não acessa diretamente o banco de dados, mantendo as responsabilidades separadas.

## Configuração local

Requisitos: Node.js 20 ou superior, npm e acesso à rede do servidor MySQL da escola. O acesso fora do laboratório pode depender da rede ou VPN da escola.

```powershell
Copy-Item .env.example .env # somente na primeira configuração; não sobrescreva um .env já preenchido
npm install
```

Edite o arquivo `.env` local e preencha `DB_NAME`, `DB_USER` e `DB_PASSWORD` com os dados fornecidos pela escola. `DB_HOST` e `DB_PORT` já apontam para o servidor da escola. Não compartilhe o `.env`.

Antes do primeiro uso, execute `database/migrations/001-inicial.sql` no banco da escola usando um cliente MySQL autorizado, como uma extensão do VS Code com suporte a MySQL ou o MySQL Workbench. A migration não é executada automaticamente pelo aplicativo. Para criar um administrador e clientes demonstrativos, defina `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` no `.env` (senha com pelo menos 12 caracteres) e execute `npm run db:seed`. O seed pode ser repetido; não redefine a senha de uma conta já existente.

Depois que a migration e o seed terminarem com sucesso, execute `npm run dev` e entre com o e-mail e a senha definidos no seed. Na tela inicial, clique em **Testar conexão MySQL** para confirmar o acesso; o teste não exibe nem salva a senha na interface. Administradores podem excluir clientes; atendentes podem consultar, cadastrar e editar. A busca de endereço via CEP requer acesso à internet.

O `.env` está ignorado pelo Git. Nunca o envie no chat, no repositório ou dentro do instalador. Cada integrante precisa usar suas próprias credenciais, a menos que o professor forneça uma conta específica para o projeto.

## Produtos e dashboard local — Júlia

Após `npm run dev`, use **Explorar produtos e dashboard de demonstração** na tela de login para testar o catálogo sem autenticação MySQL. Esse acesso abre somente dados locais de produtos; não libera clientes nem operações do banco. Após o login normal, a navegação também permite alternar entre dashboard, produtos e clientes.

O catálogo começa com seis exemplos e salva alterações no armazenamento local do aplicativo (`petshop.julia.produtos.v1`). É uma demonstração compartilhada pelas sessões desse aplicativo no computador, não um banco de produção. Cadastro, edição, exclusão, pesquisa e filtro por categoria atualizam os indicadores. Use **Editar** para alterar a quantidade em estoque. Estoque zero indica indisponibilidade; de uma a cinco unidades indica estoque baixo. Se os dados locais estiverem corrompidos ou o armazenamento não puder ser aberto, o aplicativo informa a falha e preserva os dados existentes.

Cada produto mantém seu preço na moeda de origem (BRL ou USD); a marcação de importado é independente da moeda. Clique em **Atualizar cotação** para consultar USD/BRL pela [AwesomeAPI](https://docs.awesomeapi.com.br/api-de-moedas), usando a taxa de venda `ask` e a data informada pelo provedor. As conversões arredondam para centavos e não incluem impostos ou taxas. Se a consulta falhar, a última cotação válida desta sessão permanece identificada com um aviso e sua data. Sem uma consulta válida, os preços convertidos ficam indisponíveis e o dashboard identifica o valor de estoque como parcial.

As regras estão em `src/shared/domain/produtos`; a interface está em `src/renderer/src/modules/produtos`. `ProdutoService.listarResumos(taxa)` entrega o contrato `ProdutoResumo` com preços em BRL, omitindo itens em USD quando não há taxa válida. `validarDisponibilidade(itens)` verifica a soma das quantidades por produto sem baixar estoque. Antes do uso real, Henrique deve fornecer persistência/API IPC com autorização, e Nycollas deve conectar a validação ao checkout. A confirmação deverá revalidar e baixar o estoque em uma transação MySQL atômica. Recibos e histórico devem usar o preço confirmado da venda, não recalcular com uma cotação posterior.

Para conferir visualmente só este módulo no navegador, execute `npm run prototype:produtos` e abra `http://127.0.0.1:5174`. A prévia usa o mesmo componente do Electron, sem simular APIs de clientes ou autenticação. O armazenamento de cada navegador/perfil é independente do Electron. A exclusão pede confirmação dentro da tela, com opções de cancelar e confirmar.

Validação: `npm run typecheck`, `npm run lint`, `npm test` e `npm run build`. Os testes de interface usam happy-dom; a validação HTML nativa é simulada nesses testes e também pode ser conferida na prévia real. Nenhuma migration ou seed é necessária para a demonstração de produtos.

Se o Electron compilar e encerrar antes de abrir uma janela em um terminal restrito de automação, tente `npm run dev` no PowerShell normal do Windows, a partir da pasta do projeto. Isso não exige alterar o MySQL ou desativar a segurança do Electron. Se a instalação informar `Electron uninstall`, confirme que o download do binário foi permitido pelo npm e execute o instalador oficial local com `node node_modules/electron/install.js` antes de tentar novamente.

## Divisão da equipe

| Integrante | Módulo independente | Entrega na integração |
| --- | --- | --- |
| Henrique | Backend, banco, usuários, clientes e ViaCEP | Persistência MySQL, IPC e segurança para todos os módulos |
| Julia | Produtos, estoque, dólar e dashboard | Catálogo e regra de disponibilidade ao pedido |
| Nycollas | Entregadores, checkout, frete e distância | Pedido vinculado a cliente, produtos e entregador |
| Enzo | Itens, recibo, histórico e e-mail | Itens vinculados ao pedido e confirmação de venda |

## Roadmap paralelo

### Fase 1 - Preparação individual (todos podem começar ao mesmo tempo)

- [x] **[Henrique]** Criar a base Electron com TypeScript, `main`, `preload` e `renderer`.
- [x] **[Henrique]** Configurar scripts de desenvolvimento, build, lint, testes, CSP e `contextIsolation`.
- [x] **[Henrique]** Definir contratos TypeScript compartilhados (`ClienteResumo`, `ProdutoResumo`, `PedidoRascunho`) sem implementar telas de terceiros.
- [x] **[Henrique]** Configurar credenciais MySQL locais e validar conexão com o servidor da escola.
- [x] **[Julia]** Criar estrutura visual Bootstrap, navegação e layout-base do dashboard.
- [ ] **[Nycollas]** Criar wireframe e tela estática do caixa/checkout com dados simulados.
- [x] **[Enzo]** Criar [modelo visual de recibo e histórico](src/renderer/src/modules/historico/prototype/index.html) usando dados simulados.

### Fase 2 - Módulo do Henrique: backend, banco e clientes

- [x] **[Henrique]** Criar migrations MySQL para as seis tabelas exigidas.
- [x] **[Henrique]** Criar diagrama do banco e documentar as chaves estrangeiras.
- [x] **[Henrique]** Implementar classes e repositórios de `Usuario` e `Cliente`.
- [x] **[Henrique]** Implementar login, logout, hash de senha e níveis de acesso.
- [x] **[Henrique]** Implementar CRUD de clientes com tela própria.
- [x] **[Henrique]** Integrar ViaCEP e tratar CEP inválido/falha de rede.
- [x] **[Henrique]** Expor APIs IPC tipadas somente para usuários e clientes.
- [x] **[Henrique]** Criar seed independente de usuários e clientes.
- [x] **[Henrique]** Testar autenticação, permissões, CRUD de clientes e validação de entrada.

### Fase 3 - Módulo da Julia: produtos e estoque

- [x] **[Julia]** Criar interface `Produto`, serviço e repositório local/mocado para desenvolvimento isolado.
- [x] **[Julia]** Implementar tela e CRUD de produtos com dados de exemplo.
- [x] **[Julia]** Implementar categoria, preço em BRL, preço em USD, importado e quantidade em estoque.
- [x] **[Julia]** Integrar cotação do dólar com tratamento de falha da API.
- [x] **[Julia]** Implementar regra local que identifica produto indisponível quando o estoque for zero.
- [x] **[Julia]** Criar dashboard de produtos e indicadores de estoque.
- [x] **[Julia]** Criar dados de demonstração e testes do módulo de produtos.

### Fase 4 - Módulo do Nycollas: entregadores, pedido e frete

- [x] **[Nycollas]** Criar interface `Entregador` e CRUD com dados de exemplo e MySQL.
- [x] **[Nycollas]** Criar `PedidoRascunho` usando IDs de cliente e produto.
- [x] **[Nycollas]** Implementar tela de checkout com carrinho local e cálculo de subtotal.
- [x] **[Nycollas]** Integrar API de distância com origem configurada e endereço real do cliente.
- [x] **[Nycollas]** Definir e testar regra de cálculo de frete de forma isolada.
- [x] **[Nycollas]** Registrar datas de criação e previsão de entrega.
- [x] **[Nycollas]** Criar testes para total, frete, checkout vazio e falha da API.

### Fase 5 - Módulo do Enzo: itens, confirmação e histórico

- [x] **[Enzo]** Criar interface `ItemPedido` e funções de subtotal/total usando dados de exemplo.
- [x] **[Enzo]** Garantir que o item preserve preço unitário e quantidade da venda.
- [x] **[Enzo]** Criar recibo visual com um pedido simulado.
- [x] **[Enzo]** Criar tela de histórico com pedidos simulados.
- [x] **[Enzo]** Implementar serviço de e-mail com ambiente de teste ou mock, sem credenciais no código.
- [x] **[Enzo]** Tratar falha de envio de e-mail sem invalidar a venda.
- [x] **[Enzo]** Revisar PRs das funcionalidades da equipe.

## Estado atual da integração

As funcionalidades abaixo foram reorganizadas para seguir as camadas do projeto e já foram integradas na `develop`.

| Módulo | Pull Request | Situação | Estrutura entregue |
| --- | --- | --- | --- |
| Checkout e entregadores | [#7](https://github.com/Coutixx/petshop/pull/7) | Integrado | `src/main/modules/pedidos` e `src/main/modules/entregadores` |
| Recibos e histórico | [#8](https://github.com/Coutixx/petshop/pull/8) | Integrado | `src/renderer/src/modules/historico` e `src/shared/domain` |

Os PRs originais #5 e #6 foram fechados como substituídos. Não faça merge deles.

### Próximos passos

1. Atualizar a cópia local com `git switch develop` e `git pull --ff-only origin develop`.
2. Iniciar a Fase 6. O checkout ainda usa mocks; a ligação com MySQL, IPC e a confirmação real de pedidos continuam pendentes.
3. Executar o fluxo integrado completo antes de preparar a release.

> Nunca envie código diretamente para `develop`. A integração deve ocorrer pelo botão **Merge pull request** após revisão.

### Fase 6 - Integração planejada (somente quando os módulos isolados estiverem prontos)

- [ ] **[Henrique]** Criar/adaptar repositórios MySQL para `Produto`, `Entregador`, `Pedido` e `ItemPedido` a partir dos contratos entregues.
- [ ] **[Julia]** Substituir os dados de exemplo de produtos pela API IPC fornecida por Henrique.
- [x] **[Nycollas]** Substituir os dados simulados de cliente, produto e entregador pelas APIs IPC; conectar o checkout ao pedido real.
- [x] **[Enzo]** Conectar itens, recibo, histórico e e-mail ao pedido confirmado.
- [ ] **[Julia]** Conectar a validação de estoque ao fechamento da venda.
- [x] **[Nycollas]** Conectar o cálculo de frete/distância ao total final do pedido.
- [ ] **[Henrique]** Validar transação de venda: gravar pedido, gravar itens e baixar estoque de forma atômica.
- [ ] **[Todos]** Executar um fluxo integrado: login -> cliente -> produto -> checkout -> frete -> confirmação -> recibo/histórico.

### Fase 7 - Entrega

- [ ] **[Henrique]** Preparar banco com dados de demonstração e gerar build testável.
- [x] **[Julia]** Revisar consistência visual e navegação.
- [ ] **[Nycollas]** Revisar regras de pedido, frete e mensagens do checkout.
- [ ] **[Enzo]** Atualizar documentação de instalação, uso e histórico de decisões.
- [ ] **[Todos]** Revisar segurança, testes, checklist e Pull Requests.
- [ ] **[Henrique]** Criar a release final na branch `main`.

## Convenções Git

### Branches

- Criar uma branch `feature/<nome>-<modulo>` por tarefa, sempre baseada na `develop` atualizada.
- Usar o nome do integrante e o módulo em minúsculas, separados por hífen.
- Exemplo: `feature/enzo-recibo-historico`.
- Não trabalhar diretamente na `main` ou na `develop`.
- Não criar arquivos README ou documentos de regras automaticamente ao criar branches.

### Commits

- Fazer ao menos um commit próprio por checkbox concluído.
- Utilizar `tipo(escopo): descrição` em português.
- Tipos permitidos incluem `feat`, `fix`, `docs`, `style`, `refactor`, `test` e `chore`.
- Os commits devem ser realizados na branch específica da tarefa, nunca diretamente na `main` ou `develop`.

### Pull Requests

- Abrir PR da branch de tarefa para `develop`.
- Utilizar o [modelo de Pull Request](.github/PULL_REQUEST_TEMPLATE.md).
- Solicitar revisão de pelo menos uma pessoa antes do merge.
- Não realizar merge sem a revisão necessária.
- Após o merge, sincronizar a `develop` local com o GitHub.

## Sincronização obrigatória com a Develop

A branch `develop` do GitHub (`origin/develop`) é a referência principal de integração do projeto.

Todos os integrantes e agentes devem manter sua cópia local atualizada para evitar trabalhar com código desatualizado ou gerar conflitos desnecessários.

### 1. Ao iniciar o projeto ou uma nova sessão

Sempre que abrir o projeto do zero, iniciar uma nova sessão de desenvolvimento ou começar uma nova tarefa:

1. Verificar a branch atual.
2. Verificar se existem alterações locais não commitadas.
3. Atualizar as referências do repositório remoto.
4. Atualizar a branch `develop` local com a versão do GitHub.
5. Criar ou atualizar a branch de trabalho a partir da `develop` atualizada.

Comandos de referência:

```bash
git status
git fetch origin
git switch develop
git pull --ff-only origin develop
```

Depois, criar a branch da tarefa:

```bash
git switch -c feature/nome-modulo
```

Se a branch já existir:

```bash
git switch feature/nome-modulo
```

Antes de continuar, verificar se ela precisa incorporar as atualizações mais recentes da `develop`.

### 2. Depois de concluir uma tarefa

O fluxo obrigatório é:

1. Validar a implementação.
2. Executar os testes necessários.
3. Criar o commit na branch da tarefa.
4. Enviar a branch ao GitHub.
5. Abrir um Pull Request direcionado à `develop`.
6. Aguardar revisão e integração.
7. Atualizar a `develop` local após o merge.

Comandos após a integração:

```bash
git switch develop
git pull --ff-only origin develop
```

### 3. Proteção contra perda de alterações

- Nunca executar `git reset --hard` para forçar sincronização.
- Nunca executar `git clean -fd` sem autorização explícita.
- Nunca descartar alterações locais sem verificar seu conteúdo.
- Se houver alterações não commitadas, preservá-las antes de trocar de branch ou sincronizar.
- Se houver commits locais ainda não enviados, não sobrescrevê-los.
- Se houver conflitos, interromper a sincronização e resolver os conflitos preservando o trabalho existente.
- Nunca presumir que um commit local já está disponível no GitHub.
- Se não houver conexão com o repositório remoto, informar que a sincronização não foi realizada.

### 4. Regras obrigatórias

- A `develop` do GitHub é a referência de integração.
- Toda tarefa deve começar a partir da versão atualizada da `develop`.
- Todo trabalho deve ser integrado à `develop` por Pull Request.
- Não fazer commits diretamente na `develop`.
- Após cada integração, atualizar a cópia local antes de começar outra tarefa.
- Não criar READMEs, documentos de regras ou arquivos de instruções automaticamente durante a criação de branches.
- A sincronização nunca deve apagar ou sobrescrever trabalho de outro integrante.

## Exemplos de commits

```text
feat(enzo-recibo): cria modelo visual de recibo
docs(enzo-git): documenta fluxo de branches e commits
feat(henrique-clientes): adiciona consulta ViaCEP
feat(julia-produtos): cria regra de produto indisponivel
feat(nycollas-checkout): calcula frete do pedido
```

## Critério de pronto para qualquer checkbox

- [ ] **[Responsável da tarefa]** Código em TypeScript, validado sem erros de compilação.
- [ ] **[Responsável da tarefa]** Módulo testado com dados próprios ou mock, sem depender de outro módulo.
- [ ] **[Responsável da tarefa]** Commit criado e checkbox marcado.
- [ ] **[Revisor do PR]** Pull Request revisado antes do merge em `develop`.
