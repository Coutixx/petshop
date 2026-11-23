import type { CriarPedidoInput, PedidoRegistrado } from '../../../shared/contracts'
import { PedidoRepository } from './pedido-repository'

export interface PedidoRepositoryPort {
  criar(input: CriarPedidoInput): Promise<PedidoRegistrado>
}

export class PedidoEntradaInvalidaError extends Error {
  constructor(message: string) { super(message); this.name = 'PedidoEntradaInvalidaError' }
}

export class PedidoService {
  constructor(private readonly repository: PedidoRepositoryPort = new PedidoRepository()) {}

  criar(input: CriarPedidoInput): Promise<PedidoRegistrado> {
    if (!input || typeof input !== 'object') throw new PedidoEntradaInvalidaError('Dados do pedido inválidos.')
    validarId(input.clienteId, 'Cliente')
    if (input.entregadorId !== null) validarId(input.entregadorId, 'Entregador')
    if (!Array.isArray(input.itens) || input.itens.length === 0) throw new PedidoEntradaInvalidaError('O carrinho está vazio.')
    if (!Number.isFinite(input.distanciaKm) || input.distanciaKm < 0) throw new PedidoEntradaInvalidaError('Distância inválida.')
    if (!Number.isFinite(input.duracaoMinutos) || input.duracaoMinutos < 0) throw new PedidoEntradaInvalidaError('Duração da rota inválida.')

    const quantidades = new Map<number, number>()
    for (const item of input.itens) {
      if (!item || typeof item !== 'object') throw new PedidoEntradaInvalidaError('Item de pedido inválido.')
      validarId(item.produtoId, 'Produto')
      if (!Number.isSafeInteger(item.quantidade) || item.quantidade < 1) throw new PedidoEntradaInvalidaError('Quantidade inválida.')
      quantidades.set(item.produtoId, (quantidades.get(item.produtoId) ?? 0) + item.quantidade)
    }
    return this.repository.criar({
      ...input,
      itens: [...quantidades].map(([produtoId, quantidade]) => ({ produtoId, quantidade }))
    })
  }
}

function validarId(id: number, label: string): void {
  if (!Number.isSafeInteger(id) || id < 1) throw new PedidoEntradaInvalidaError(`${label} inválido.`)
}
