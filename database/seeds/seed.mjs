import 'dotenv/config'
import mysql from 'mysql2/promise'
import { randomBytes, scryptSync } from 'node:crypto'

const { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD } = process.env
const adminName = process.env.SEED_ADMIN_NAME?.trim()
const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
const adminPassword = process.env.SEED_ADMIN_PASSWORD
const port = Number(process.env.DB_PORT || 3306)

if (!DB_HOST || !DB_NAME || !DB_USER || DB_PASSWORD === undefined) {
  throw new Error('Preencha DB_HOST, DB_NAME, DB_USER e DB_PASSWORD no .env.')
}
if (!adminName || !adminEmail || !adminPassword || adminPassword.length < 12) {
  throw new Error('Defina SEED_ADMIN_NAME, SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD (mínimo 12 caracteres).')
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('DB_PORT precisa ser uma porta válida.')
}

const salt = randomBytes(16).toString('hex')
const passwordHash = scryptSync(adminPassword, salt, 64).toString('hex')
const connection = await mysql.createConnection({
  host: DB_HOST.trim(),
  port,
  database: DB_NAME.trim(),
  user: DB_USER.trim(),
  password: DB_PASSWORD,
  connectTimeout: 5000
})

try {
  await connection.beginTransaction()
  const [adminResult] = await connection.execute(
    `INSERT IGNORE INTO usuarios (nome, email, senha_hash, nivel)
     VALUES (?, ?, ?, 'admin')`,
    [adminName, adminEmail, `scrypt$${salt}$${passwordHash}`]
  )

  const demoClients = [
    ['Cliente Demonstração', 'cliente.demo@local.invalid', '(19) 3000-0000', '13013082', 'Rua Barreto Leme', '1100', 'Centro', 'Campinas', 'SP'],
    ['Ana de Teste', 'ana.teste@local.invalid', '(19) 3000-0001', '13015081', 'Avenida Francisco Glicério', '1000', 'Centro', 'Campinas', 'SP']
  ]

  for (const [name, email, phone, postalCode, street, number, neighborhood, city, state] of demoClients) {
    await connection.execute(
      `INSERT INTO clientes (nome, email, telefone, cep, logradouro, numero, bairro, cidade, uf)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE email = ?)`,
      [name, email, phone, postalCode, street, number, neighborhood, city, state, email]
    )
  }

  const produtos = [
    ['Ração para cães adultos', 'Alimentação', 49.90, 18],
    ['Shampoo neutro', 'Higiene', 22.50, 4],
    ['Bola de borracha', 'Brinquedos', 12, 0]
  ]
  for (const [nome, categoria, preco, estoque] of produtos) {
    await connection.execute(
      `INSERT INTO produtos (nome, categoria, preco_brl, quantidade_estoque)
       SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE nome = ?)`,
      [nome, categoria, preco, estoque, nome]
    )
  }
  await connection.execute(
    `INSERT INTO entregadores (nome, telefone, veiculo)
     SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM entregadores WHERE telefone = ?)`,
    ['Entregador de demonstração', '19900000002', 'Bicicleta', '19900000002']
  )
  await connection.commit()
  console.log(adminResult.affectedRows === 1
    ? 'Administrador de demonstração criado.'
    : 'Administrador já existente; senha mantida.')
  console.log('Clientes, produtos e entregador de demonstração verificados.')
} catch (error) {
  await connection.rollback()
  throw error
} finally {
  await connection.end()
}
