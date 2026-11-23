import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { CriarPedidoInput, PedidoRegistrado } from '../../../shared/contracts'
import { getMySqlPool } from '../../database/connection'
import { FreteService } from './frete-service'
import { PedidoOperacaoError } from './pedido-errors'

interface ProdutoPedidoRow extends RowDataPacket {
  id: number
  nome: string
  preco: number | string
  quantidade_estoque: number
}

export class PedidoRepository {
  async criar(input: CriarPedidoInput): Promise<PedidoRegistrado> {
    const connection = await getMySqlPool().getConnection()
    const criadoEm = new Date()
    const previsaoEntrega = new Date(criadoEm.getTime() + (Math.max(30, input.duracaoMinutos + 20) * 60_000))

    try {
      await connection.beginTransaction()
      const [clienteRows] = await connection.execute<RowDataPacket[]>(
        'SELECT id FROM clientes WHERE id = ? LIMIT 1', [input.clienteId]
      )
      if (!clienteRows.length) throw new PedidoOperacaoError('Cliente não encontrado.')

      if (input.entregadorId !== null) {
        const [entregadorRows] = await connection.execute<RowDataPacket[]>(
          'SELECT id FROM entregadores WHERE id = ? AND ativo = TRUE AND disponivel = TRUE FOR UPDATE',
          [input.entregadorId]
        )
        if (!entregadorRows.length) throw new PedidoOperacaoError('Entregador não encontrado ou indisponível.')
      }

      let subtotal = 0
      const itens: Array<{ produtoId: number; quantidade: number; preco: number }> = []
      for (const item of input.itens) {
        const [produtoRows] = await connection.execute<ProdutoPedidoRow[]>(
          `SELECT id, nome, preco_brl AS preco, quantidade_estoque
           FROM produtos WHERE id = ? FOR UPDATE`, [item.produtoId]
        )
        const produto = produtoRows[0]
        if (!produto) throw new PedidoOperacaoError(`Produto ${item.produtoId} não encontrado.`)
        if (produto.quantidade_estoque < item.quantidade) throw new PedidoOperacaoError(`Estoque insuficiente para ${produto.nome}.`)
        const preco = Number(produto.preco)
        subtotal += preco * item.quantidade
        itens.push({ produtoId: item.produtoId, quantidade: item.quantidade, preco })
      }
      subtotal = Number(subtotal.toFixed(2))
      const frete = new FreteService().calcular(input.distanciaKm)
      const total = Number((subtotal + frete).toFixed(2))

      const [orderResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO pedidos (cliente_id, entregador_id, status, subtotal, frete, criado_em, previsao_entrega)
         VALUES (?, ?, 'aberto', ?, ?, ?, ?)`,
        [input.clienteId, input.entregadorId, subtotal, frete, mysqlDate(criadoEm), mysqlDate(previsaoEntrega)]
      )

      for (const item of itens) {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)`,
          [orderResult.insertId, item.produtoId, item.quantidade, item.preco]
        )
        const [stockResult] = await connection.execute<ResultSetHeader>(
          `UPDATE produtos SET quantidade_estoque = quantidade_estoque - ?
           WHERE id = ? AND quantidade_estoque >= ?`,
          [item.quantidade, item.produtoId, item.quantidade]
        )
        if (!stockResult.affectedRows) throw new PedidoOperacaoError('O estoque mudou durante o checkout. Tente novamente.')
      }

      if (input.entregadorId !== null) {
        await connection.execute<ResultSetHeader>(
          'UPDATE entregadores SET disponivel = FALSE WHERE id = ? AND disponivel = TRUE', [input.entregadorId]
        )
      }
      await connection.commit()
      return {
        id: orderResult.insertId,
        clienteId: input.clienteId,
        entregadorId: input.entregadorId,
        itens: itens.map(({ produtoId, quantidade }) => ({ produtoId, quantidade })),
        subtotal,
        frete,
        total,
        criadoEm: criadoEm.toISOString(),
        previsaoEntrega: previsaoEntrega.toISOString()
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
}

function mysqlDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}
