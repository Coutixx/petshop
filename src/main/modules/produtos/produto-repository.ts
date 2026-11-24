import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { ProdutoResumo } from '../../../shared/contracts'
import { converterPreco, validarProduto, type Produto, type ProdutoInput } from '../../../shared/domain/produtos/produto'
import { getMySqlPool } from '../../database/connection'

export class ProdutoOperacaoError extends Error {}

function campos(input: ProdutoInput) {
  let produto: ProdutoInput
  try {
    produto = validarProduto(input)
  } catch (error) {
    throw new ProdutoOperacaoError(error instanceof Error ? error.message : 'Produto inválido.')
  }
  const { nome, categoria, moeda, preco, importado, estoque } = produto
  return [nome, categoria, moeda, moeda === 'BRL' ? preco : null, moeda === 'USD' ? preco : null, importado, estoque]
}

export class ProdutoRepository {
  async listar(): Promise<Produto[]> {
    const [rows] = await getMySqlPool().execute<RowDataPacket[]>(
      `SELECT id, nome, categoria, moeda, IF(moeda = 'USD', preco_usd, preco_brl) AS preco,
              importado, quantidade_estoque AS estoque
       FROM produtos WHERE ativo = TRUE ORDER BY nome, id`
    )
    return rows.map(row => ({
      id: row.id, nome: row.nome, categoria: row.categoria, moeda: row.moeda,
      preco: Number(row.preco), importado: Boolean(row.importado), estoque: row.estoque
    }))
  }

  async listarDisponiveis(taxa: number | null): Promise<ProdutoResumo[]> {
    return (await this.listar()).flatMap(produto => {
      const preco = converterPreco(produto, 'BRL', taxa)
      return preco === null ? [] : [{
        id: produto.id, nome: produto.nome, categoria: produto.categoria, preco, disponivel: produto.estoque > 0
      }]
    })
  }

  async criar(input: ProdutoInput): Promise<void> {
    await getMySqlPool().execute(
      `INSERT INTO produtos (nome, categoria, moeda, preco_brl, preco_usd, importado, quantidade_estoque)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, campos(input)
    )
  }

  async atualizar(id: number, input: ProdutoInput, estoqueAnterior: number): Promise<void> {
    const [result] = await getMySqlPool().execute<ResultSetHeader>(
      `UPDATE produtos SET nome = ?, categoria = ?, moeda = ?, preco_brl = ?, preco_usd = ?,
              importado = ?, quantidade_estoque = ?
       WHERE id = ? AND ativo = TRUE AND quantidade_estoque = ?`,
      [...campos(input), id, estoqueAnterior]
    )
    if (!result.affectedRows) throw new ProdutoOperacaoError('O produto mudou. Reabra o cadastro para editar o estoque atual.')
  }

  async excluir(id: number): Promise<void> {
    const [result] = await getMySqlPool().execute<ResultSetHeader>(
      'UPDATE produtos SET ativo = FALSE WHERE id = ? AND ativo = TRUE', [id]
    )
    if (!result.affectedRows) throw new ProdutoOperacaoError('Produto não encontrado.')
  }
}
