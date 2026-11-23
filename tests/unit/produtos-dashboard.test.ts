import { describe, expect, it } from 'vitest'
import { indicadoresEstoque } from '../../src/shared/domain/produtos/dashboard'
import { produtosDemo } from '../../src/shared/domain/produtos/produtos-demo'
import { ProdutoService } from '../../src/shared/domain/produtos/produto-service'
import { ProdutoRepositoryLocal } from '../../src/shared/domain/produtos/produto-repository-local'

describe('dashboard e dados demonstrativos', () => {
  it('calcula unidades, indisponíveis, importados e valor convertido', () => {
    expect(indicadoresEstoque(produtosDemo, 5)).toMatchObject({ totalProdutos: 6, unidades: 51, importados: 2, valorEstoqueBRL: 3533.1, valoresPendentes: 0 })
    expect(indicadoresEstoque(produtosDemo, 5).semEstoque.map((item) => item.id)).toEqual([4, 5])
    expect(indicadoresEstoque(produtosDemo, 5).estoqueBaixo.map((item) => item.id)).toEqual([2])
  })
  it('informa valor parcial se há unidades em USD sem conversão', () => {
    expect(indicadoresEstoque(produtosDemo, null)).toMatchObject({ valorEstoqueBRL: 3095.6, valoresPendentes: 1 })
  })
  it('atualiza os indicadores ao editar, repor e excluir produtos', () => {
    const service = new ProdutoService(new ProdutoRepositoryLocal(produtosDemo))
    service.atualizarEstoque(4, 3)
    service.excluir(5)
    expect(indicadoresEstoque(service.listar(), 5)).toMatchObject({ totalProdutos: 5, unidades: 54, importados: 1, semEstoque: [] })
    expect(produtosDemo[3].estoque).toBe(0)
  })
  it('trata catálogo vazio', () => {
    expect(indicadoresEstoque([], null)).toMatchObject({ totalProdutos: 0, unidades: 0, valorEstoqueBRL: 0, semEstoque: [], estoqueBaixo: [], valoresPendentes: 0 })
  })
})
