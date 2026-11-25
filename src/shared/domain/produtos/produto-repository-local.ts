import { validarProduto, type Produto, type ProdutoRepository } from './produto'

export interface CatalogoStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const storageKey = 'petshop.julia.produtos.v1'

// Adaptador isolado; Henrique poderá fornecer outro repository sem mudar as regras.
export class ProdutoRepositoryLocal implements ProdutoRepository {
  private produtos: Produto[]

  constructor(iniciais: Produto[] = [], private readonly storage?: CatalogoStorage) {
    const salvo = storage?.getItem(storageKey)
    this.produtos = this.validarLista(salvo === null || salvo === undefined ? iniciais : JSON.parse(salvo))
  }

  listar(): Produto[] { return this.produtos.map((produto) => ({ ...produto })) }

  salvar(produto: Produto): void {
    const produtos = this.listar()
    const indice = produtos.findIndex((item) => item.id === produto.id)
    if (indice === -1) produtos.push(produto)
    else produtos[indice] = produto
    this.persistir(this.validarLista(produtos))
  }

  excluir(id: number): void {
    this.persistir(this.produtos.filter((produto) => produto.id !== id))
  }

  private persistir(produtos: Produto[]): void {
    // Em caso de falha de gravação, não alteramos o estado em memória.
    this.storage?.setItem(storageKey, JSON.stringify(produtos))
    this.produtos = produtos
  }

  private validarLista(value: unknown): Produto[] {
    if (!Array.isArray(value)) throw new Error('Catálogo local inválido.')
    const ids = new Set<number>()
    return value.map((item: Produto) => {
      if (!item || !Number.isSafeInteger(item.id) || item.id < 1 || ids.has(item.id)) {
        throw new Error('Identificador de produto inválido ou duplicado.')
      }
      ids.add(item.id)
      return { ...validarProduto(item), id: item.id }
    })
  }
}
