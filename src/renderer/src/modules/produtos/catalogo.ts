import markup from './catalogo.html?raw'
import { categoriasProduto, converterPreco, type CategoriaProduto, type Produto } from '../../../../shared/domain/produtos/produto'
import { ProdutoRepositoryLocal } from '../../../../shared/domain/produtos/produto-repository-local'
import { ProdutoService } from '../../../../shared/domain/produtos/produto-service'
import { produtosDemo } from '../../../../shared/domain/produtos/produtos-demo'
import { CotacaoService, type ResultadoCotacao } from '../../../../shared/domain/produtos/cotacao-service'
import { indicadoresEstoque } from '../../../../shared/domain/produtos/dashboard'

export function iniciarCatalogo(): { atualizarSessao(autenticado: boolean): void } {
  const host = document.createElement('div')
  // Apenas HTML estático do projeto; os dados do usuário são inseridos via textContent.
  host.innerHTML = markup
  el('clients-view').before(host)
  const form = el<HTMLFormElement>('product-form')
  let service: ProdutoService | null = null
  let autenticado = false
  let demonstracao = false
  let editando: number | null = null
  let excluindo: number | null = null
  let tela: 'dashboard' | 'produtos' | 'clientes' = 'dashboard'
  let cotacao: ResultadoCotacao = { cotacao: null, emCache: false, mensagem: '' }
  const exchange = new CotacaoService()

  try {
    service = new ProdutoService(new ProdutoRepositoryLocal(produtosDemo, window.localStorage))
  } catch {
    status('Não foi possível abrir o catálogo local. Os dados salvos foram preservados. Verifique o armazenamento do aplicativo.', true)
    el<HTMLButtonElement>('new-product').disabled = true
  }

  for (const categoria of categoriasProduto) {
    for (const id of ['product-category', 'product-filter']) {
      const option = document.createElement('option')
      option.value = categoria; option.textContent = categoria
      el<HTMLSelectElement>(id).append(option)
    }
  }
  document.querySelectorAll<HTMLButtonElement>('[data-screen]').forEach((button) => {
    button.addEventListener('click', () => {
      const destino = button.dataset.screen
      if (destino === 'clientes' && !autenticado) return
      if (destino === 'dashboard' || destino === 'produtos' || destino === 'clientes') tela = destino
      navegar()
    })
  })
  el('demo-catalog').addEventListener('click', () => { demonstracao = true; tela = 'dashboard'; navegar(); render() })
  el('exit-demo').addEventListener('click', () => { demonstracao = false; fechar(); navegar() })
  el('new-product').addEventListener('click', () => abrir())
  el('cancel-product').addEventListener('click', fechar)
  el('cancel-delete-product').addEventListener('click', cancelarExclusao)
  el('confirm-delete-product').addEventListener('click', () => {
    if (excluindo === null || !service) return
    try {
      service.excluir(excluindo)
      if (editando === excluindo) fechar()
      cancelarExclusao(); render(); status('Produto excluído do catálogo local.')
    } catch (error) { status(mensagem(error), true) }
  })
  el('product-search').addEventListener('input', render)
  el('product-filter').addEventListener('change', render)
  el('refresh-exchange').addEventListener('click', () => void atualizarCotacao())

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!form.reportValidity() || !service) return
    try {
      const data = new FormData(form)
      const input = {
        nome: String(data.get('nome') ?? ''), categoria: String(data.get('categoria')) as CategoriaProduto,
        moeda: String(data.get('moeda')) as 'BRL' | 'USD', preco: Number(data.get('preco')),
        importado: data.has('importado'), estoque: Number(data.get('estoque'))
      }
      if (editando !== null) service.atualizar(editando, input)
      else service.criar(input)
      fechar(); render(); status('Produto salvo no catálogo local.')
    } catch (error) { status(mensagem(error), true) }
  })

  function navegar(): void {
    cancelarExclusao()
    const aberto = autenticado || demonstracao
    el('login-view').classList.toggle('d-none', aberto)
    el('clients-view').classList.toggle('d-none', !autenticado || tela !== 'clientes')
    el('catalog-navigation').classList.toggle('d-none', !aberto)
    el('catalog-content').classList.toggle('d-none', !aberto || tela === 'clientes')
    el('catalog-dashboard').classList.toggle('d-none', tela !== 'dashboard')
    el('catalog-products').classList.toggle('d-none', tela !== 'produtos')
    el('nav-clientes').classList.toggle('d-none', !autenticado)
    el('exit-demo').classList.toggle('d-none', autenticado)
    document.querySelectorAll<HTMLButtonElement>('[data-screen]').forEach((button) => {
      const ativo = button.dataset.screen === tela
      button.classList.toggle('active', ativo)
      if (ativo) button.setAttribute('aria-current', 'page')
      else button.removeAttribute('aria-current')
    })
  }

  function abrir(produto?: Produto): void {
    cancelarExclusao()
    form.reset()
    editando = produto?.id ?? null
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
    const produtos = service?.listar() ?? []
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
      acoes.append(botao('Editar', 'secondary', () => abrir(produto)), botao('Excluir', 'danger', () => {
        excluindo = produto.id
        el('product-delete-message').textContent = `Excluir ${produto.nome} do catálogo local? Esta ação não pode ser desfeita.`
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
      cotacao = await exchange.atualizar()
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
    atualizarSessao(value) {
      autenticado = value; demonstracao = false; tela = 'dashboard'; fechar(); navegar(); render()
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
  return error instanceof Error ? error.message : 'Não foi possível salvar. Verifique o armazenamento local.'
}
