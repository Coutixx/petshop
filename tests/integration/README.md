# Venda em MySQL

Aponte o `.env` para um banco de teste com as três migrações aplicadas e execute `npm run test:integration`. O teste cria um cliente, um entregador e um produto com identificadores próprios. Ao terminar, remove os registros que criou. O seed é opcional para este teste.

O cenário verifica o preço de um produto em dólar, rollback após falha na gravação dos itens, concorrência na compra da última unidade e leitura do recibo depois de mudar a cotação e arquivar o produto.

Para verificar o fluxo pela interface, use a conta do seed e configure `STORE_ADDRESS`. Cadastre um cliente e um produto, abra o caixa, adicione o produto e escolha o cliente e um entregador. Calcule o frete, confirme a venda e abra o recibo no histórico. Confira o estoque no catálogo, a disponibilidade do entregador e o retorno à tela de login ao sair.
