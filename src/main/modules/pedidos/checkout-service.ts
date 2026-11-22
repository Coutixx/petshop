import type { PedidoRascunho } from '../../../shared/contracts'
import { CarrinhoService } from './carrinho-service'
import { FreteService } from './frete-service'
import type { ItemCarrinho } from './item-carrinho'

export class CheckoutService {
  constructor(
    private readonly carrinhoService = new CarrinhoService(),
    private readonly freteService = new FreteService()
  ) {}

  adicionarProduto(produtoId: number, nome: string, precoUnitario: number, quantidade: number): void {
    this.carrinhoService.adicionarItem({ produtoId, nome, precoUnitario, quantidade })
  }

  calcularSubtotal(): number { return this.carrinhoService.calcularSubtotal() }

  calcularTotal(distanciaKm: number): { subtotal: number; frete: number; total: number } {
    const subtotal = this.calcularSubtotal()
    const frete = this.freteService.calcular(distanciaKm)
    return { subtotal, frete, total: Number((subtotal + frete).toFixed(2)) }
  }

  criarPedido(clienteId: number, entregadorId: number | null, distanciaKm: number): PedidoRascunho {
    validarId(clienteId, 'Cliente')
    if (entregadorId !== null) validarId(entregadorId, 'Entregador')
    const itens = this.carrinhoService.listarItens()
    if (!itens.length) throw new Error('O carrinho está vazio.')
    const { frete } = this.calcularTotal(distanciaKm)
    return {
      clienteId,
      entregadorId,
      itens: itens.map(({ produtoId, quantidade }) => ({ produtoId, quantidade })),
      frete,
      criadoEm: new Date().toISOString(),
      previsaoEntrega: null
    }
  }

  removerProduto(produtoId: number): boolean { return this.carrinhoService.removerItem(produtoId) }
  listarItens(): ItemCarrinho[] { return this.carrinhoService.listarItens() }
  limparCarrinho(): void { this.carrinhoService.limparCarrinho() }
}

function validarId(id: number, entidade: string): void {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error(`${entidade} inválido.`)
}
