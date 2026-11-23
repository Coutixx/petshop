import type { ProdutoResumo } from '../../contracts'
import { converterPreco, validarProduto, type CatalogoPedidos, type Produto, type ProdutoInput, type ProdutoRepository } from './produto'

export class ProdutoService implements CatalogoPedidos {
  constructor(private readonly repository: ProdutoRepository) {}

  listar(): Produto[] { return this.repository.listar() }

  criar(input: ProdutoInput): Produto {
    const produto = { ...validarProduto(input), id: Math.max(0, ...this.listar().map((item) => item.id)) + 1 }
    this.repository.salvar(produto)
    return { ...produto }
  }

  atualizar(id: number, input: ProdutoInput): Produto {
    this.obter(id)
    const produto = { ...validarProduto(input), id }
    this.repository.salvar(produto)
    return { ...produto }
  }

  excluir(id: number): void { this.obter(id); this.repository.excluir(id) }

  obter(id: number): Produto {
    const produto = this.listar().find((item) => item.id === id)
    if (!produto) throw new Error('Produto não encontrado.')
    return produto
  }

  atualizarEstoque(id: number, estoque: number): Produto {
    return this.atualizar(id, { ...this.obter(id), estoque })
  }

  listarResumos(taxa: number | null): ProdutoResumo[] {
    return this.listar().flatMap((produto) => {
      const preco = converterPreco(produto, 'BRL', taxa)
      // Não oferecemos um produto com preço inventado quando a conversão não existe.
      return preco === null ? [] : [{ id: produto.id, nome: produto.nome, preco, disponivel: produto.estoque > 0 }]
    })
  }

  validarDisponibilidade(itens: { produtoId: number; quantidade: number }[]): void {
    if (!itens.length) throw new Error('O pedido deve conter produtos.')
    const quantidades = new Map<number, number>()
    for (const item of itens) {
      if (!Number.isSafeInteger(item.quantidade) || item.quantidade < 1) {
        throw new Error('A quantidade solicitada deve ser inteira e positiva.')
      }
      const quantidade = (quantidades.get(item.produtoId) ?? 0) + item.quantidade
      if (!Number.isSafeInteger(quantidade) || quantidade > this.obter(item.produtoId).estoque) {
        throw new Error(`Estoque insuficiente para ${this.obter(item.produtoId).nome}.`)
      }
      quantidades.set(item.produtoId, quantidade)
    }
    // Somente valida. A baixa atômica será feita na transação de venda do backend.
  }
}
