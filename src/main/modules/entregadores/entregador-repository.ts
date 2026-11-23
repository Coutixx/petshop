import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { EntregadorInput, EntregadorResumo } from '../../../shared/contracts'
import { getMySqlPool } from '../../database/connection'

interface EntregadorRow extends RowDataPacket {
  id: number
  nome: string
  telefone: string
  veiculo: string
  disponivel: number | boolean
}

const fields = 'id, nome, telefone, veiculo, disponivel'

export class EntregadorRepository {
  async listar(): Promise<EntregadorResumo[]> {
    const [rows] = await getMySqlPool().execute<EntregadorRow[]>(
      `SELECT ${fields} FROM entregadores WHERE ativo = TRUE ORDER BY nome, id`
    )
    return rows.map(normalizar)
  }

  async criar(input: EntregadorInput): Promise<EntregadorResumo> {
    const [result] = await getMySqlPool().execute<ResultSetHeader>(
      'INSERT INTO entregadores (nome, telefone, veiculo, disponivel) VALUES (?, ?, ?, ?)',
      [input.nome, input.telefone, input.veiculo, input.disponivel]
    )
    const created = await this.buscarPorId(result.insertId)
    if (!created) throw new Error('Não foi possível carregar o entregador criado.')
    return created
  }

  async atualizar(id: number, input: EntregadorInput): Promise<EntregadorResumo | null> {
    await getMySqlPool().execute<ResultSetHeader>(
      `UPDATE entregadores SET nome = ?, telefone = ?, veiculo = ?, disponivel = ?
       WHERE id = ? AND ativo = TRUE`,
      [input.nome, input.telefone, input.veiculo, input.disponivel, id]
    )
    return this.buscarPorId(id)
  }

  async excluir(id: number): Promise<boolean> {
    const [result] = await getMySqlPool().execute<ResultSetHeader>(
      'UPDATE entregadores SET ativo = FALSE, disponivel = FALSE WHERE id = ? AND ativo = TRUE', [id]
    )
    return result.affectedRows > 0
  }

  private async buscarPorId(id: number): Promise<EntregadorResumo | null> {
    const [rows] = await getMySqlPool().execute<EntregadorRow[]>(
      `SELECT ${fields} FROM entregadores WHERE id = ? AND ativo = TRUE LIMIT 1`, [id]
    )
    return rows[0] ? normalizar(rows[0]) : null
  }
}

function normalizar(row: EntregadorRow): EntregadorResumo {
  return { id: row.id, nome: row.nome, telefone: row.telefone, veiculo: row.veiculo, disponivel: Boolean(row.disponivel) }
}
