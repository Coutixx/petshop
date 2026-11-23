import { describe, expect, it, vi } from 'vitest'
import type { CriarPedidoInput, PedidoRegistrado } from '../../src/shared/contracts'
import { PedidoEntradaInvalidaError, PedidoService, type PedidoRepositoryPort } from '../../src/main/modules/pedidos/pedido-service'

const resultado: PedidoRegistrado = {
  id: 5, clienteId: 2, entregadorId: null,
  itens: [{ produtoId: 8, quantidade: 3 }], subtotal: 30, frete: 5, total: 35,
  criadoEm: '2026-11-23T12:00:00.000Z', previsaoEntrega: '2026-11-23T12:30:00.000Z'
}

describe('PedidoService', () => {
  it('valida o checkout e consolida itens repetidos antes da persistência', async () => {
    const criar = vi.fn(async () => resultado)
    const service = new PedidoService({ criar } satisfies PedidoRepositoryPort)
    const input: CriarPedidoInput = {
      clienteId: 2, entregadorId: null, distanciaKm: 2, duracaoMinutos: 8,
      itens: [{ produtoId: 8, quantidade: 1 }, { produtoId: 8, quantidade: 2 }]
    }
    await expect(service.criar(input)).resolves.toEqual(resultado)
    expect(criar).toHaveBeenCalledWith({ ...input, itens: [{ produtoId: 8, quantidade: 3 }] })
  })

  it('rejeita pedido sem itens ou com quantidade inválida', async () => {
    const service = new PedidoService({ criar: vi.fn(async () => resultado) })
    expect(() => service.criar({ clienteId: 2, entregadorId: null, itens: [], distanciaKm: 1, duracaoMinutos: 1 }))
      .toThrow(PedidoEntradaInvalidaError)
    expect(() => service.criar({ clienteId: 2, entregadorId: null, itens: [{ produtoId: 8, quantidade: 0 }], distanciaKm: 1, duracaoMinutos: 1 }))
      .toThrow('Quantidade inválida.')
  })
})
