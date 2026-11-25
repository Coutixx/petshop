import { describe, expect, it } from 'vitest'
import { ProdutoRepositoryLocal } from '../../src/shared/domain/produtos/produto-repository-local'
import { ProdutoService } from '../../src/shared/domain/produtos/produto-service'

function catalogo() {
  return new ProdutoService(new ProdutoRepositoryLocal([
    { id: 1, nome: 'Coleira', categoria: 'Acessórios', preco: 10, moeda: 'BRL', importado: false, estoque: 3 },
    { id: 2, nome: 'Brinquedo', categoria: 'Brinquedos', preco: 5, moeda: 'USD', importado: true, estoque: 0 }
  ]))
}

describe('disponibilidade para futura integração com pedidos', () => {
  it('identifica zero como indisponível e reflete reposição e baixa manual', () => {
    const service = catalogo()
    expect(service.listarResumos(5)).toEqual([
      { id: 1, nome: 'Coleira', preco: 10, disponivel: true },
      { id: 2, nome: 'Brinquedo', preco: 25, disponivel: false }
    ])
    service.atualizarEstoque(1, 0)
    service.atualizarEstoque(2, 2)
    expect(service.listarResumos(5).map((item) => item.disponivel)).toEqual([false, true])
    expect(service.listarResumos(null).map((item) => item.id)).toEqual([1])
  })
  it('valida quantidade acumulada por produto sem baixar estoque', () => {
    const service = catalogo()
    expect(() => service.validarDisponibilidade([{ produtoId: 1, quantidade: 1 }, { produtoId: 1, quantidade: 2 }])).not.toThrow()
    expect(service.obter(1).estoque).toBe(3)
    expect(() => service.validarDisponibilidade([{ produtoId: 1, quantidade: 2 }, { produtoId: 1, quantidade: 2 }])).toThrow('insuficiente')
    expect(() => service.validarDisponibilidade([{ produtoId: 2, quantidade: 1 }])).toThrow('insuficiente')
  })
  it.each([0, -1, 0.5, NaN, Infinity])('recusa quantidade inválida %s', (quantidade) => {
    expect(() => catalogo().validarDisponibilidade([{ produtoId: 1, quantidade }])).toThrow()
  })
  it('recusa pedido vazio e produto desconhecido', () => {
    expect(() => catalogo().validarDisponibilidade([])).toThrow('deve conter')
    expect(() => catalogo().validarDisponibilidade([{ produtoId: 99, quantidade: 1 }])).toThrow('não encontrado')
  })
})
