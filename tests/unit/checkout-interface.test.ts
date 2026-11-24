// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest'
import markup from '../../src/renderer/index.html?raw'
import type { DesktopApi, EntregadorInput } from '../../src/shared/contracts'

it('carrega entregadores independentemente dos produtos e reflete cada escrita confirmada na lista e na seleção', async () => {
  document.body.innerHTML = markup.slice(markup.indexOf('<main'), markup.indexOf('</main>') + 7)
  const novo = { id: 5, nome: 'Ana', telefone: '19988887777', veiculo: 'Moto', disponivel: true }
  const api = {
    getAppVersion: async () => '1',
    getUsuarioAtual: async () => null,
    login: async () => ({ id: 1, nome: 'Operador', email: 'teste@example.test', nivel: 'admin' }),
    listarCatalogo: async () => [],
    listarClientes: async () => [],
    listarProdutos: () => new Promise(() => {}),
    listarEntregadores: vi.fn(async () => []),
    criarEntregador: vi.fn(async () => novo),
    atualizarEntregador: vi.fn(async (id: number, input: EntregadorInput) => ({ ...input, id })),
    excluirEntregador: vi.fn(async () => {})
  }
  Object.defineProperty(window, 'petShop', { configurable: true, value: api as unknown as DesktopApi })
  await import('../../src/renderer/src/main')
  expect(api.listarEntregadores).not.toHaveBeenCalled()
  expect(document.querySelector('#app-nav')?.classList.contains('d-none')).toBe(true)
  document.querySelector('#login-form')!.dispatchEvent(new Event('submit', { cancelable: true }))
  await vi.waitFor(() => expect(document.body.classList.contains('signed-out')).toBe(false))
  document.querySelector<HTMLButtonElement>('[data-screen="checkout"]')!.click()
  const status = document.getElementById('deliverers-source')!
  await vi.waitFor(() => expect(status.textContent).toContain('Nenhum entregador'))
  for (const [id, value] of [['name', novo.nome], ['phone', novo.telefone], ['vehicle', novo.veiculo]]) {
    document.querySelector<HTMLInputElement>('#deliverer-' + id)!.value = value
  }
  document.querySelector('#deliverer-form')!.dispatchEvent(new Event('submit', { cancelable: true }))
  const list = document.getElementById('deliverers-list')!
  const select = document.querySelector<HTMLSelectElement>('#checkout-deliverer')!
  await vi.waitFor(() => expect(list.textContent).toContain('Ana'))
  expect(api.criarEntregador).toHaveBeenCalledTimes(1)
  expect(document.querySelector<HTMLInputElement>('#deliverer-name')!.value).toBe('')
  select.value = '5'
  list.querySelector('button')!.click()
  await vi.waitFor(() => expect(select.options[1].disabled).toBe(true))
  expect(select.value).toBe('')
  list.querySelectorAll('button')[1].click()
  await vi.waitFor(() => expect(list.childElementCount).toBe(0))
  expect(select.options.length).toBe(1)
})
