# Checkout: migrations e configuração

Antes de usar as rotas de entregadores e checkout com MySQL, aplique `002-entregadores.sql` depois de `001-inicial.sql`. A alteração adiciona os campos de veículo e disponibilidade usados pelo IPC.

O checkout lista produtos disponíveis, grava o pedido e seus itens dentro de uma transação, desconta o estoque e reserva o entregador escolhido. Em falha de estoque, o pedido inteiro sofre rollback.

Configure `STORE_ADDRESS` no `.env` com o endereço real de origem da loja. O endereço cadastrado no cliente será usado como destino. A geocodificação usa Nominatim e o cálculo de rota usa OSRM; ambas as chamadas ocorrem no processo principal e possuem timeout.
