import markup from './catalogo.html?raw'
import { categoriasProduto, converterPreco, type CategoriaProduto, type Produto, type ProdutoInput } from '../../../../shared/domain/produtos/produto'
import type { ResultadoCotacao } from '../../../../shared/domain/produtos/cotacao-service'
import { indicadoresEstoque } from '../../../../shared/domain/produtos/dashboard'

export interface CatalogoApi {
  listarCatalogo(): Promise<Produto[]>
  criarProduto(input: ProdutoInput): Promise<void>
  atualizarProduto(id: number, input: ProdutoInput, estoqueAnterior: number): Promise<void>
  excluirProduto(id: number): Promise<void>
  atualizarCotacao(): Promise<ResultadoCotacao>
}

export function iniciarCatalogo(api: CatalogoApi) {
  const host = document.createElement('div')
  host.innerHTML = markup
  el('clients-view').before(host)
  const form = el<HTMLFormElement>('product-form')
  let produtos: Produto[] = []
  let editando: Produto | null = null
  let excluindo: number | null = null
  let podeExcluir = false
  let versaoLista = 0
  let sessao = 0
  let cotacao: ResultadoCotacao = { cotacao: null, emCache: false, mensagem: '' }

  async function atualizar(): Promise<void> {
    const versao = ++versaoLista
    try {
      const lista = await api.listarCatalogo()
      if (versao !== versaoLista) return
      produtos = lista
      render()
    } catch (error) {
      if (versao === versaoLista) status(mensagem(error), true)
    }
  }

  for (const categoria of categoriasProduto) {
    for (const id of ['product-category', 'product-filter']) {
      const option = document.createElement('option')
      option.value = categoria; option.textContent = categoria
      el<HTMLSelectElement>(id).append(option)
    }
  }
  el('new-product').addEventListener('click', () => abrir())
  el('cancel-product').addEventListener('click', fechar)
  el('cancel-delete-product').addEventListener('click', cancelarExclusao)
  el('confirm-delete-product').addEventListener('click', async () => {
    if (excluindo === null) return
    const origem = sessao
    const button = el<HTMLButtonElement>('confirm-delete-product')
    button.disabled = true
    try {
      await api.excluirProduto(excluindo)
      if (origem !== sessao) return
      if (editando?.id === excluindo) fechar()
      cancelarExclusao(); status('Produto excluído.'); await atualizar()
    } catch (error) { if (origem === sessao) status(mensagem(error), true) }
    finally { button.disabled = false }
  })
  el('product-search').addEventListener('input', render)
  el('product-filter').addEventListener('change', render)
  el('refresh-exchange').addEventListener('click', () => void atualizarCotacao())

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const button = form.querySelector<HTMLButtonElement>('button[type=submit]')!
    if (!form.reportValidity() || button.disabled) return
    const origem = sessao
    button.disabled = true
    try {
      const data = new FormData(form)
      const input = {
        nome: String(data.get('nome') ?? ''), categoria: String(data.get('categoria')) as CategoriaProduto,
        moeda: String(data.get('moeda')) as 'BRL' | 'USD', preco: Number(data.get('preco')),
        importado: data.has('importado'), estoque: Number(data.get('estoque'))
      }
      if (editando) await api.atualizarProduto(editando.id, input, editando.estoque)
      else await api.criarProduto(input)
      if (origem !== sessao) return
      fechar(); status('Produto salvo.'); await atualizar()
    } catch (error) { if (origem === sessao) status(mensagem(error), true) }
    finally { button.disabled = false }
  })

  function abrir(produto?: Produto): void {
    cancelarExclusao()
    form.reset()
    editando = produto ?? null
    el('product-form-title').textContent = produto ? 'Editar produto e estoque' : 'Novo produto'
    if (produto) {
      el<HTMLInputElement>('product-name').value = produto.nome
      el<HTMLSelectElement>('product-category').value = produto.categoria
      el<HTMLSelectElement>('product-currency').value = produto.moeda
      el<HTMLInputElement>('product-price').value = String(produto.preco)
      el<HTMLInputElement>('product-stock').value = String(produto.estoque)
      el<HTMLInputElement>('product-imported').checked = produto.importado
    }
    form.classList.remove('d-none')
    el('product-name').focus()
  }

  function fechar(): void { editando = null; form.reset(); form.classList.add('d-none') }

  function cancelarExclusao(): void {
    excluindo = null
    el('product-delete-confirmation').classList.add('d-none')
  }

  function render(): void {
    const taxa = cotacao.cotacao?.taxa ?? null
    const busca = el<HTMLInputElement>('product-search').value.trim().toLocaleLowerCase('pt-BR')
    const categoria = el<HTMLSelectElement>('product-filter').value
    const filtrados = produtos.filter((produto) => produto.nome.toLocaleLowerCase('pt-BR').includes(busca) && (!categoria || categoria === produto.categoria))
    const lista = el('products-list')
    lista.replaceChildren()
    el('products-empty').classList.toggle('d-none', filtrados.length > 0)
    for (const produto of filtrados) {
      const row = document.createElement('tr')
      if (produto.estoque === 0) row.className = 'table-danger'
      const nome = document.createElement('th')
      nome.scope = 'row'
      nome.textContent = `${produto.nome}${produto.importado ? ' · Importado' : ''}`
      row.append(nome)
      for (const texto of [produto.categoria, dinheiro(converterPreco(produto, 'BRL', taxa), 'BRL'), dinheiro(converterPreco(produto, 'USD', taxa), 'USD'), `${produto.estoque} un. · ${produto.estoque === 0 ? 'Indisponível' : produto.estoque <= 5 ? 'Estoque baixo' : 'Disponível'}`]) {
        const cell = document.createElement('td'); cell.textContent = texto; row.append(cell)
      }
      const acoes = document.createElement('td')
      acoes.className = 'text-end text-nowrap'
      acoes.append(botao('Editar', 'secondary', () => abrir(produto)))
      if (podeExcluir) acoes.append(botao('Excluir', 'danger', () => {
        excluindo = produto.id
        el('product-delete-message').textContent = `Excluir ${produto.nome} do catálogo? Esta ação não pode ser desfeita.`
        el('product-delete-confirmation').classList.remove('d-none')
        el('confirm-delete-product').focus()
      }))
      row.append(acoes); lista.append(row)
    }
    const indicadores = indicadoresEstoque(produtos, taxa)
    const cards = el('dashboard-cards')
    cards.replaceChildren()
    const metricas = [
      ['Produtos', String(indicadores.totalProdutos)], ['Unidades em estoque', String(indicadores.unidades)],
      ['Sem estoque', String(indicadores.semEstoque.length)], ['Estoque baixo', String(indicadores.estoqueBaixo.length)],
      ['Importados', String(indicadores.importados)],
      [indicadores.valoresPendentes ? 'Valor parcial do estoque' : 'Valor do estoque', dinheiro(indicadores.valorEstoqueBRL, 'BRL')]
    ]
    for (const [titulo, valor] of metricas) {
      const col = document.createElement('div'); col.className = 'col-sm-6 col-lg-4'
      const card = document.createElement('div'); card.className = 'card card-body h-100 border-0 shadow-sm'
      const label = document.createElement('h3'); label.className = 'h6 text-secondary'; label.textContent = titulo
      const number = document.createElement('p'); number.className = 'h3 mb-0'; number.textContent = valor
      card.append(label, number)
      if (titulo.includes('parcial')) {
        const aviso = document.createElement('small'); aviso.textContent = `${indicadores.valoresPendentes} produto(s) aguardando cotação.`; card.append(aviso)
      }
      col.append(card); cards.append(col)
    }
    const alerts = el('stock-alerts'); alerts.replaceChildren()
    for (const produto of [...indicadores.semEstoque, ...indicadores.estoqueBaixo]) {
      const item = document.createElement('li')
      item.className = `list-group-item ${produto.estoque === 0 ? 'text-danger' : 'text-warning-emphasis'}`
      item.textContent = `${produto.nome}: ${produto.estoque === 0 ? 'indisponível' : `${produto.estoque} unidade(s), repor estoque`}.`
      alerts.append(item)
    }
    if (!alerts.children.length) {
      const item = document.createElement('li'); item.className = 'list-group-item text-secondary'; item.textContent = 'Nenhum alerta de estoque.'; alerts.append(item)
    }
  }

  async function atualizarCotacao(): Promise<void> {
    const button = el<HTMLButtonElement>('refresh-exchange'); button.disabled = true
    el('exchange-status').textContent = 'Consultando cotação...'
    try {
      const origem = sessao
      const resultado = await api.atualizarCotacao()
      if (origem !== sessao) return
      cotacao = resultado
      el('exchange-value').textContent = cotacao.cotacao ? `US$ 1 = ${dinheiro(cotacao.cotacao.taxa, 'BRL', 4)}` : 'Cotação indisponível'
      el('exchange-status').textContent = `${cotacao.mensagem}${cotacao.cotacao ? ` Data da cotação: ${new Date(cotacao.cotacao.atualizadaEm).toLocaleString('pt-BR')}.` : ''} Conversão de referência, sem impostos ou taxas.`
      el('exchange-status').className = `small mb-0 ${cotacao.emCache || !cotacao.cotacao ? 'text-warning-emphasis' : 'text-secondary'}`
      render()
    } finally { button.disabled = false }
  }

  function status(texto: string, erro = false): void {
    el('catalog-status').textContent = texto
    el('catalog-status').className = `small mb-3 text-${erro ? 'danger' : 'success'}`
  }

  render()
  return {
    mostrar(tela: string, admin: boolean) {
      podeExcluir = admin
      fechar()
      cancelarExclusao()
      const aberto = tela === 'dashboard' || tela === 'produtos'
      el('catalog-content').classList.toggle('d-none', !aberto)
      el('catalog-dashboard').classList.toggle('d-none', tela !== 'dashboard')
      el('catalog-products').classList.toggle('d-none', tela !== 'produtos')
      if (aberto) void atualizar()
    },
    encerrar() {
      sessao++
      versaoLista++
      produtos = []
      cotacao = { cotacao: null, emCache: false, mensagem: '' }
      el('exchange-value').textContent = 'Cotação não consultada'
      el('exchange-status').textContent = ''
      el<HTMLInputElement>('product-search').value = ''
      el<HTMLSelectElement>('product-filter').value = ''
      status('')
      render()
    }
  }
}

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Elemento obrigatório não encontrado: ${id}`)
  return element as T
}

function botao(texto: string, cor: string, acao: () => void): HTMLButtonElement {
  const button = document.createElement('button'); button.type = 'button'
  button.className = `btn btn-outline-${cor} btn-sm ms-2`; button.textContent = texto
  button.addEventListener('click', acao)
  return button
}

function dinheiro(valor: number | null, moeda: 'BRL' | 'USD', casas = 2): string {
  return valor === null ? 'Aguardando cotação' : valor.toLocaleString('pt-BR', { style: 'currency', currency: moeda, minimumFractionDigits: casas, maximumFractionDigits: casas })
}

function mensagem(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.'
}
