import type { ProdutoResumo } from '../../contracts'

export const categoriasProduto = ['Alimentação', 'Higiene', 'Brinquedos', 'Acessórios', 'Saúde'] as const
export type CategoriaProduto = typeof categoriasProduto[number]

// O preço de origem é preservado: a cotação não sobrescreve o cadastro.
export interface Produto {
  id: number
  nome: string
  categoria: CategoriaProduto
  moeda: 'BRL' | 'USD'
  preco: number
  importado: boolean
  estoque: number
}

export type ProdutoInput = Omit<Produto, 'id'>

export interface ProdutoRepository {
  listar(): Produto[]
  salvar(produto: Produto): void
  excluir(id: number): void
}

export interface CatalogoPedidos {
  listarResumos(taxa: number | null): ProdutoResumo[]
  validarDisponibilidade(itens: { produtoId: number; quantidade: number }[]): void
}

export function validarProduto(input: ProdutoInput): ProdutoInput {
  if (!input || typeof input.nome !== 'string' || !input.nome.trim() || input.nome.trim().length > 120) {
    throw new Error('Informe um nome de produto com até 120 caracteres.')
  }
  if (!categoriasProduto.includes(input.categoria)) throw new Error('Categoria inválida.')
  if (input.moeda !== 'BRL' && input.moeda !== 'USD') throw new Error('Moeda inválida.')
  if (!Number.isFinite(input.preco) || input.preco < 0.01 || input.preco > 999999.99) {
    throw new Error('Informe um preço maior que zero e até 999.999,99.')
  }
  if (typeof input.importado !== 'boolean') throw new Error('Informe se o produto é importado.')
  if (!Number.isSafeInteger(input.estoque) || input.estoque < 0 || input.estoque > 4294967295) {
    throw new Error('O estoque deve ser um número inteiro maior ou igual a zero.')
  }
  return { ...input, nome: input.nome.trim(), preco: Number(input.preco.toFixed(2)) }
}

export function converterPreco(produto: Pick<Produto, 'moeda' | 'preco'>, moeda: 'BRL' | 'USD', taxa: number | null): number | null {
  if (produto.moeda === moeda) return produto.preco
  if (taxa === null || !Number.isFinite(taxa) || taxa <= 0) return null
  const convertido = moeda === 'BRL' ? produto.preco * taxa : produto.preco / taxa
  return Number(convertido.toFixed(2))
}
