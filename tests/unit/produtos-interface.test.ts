// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarCatalogo } from '../../src/renderer/src/modules/produtos/catalogo'

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

function valor(id: string, value: string): void { element<HTMLInputElement>(id).value = value }

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = '<section id="login-view"><button id="demo-catalog">Demo</button></section><section id="clients-view" class="d-none">Clientes</section>'
  vi.restoreAllMocks()
  window.confirm = vi.fn(() => true)
})

describe('interface de produtos e navegação', () => {
  it('permite demonstração sem abrir clientes e restaura a navegação da sessão', () => {
    const catalogo = iniciarCatalogo()
    element('demo-catalog').click()
    expect(element('login-view').classList.contains('d-none')).toBe(true)
    expect(element('catalog-dashboard').classList.contains('d-none')).toBe(false)
    expect(element('nav-clientes').classList.contains('d-none')).toBe(true)
    element('nav-clientes').click()
    expect(element('clients-view').classList.contains('d-none')).toBe(true)
    element('exit-demo').click()
    expect(element('login-view').classList.contains('d-none')).toBe(false)
    catalogo.atualizarSessao(true)
    expect(element('nav-clientes').classList.contains('d-none')).toBe(false)
    element('nav-clientes').click()
    expect(element('clients-view').classList.contains('d-none')).toBe(false)
    expect(element('catalog-content').classList.contains('d-none')).toBe(true)
    catalogo.atualizarSessao(false)
    expect(element('clients-view').classList.contains('d-none')).toBe(true)
    expect(element('catalog-navigation').classList.contains('d-none')).toBe(true)
  })

  it('cadastra, edita estoque, busca, filtra e exclui pelo formulário', () => {
    iniciarCatalogo()
    element('demo-catalog').click()
    document.querySelector<HTMLButtonElement>('[data-screen="produtos"]')!.click()
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
    valor('product-search', 'Petisco de teste')
    element('product-search').dispatchEvent(new Event('input'))
    expect(element('products-list').textContent).toContain('Estoque baixo')
    valor('product-filter', 'Higiene')
    element('product-filter').dispatchEvent(new Event('change'))
    expect(element('products-list').children.length).toBe(0)
    valor('product-filter', '')
    element('product-filter').dispatchEvent(new Event('change'))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    element('products-list').querySelectorAll<HTMLButtonElement>('button')[1].click()
    expect(element('products-list').children.length).toBe(1)
    confirm.mockReturnValue(true)
    element('products-list').querySelectorAll<HTMLButtonElement>('button')[1].click()
    expect(element('products-list').children.length).toBe(0)
  })

  it('atualiza conversões exibidas e informa uso da última taxa após falha', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ USDBRL: { code: 'USD', codein: 'BRL', ask: '5', timestamp: '1700000000' } })))
    iniciarCatalogo()
    element('demo-catalog').click()
    element('refresh-exchange').click()
    await vi.waitFor(() => expect(element('exchange-value').textContent).toContain('5,0000'))
    expect(element('products-list').textContent).toContain('62,50')
    expect(element<HTMLButtonElement>('refresh-exchange').disabled).toBe(false)
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Offline'))
    element('refresh-exchange').click()
    await vi.waitFor(() => expect(element('exchange-status').textContent).toContain('última cotação'))
    expect(element('exchange-value').textContent).toContain('5,0000')
  })

  it('preserva dados corrompidos e bloqueia cadastro quando não consegue abrir o armazenamento', () => {
    localStorage.setItem('petshop.julia.produtos.v1', '{corrompido')
    iniciarCatalogo()
    expect(element('catalog-status').textContent).toContain('preservados')
    expect(element<HTMLButtonElement>('new-product').disabled).toBe(true)
    expect(localStorage.getItem('petshop.julia.produtos.v1')).toBe('{corrompido')
  })
})
