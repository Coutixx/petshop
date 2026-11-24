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

interface PedidoRow extends RowDataPacket {
  id: number
  cliente_id: number
  cliente_nome: string
  cliente_email: string | null
  entregador_id: number | null
  subtotal: number | string
  frete: number | string
  criado_em: Date | string
  previsao_entrega: Date | string | null
}

interface ItemPedidoRow extends RowDataPacket {
  produto_id: number
  nome: string
  quantidade: number
  preco_unitario: number | string
}

export class PedidoRepository {
  async criar(input: CriarPedidoInput): Promise<PedidoRegistrado> {
    const connection = await getMySqlPool().getConnection()
    const criadoEm = new Date()
    const previsaoEntrega = new Date(criadoEm.getTime() + (Math.max(30, input.duracaoMinutos + 20) * 60_000))

    try {
      await connection.beginTransaction()
      const [clienteRows] = await connection.execute<RowDataPacket[]>(
        'SELECT id, nome, email FROM clientes WHERE id = ? LIMIT 1', [input.clienteId]
      )
      if (!clienteRows.length) throw new PedidoOperacaoError('Cliente não encontrado.')
      const cliente = clienteRows[0] as { id: number; nome: string; email: string | null }

      if (input.entregadorId !== null) {
        const [entregadorRows] = await connection.execute<RowDataPacket[]>(
          'SELECT id FROM entregadores WHERE id = ? AND ativo = TRUE AND disponivel = TRUE FOR UPDATE',
          [input.entregadorId]
        )
        if (!entregadorRows.length) throw new PedidoOperacaoError('Entregador não encontrado ou indisponível.')
      }

      let subtotal = 0
      const itens: Array<{ produtoId: number; nome: string; quantidade: number; preco: number }> = []
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
        itens.push({ produtoId: item.produtoId, nome: produto.nome, quantidade: item.quantidade, preco })
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
        clienteNome: cliente.nome,
        clienteEmail: cliente.email,
        entregadorId: input.entregadorId,
        itens: itens.map(({ produtoId, nome, quantidade, preco }) => ({
          produtoId,
          nome,
          precoUnitario: preco,
          quantidade,
          subtotal: Number((preco * quantidade).toFixed(2)),
        })),
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

  async listar(): Promise<PedidoRegistrado[]> {
    const pool = getMySqlPool()
    const [pedidoRows] = await pool.execute<PedidoRow[]>(`
      SELECT p.id, p.cliente_id, c.nome AS cliente_nome, c.email AS cliente_email,
             p.entregador_id, p.subtotal, p.frete, p.criado_em, p.previsao_entrega
      FROM pedidos p
      JOIN clientes c ON c.id = p.cliente_id
      ORDER BY p.criado_em DESC, p.id DESC
    `)

    const pedidos: PedidoRegistrado[] = []
    for (const pedido of pedidoRows) {
      const [itemRows] = await pool.execute<ItemPedidoRow[]>(`
        SELECT ip.produto_id, pr.nome, ip.quantidade, ip.preco_unitario
        FROM itens_pedido ip
        JOIN produtos pr ON pr.id = ip.produto_id
        WHERE ip.pedido_id = ?
        ORDER BY ip.id
      `, [pedido.id])

      const subtotal = Number(pedido.subtotal)
      const frete = Number(pedido.frete)
      pedidos.push({
        id: pedido.id,
        clienteId: pedido.cliente_id,
        clienteNome: pedido.cliente_nome,
        clienteEmail: pedido.cliente_email,
        entregadorId: pedido.entregador_id,
        itens: itemRows.map((item) => {
          const precoUnitario = Number(item.preco_unitario)
          return {
            produtoId: item.produto_id,
            nome: item.nome,
            precoUnitario,
            quantidade: item.quantidade,
            subtotal: Number((precoUnitario * item.quantidade).toFixed(2)),
          }
        }),
        subtotal,
        frete,
        total: Number((subtotal + frete).toFixed(2)),
        criadoEm: new Date(pedido.criado_em).toISOString(),
        previsaoEntrega: pedido.previsao_entrega
          ? new Date(pedido.previsao_entrega).toISOString()
          : null,
      })
    }
    return pedidos
  }
}

function mysqlDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}
