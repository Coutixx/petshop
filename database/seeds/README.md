Com as três migrações aplicadas, preencha `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` no `.env`. Use uma senha de pelo menos 12 caracteres e execute `npm run db:seed`.

O seed grava o administrador, dois clientes, três produtos e um entregador em uma transação. Identifica contas e clientes pelo e-mail, produtos pelo nome e o entregador pelo telefone. Repetir o comando preserva a senha, o estoque e a disponibilidade existentes.
