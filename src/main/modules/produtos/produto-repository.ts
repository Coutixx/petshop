import type { RowDataPacket } from 'mysql2'
import type { ProdutoResumo } from '../../../shared/contracts'
import { getMySqlPool } from '../../database/connection'

interface ProdutoRow extends RowDataPacket {
  id: number
  nome: string
  categoria: string
  preco: number | string
  disponivel: number | boolean
}

export class ProdutoRepository {
  async listarDisponiveis(): Promise<ProdutoResumo[]> {
    const [rows] = await getMySqlPool().execute<ProdutoRow[]>(
      `SELECT id, nome, categoria, preco_brl AS preco,
        (quantidade_estoque > 0) AS disponivel
       FROM produtos ORDER BY nome, id`
    )
    return rows.map(row => ({
      id: row.id,
      nome: row.nome,
      categoria: row.categoria,
      preco: Number(row.preco),
      disponivel: Boolean(row.disponivel)
    }))
  }
}
