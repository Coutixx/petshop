import { describe, expect, it } from 'vitest'
import { converterPreco, validarProduto, type ProdutoInput } from '../../src/shared/domain/produtos/produto'

const input: ProdutoInput = { nome: 'Coleira', categoria: 'Acessórios', moeda: 'USD', preco: 12.5, importado: true, estoque: 5 }

describe('categorias e preços de produtos', () => {
  it('converte nas duas direções e preserva o preço na moeda de origem', () => {
    expect(converterPreco(input, 'BRL', 5.1234)).toBe(64.04)
    expect(converterPreco({ moeda: 'BRL', preco: 64.04 }, 'USD', 5.1234)).toBe(12.5)
    expect(converterPreco(input, 'USD', null)).toBe(12.5)
    expect(input.preco).toBe(12.5)
  })
  it.each([null, 0, -1, NaN, Infinity])('não inventa conversões com taxa %s', (taxa) => {
    expect(converterPreco(input, 'BRL', taxa)).toBeNull()
  })
  it.each([
    { nome: '' }, { nome: ' ' }, { nome: 'x'.repeat(121) }, { categoria: 'Inválida' },
    { moeda: 'EUR' }, { preco: -1 }, { preco: 0 }, { preco: NaN }, { preco: Infinity },
    { preco: 1000000 }, { estoque: -1 }, { estoque: 1.2 }, { estoque: NaN }, { estoque: Number.MAX_SAFE_INTEGER + 1 },
    { importado: 'sim' }
  ])('recusa campo inválido: %j', (alteracao) => {
    expect(() => validarProduto({ ...input, ...alteracao } as ProdutoInput)).toThrow()
  })
  it('aceita importado com preço BRL e arredonda valores monetários', () => {
    expect(validarProduto({ ...input, moeda: 'BRL', preco: 12.567 })).toMatchObject({ importado: true, moeda: 'BRL', preco: 12.57 })
  })
})
