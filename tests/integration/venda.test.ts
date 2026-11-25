import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { afterAll, expect, it } from 'vitest'
import { getMySqlPool } from '../../src/main/database/connection'
import { MySqlClienteRepository } from '../../src/main/modules/clientes/cliente-repository'
import { ProdutoRepository } from '../../src/main/modules/produtos/produto-repository'
import { EntregadorPersistenceService } from '../../src/main/modules/entregadores/entregador-persistence-service'
import { PedidoService } from '../../src/main/modules/pedidos/pedido-service'
import { PedidoRepository } from '../../src/main/modules/pedidos/pedido-repository'

const clientes = new MySqlClienteRepository()
const produtos = new ProdutoRepository()
const entregadores = new EntregadorPersistenceService()
const identificador = randomUUID()
let clienteId: number | undefined
let entregadorId: number | undefined
let produtoId: number | undefined

it('confirma apenas uma venda da última unidade e preserva o recibo após mudança de cotação', async () => {
  let taxa = 5
  const pedidos = new PedidoService(new PedidoRepository(() => taxa))
  const cliente = await clientes.criar({
    nome: 'Teste ' + identificador, email: null, telefone: '19999990000', cpf: null,
    cep: '13013082', logradouro: 'Rua Barreto Leme', numero: '100', bairro: 'Centro',
    cidade: 'Campinas', uf: 'SP', complemento: null
  })
  clienteId = cliente.id
  const entregador = await entregadores.criar({ nome: identificador, telefone: '19999990001', veiculo: 'Moto', disponivel: true })
  entregadorId = entregador.id
  expect((await entregadores.listar()).find(item => item.id === entregadorId)).toMatchObject(entregador)
  const atualizado = await entregadores.atualizar(entregadorId, { ...entregador, veiculo: 'Carro', disponivel: false }, entregador)
  expect((await entregadores.listar()).find(item => item.id === entregadorId)).toMatchObject({ veiculo: 'Carro', disponivel: false })
  await entregadores.atualizar(entregadorId, entregador, atualizado)
  await clientes.atualizar(clienteId, { ...cliente, complemento: 'Teste de atualização' })
  expect((await clientes.buscarPorId(clienteId))?.complemento).toBe('Teste de atualização')
  await produtos.criar({ nome: identificador, categoria: 'Higiene', moeda: 'USD', preco: 4, importado: true, estoque: 1 })
  const produto = (await produtos.listar()).find(item => item.nome === identificador)!
  produtoId = produto.id
  await produtos.atualizar(produtoId, { ...produto, preco: 5 }, 1)
  expect((await produtos.listar()).find(item => item.id === produtoId)?.preco).toBe(5)
  await produtos.atualizar(produtoId, produto, 1)
  expect((await produtos.listarDisponiveis(null)).some(p => p.id === produto.id)).toBe(false)
  const input = { clienteId, entregadorId: null, itens: [{ produtoId, quantidade: 1, precoEsperado: 20 }], distanciaKm: 2, duracaoMinutos: 10 }
  await expect(pedidos.criar({ ...input, entregadorId, itens: [{ produtoId, quantidade: 2 }] })).rejects.toThrow('Estoque insuficiente')
  expect((await entregadores.listar()).find(item => item.id === entregadorId)?.disponivel).toBe(true)

  // Simula falha depois do primeiro INSERT de item e da primeira baixa de estoque.
  // A restrição única do MySQL rejeita o segundo item duplicado.
  const repositorio = new PedidoRepository(() => taxa)
  await expect(repositorio.criar({ ...input, entregadorId, itens: [...input.itens, ...input.itens] }))
    .rejects.toMatchObject({ code: 'ER_DUP_ENTRY' })
  expect((await pedidos.listar()).filter(p => p.clienteId === clienteId)).toHaveLength(0)
  expect((await produtos.listar()).find(p => p.id === produtoId)?.estoque).toBe(1)

  const resultados = await Promise.allSettled([pedidos.criar(input), pedidos.criar(input)])
  expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  expect((await produtos.listar()).find(p => p.id === produto.id)?.estoque).toBe(0)
  await expect(produtos.atualizar(produto.id, produto, 1)).rejects.toThrow('O produto mudou')
  taxa = 6
  await produtos.excluir(produto.id)
  const vendas = (await pedidos.listar()).filter(p => p.clienteId === clienteId)
  expect(vendas).toHaveLength(1)
  expect(vendas[0]).toMatchObject({ frete: 5, total: 25, itens: [{ produtoId, quantidade: 1, precoUnitario: 20 }] })
  expect((await produtos.listar()).some(item => item.id === produtoId)).toBe(false)
  await entregadores.excluir(entregadorId)
  expect((await entregadores.listar()).some(item => item.id === entregadorId)).toBe(false)
})

afterAll(async () => {
  const pool = getMySqlPool()
  try {
    if (clienteId) {
      await pool.execute('DELETE FROM pedidos WHERE cliente_id = ?', [clienteId])
      await clientes.excluir(clienteId)
    }
    if (produtoId) await pool.execute('DELETE FROM produtos WHERE id = ?', [produtoId])
    if (entregadorId) await pool.execute('DELETE FROM entregadores WHERE id = ?', [entregadorId])
  } finally {
    await pool.end()
  }
})
