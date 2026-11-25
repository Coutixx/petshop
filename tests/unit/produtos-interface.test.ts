// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarCatalogo } from '../../src/renderer/src/modules/produtos/catalogo'

import { ProdutoRepositoryLocal } from '../../src/shared/domain/produtos/produto-repository-local'
import { ProdutoService } from '../../src/shared/domain/produtos/produto-service'
import { produtosDemo } from '../../src/shared/domain/produtos/produtos-demo'
import { CotacaoService } from '../../src/shared/domain/produtos/cotacao-service'
import type { CatalogoApi } from '../../src/renderer/src/modules/produtos/catalogo'

function apiCatalogo(): CatalogoApi {
  const service = new ProdutoService(new ProdutoRepositoryLocal(produtosDemo))
  const cambio = new CotacaoService()
  return {
    listarCatalogo: vi.fn(async () => service.listar()),
    criarProduto: async input => { service.criar(input) },
    atualizarProduto: async (id, input) => { service.atualizar(id, input) },
    excluirProduto: async id => service.excluir(id),
    atualizarCotacao: () => cambio.atualizar()
  }
}

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

function valor(id: string, value: string): void { element<HTMLInputElement>(id).value = value }

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = '<section id="clients-view"></section>'
  vi.restoreAllMocks()
})

describe('interface de produtos e navegação', () => {
  it('aguarda a abertura da tela autenticada para consultar produtos', async () => {
    const api = apiCatalogo()
    const catalogo = iniciarCatalogo(api)
    catalogo.mostrar('', false)
    expect(api.listarCatalogo).not.toHaveBeenCalled()
    expect(element('catalog-content').classList.contains('d-none')).toBe(true)
    catalogo.mostrar('produtos', false)
    await vi.waitFor(() => expect(element('products-list').children.length).toBe(6))
    expect(element('products-list').textContent).not.toContain('Excluir')
    catalogo.encerrar()
    catalogo.mostrar('', false)
    expect(element('products-list').children.length).toBe(0)
  })

  it('cadastra, edita estoque, busca, filtra e exclui pelo formulário', async () => {
    const catalogo = iniciarCatalogo(apiCatalogo())
    catalogo.mostrar('produtos', true)
    await vi.waitFor(() => expect(element('products-list').children.length).toBe(6))
    element('new-product').click()
    // happy-dom calcula step decimal por módulo de ponto flutuante. A validação
    // de negócio é real; a validação HTML nativa fica para o teste no Electron.
    vi.spyOn(element<HTMLFormElement>('product-form'), 'reportValidity').mockReturnValue(true)
    valor('product-name', '<img src=x onerror=alert(1)>')
    valor('product-category', 'Alimentação')
    valor('product-currency', 'BRL')
    valor('product-price', '15.5')
    valor('product-stock', '0')
    element<HTMLFormElement>('product-form').dispatchEvent(new Event('submit', { cancelable: true }))
    await vi.waitFor(() => expect(element('products-list').children.length).toBe(7))
    expect(element('catalog-status').textContent).toContain('salvo')
    expect(element('products-list').querySelector('img')).toBeNull()
    valor('product-search', '<img')
    element('product-search').dispatchEvent(new Event('input'))
    expect(element('products-list').children.length).toBe(1)
    expect(element('products-list').textContent).toContain('Indisponível')
    element('products-list').querySelector<HTMLButtonElement>('button')!.click()
    valor('product-name', 'Petisco de teste')
    valor('product-stock', '3')
    element<HTMLFormElement>('product-form').dispatchEvent(new Event('submit', { cancelable: true }))
    await vi.waitFor(() => expect(element('product-form').classList.contains('d-none')).toBe(true))
    valor('product-search', 'Petisco de teste')
    element('product-search').dispatchEvent(new Event('input'))
    expect(element('products-list').textContent).toContain('Estoque baixo')
    valor('product-filter', 'Higiene')
    element('product-filter').dispatchEvent(new Event('change'))
    expect(element('products-list').children.length).toBe(0)
    valor('product-filter', '')
    element('product-filter').dispatchEvent(new Event('change'))
    element('products-list').querySelectorAll<HTMLButtonElement>('button')[1].click()
    expect(element('product-delete-message').textContent).toContain('Petisco de teste')
    element('cancel-delete-product').click()
    expect(element('products-list').children.length).toBe(1)
    element('products-list').querySelectorAll<HTMLButtonElement>('button')[1].click()
    element('confirm-delete-product').click()
    await vi.waitFor(() => expect(element('products-list').children.length).toBe(0))
  })

  it('atualiza conversões exibidas e informa uso da última taxa após falha', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ USDBRL: { code: 'USD', codein: 'BRL', ask: '5', timestamp: '1700000000' } })))
    iniciarCatalogo(apiCatalogo()).mostrar('produtos', true)
    element('refresh-exchange').click()
    await vi.waitFor(() => expect(element('exchange-value').textContent).toContain('5,0000'))
    expect(element('products-list').textContent).toContain('62,50')
    expect(element<HTMLButtonElement>('refresh-exchange').disabled).toBe(false)
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Offline'))
    element('refresh-exchange').click()
    await vi.waitFor(() => expect(element('exchange-status').textContent).toContain('última cotação'))
    expect(element('exchange-value').textContent).toContain('5,0000')
  })

  it('informa falha de leitura do catálogo persistido', async () => {
    const api = apiCatalogo()
    vi.mocked(api.listarCatalogo).mockRejectedValueOnce(new Error('Falha de conexão.'))
    iniciarCatalogo(api).mostrar('produtos', true)
    await vi.waitFor(() => expect(element('catalog-status').textContent).toContain('Falha de conexão'))
    expect(element('products-list').children.length).toBe(0)
  })

  it('cancela a exclusão pendente quando a pessoa troca de tela', async () => {
    const catalogo = iniciarCatalogo(apiCatalogo())
    catalogo.mostrar('produtos', true)
    await vi.waitFor(() => expect(element('products-list').children.length).toBe(6))
    element('products-list').querySelectorAll<HTMLButtonElement>('button')[1].click()
    expect(element('product-delete-confirmation').classList.contains('d-none')).toBe(false)
    catalogo.mostrar('dashboard', true)
    element('confirm-delete-product').click()
    expect(element('product-delete-confirmation').classList.contains('d-none')).toBe(true)
    expect(element('products-list').children.length).toBe(6)
  })
})
