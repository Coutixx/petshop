import type { ItemCarrinho } from './item-carrinho'

export class CarrinhoService {
  private itens: ItemCarrinho[] = []

  adicionarItem(novoItem: ItemCarrinho): void {
    validarItem(novoItem)
    const itemExistente = this.itens.find((item) => item.produtoId === novoItem.produtoId)

    if (itemExistente) {
      if (itemExistente.precoUnitario !== novoItem.precoUnitario) {
        throw new Error('O preço do produto mudou. Atualize o carrinho.')
      }
      itemExistente.quantidade += novoItem.quantidade
      return
    }

    this.itens.push({ ...novoItem })
  }

  listarItens(): ItemCarrinho[] {
    return this.itens.map((item) => ({ ...item }))
  }

  removerItem(produtoId: number): boolean {
    const indice = this.itens.findIndex((item) => item.produtoId === produtoId)
    if (indice === -1) return false
    this.itens.splice(indice, 1)
    return true
  }

  calcularSubtotal(): number {
    const subtotal = this.itens.reduce((total, item) => total + item.precoUnitario * item.quantidade, 0)
    return Number(subtotal.toFixed(2))
  }

  limparCarrinho(): void {
    this.itens = []
  }
}

function validarItem(item: ItemCarrinho): void {
  if (!Number.isSafeInteger(item.produtoId) || item.produtoId < 1) throw new Error('ID do produto inválido.')
  if (!item.nome.trim()) throw new Error('O nome do produto é obrigatório.')
  if (!Number.isFinite(item.precoUnitario) || item.precoUnitario < 0) throw new Error('O preço do produto é inválido.')
  if (!Number.isSafeInteger(item.quantidade) || item.quantidade < 1) {
    throw new Error('A quantidade deve ser um número inteiro positivo.')
  }
}
