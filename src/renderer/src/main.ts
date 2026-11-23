import 'bootstrap/dist/css/bootstrap.min.css'

import { iniciarCatalogo } from './modules/produtos/catalogo'

import type {
  Cliente,
  ClienteInput,
  CriarPedidoInput,
  EntregadorInput,
  EntregadorResumo,
  ProdutoResumo,
  UsuarioAutenticado
} from '../../shared/contracts'

import type { Entregador } from '../../models/Entregador'
import type { ProdutoCheckout } from '../../models/Produto'

import { produtosMock } from '../../mocks/produtosMock'
import { entregadoresMock } from '../../mocks/entregadoresMock'
import { CheckoutService } from '../../services/CheckoutService'

const catalogo = iniciarCatalogo()

const version = requiredElement<HTMLElement>('#app-version')
const testDatabaseButton = requiredElement<HTMLButtonElement>('#test-db')
const databaseStatus = requiredElement<HTMLElement>('#db-status')
const loginView = requiredElement<HTMLElement>('#login-view')
const loginForm = requiredElement<HTMLFormElement>('#login-form')
const loginSubmit = requiredElement<HTMLButtonElement>('#login-submit')
const clientsView = requiredElement<HTMLElement>('#clients-view')
const checkoutView = requiredElement<HTMLElement>('#checkout-view')
const clientsList = requiredElement<HTMLTableSectionElement>('#clients-list')
const clientsEmpty = requiredElement<HTMLElement>('#clients-empty')
const clientForm = requiredElement<HTMLFormElement>('#client-form')
const saveClientButton = requiredElement<HTMLButtonElement>('#save-client')
const sessionActions = requiredElement<HTMLElement>('#session-actions')
const appNav = requiredElement<HTMLElement>('#app-nav')
const sessionUser = requiredElement<HTMLElement>('#session-user')
const appStatus = requiredElement<HTMLElement>('#app-status')
const lookupCepButton = requiredElement<HTMLButtonElement>('#lookup-cep')
const logoutButton = requiredElement<HTMLButtonElement>('#logout')
let usuarioAtual: UsuarioAutenticado | null = null
let clienteEmEdicao: number | null = null
const checkout = new CheckoutService()
let clientesCheckout: Cliente[] = []
let produtosCheckout: ProdutoCheckout[] = [...produtosMock]
let entregadoresCheckout: Entregador[] = [...entregadoresMock]
let distanciaCalculada: number | null = null
let duracaoCalculada: number | null = null
let produtosIntegrados = false
let entregadoresIntegrados = false

window.petShop.getAppVersion()
  .then((appVersion) => {
    version.textContent = `Versão ${appVersion}`
  })
  .catch(() => {
    version.textContent = 'Versão indisponível'
  })

testDatabaseButton.addEventListener('click', async () => {
  testDatabaseButton.disabled = true
  databaseStatus.className = 'small text-secondary'
  databaseStatus.textContent = 'Testando conexão...'

  try {
    const result = await window.petShop.testDatabaseConnection()
    databaseStatus.className = result.ok ? 'small text-success' : 'small text-danger'
    databaseStatus.textContent = result.message
  } catch {
    databaseStatus.className = 'small text-danger'
    databaseStatus.textContent = 'Falha ao testar a conexão MySQL.'
  } finally {
    testDatabaseButton.disabled = false
  }
})

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  loginSubmit.disabled = true
  setStatus('Validando acesso...', 'secondary')
  const formData = new FormData(loginForm)

  try {
    usuarioAtual = await window.petShop.login(
      String(formData.get('email') ?? ''),
      String(formData.get('senha') ?? '')
    )
    renderSession()
    await carregarClientes()
    await carregarCheckoutData()
    setStatus('', 'secondary')
    loginForm.reset()
  } catch (error) {
    setStatus(errorMessage(error, 'Não foi possível entrar.'), 'danger')
  } finally {
    loginSubmit.disabled = false
  }
})

logoutButton.addEventListener('click', async () => {
  await window.petShop.logout()
  usuarioAtual = null
  clientsList.replaceChildren()
  checkout.limparCarrinho()
  distanciaCalculada = null
  duracaoCalculada = null
  renderCarrinho()
  requiredElement<HTMLElement>('#order-preview').textContent = ''
  requiredElement<HTMLElement>('#cart-items').replaceChildren()
  fecharFormulario()
  renderSession()
  setStatus('Sessão encerrada.', 'secondary')
})

requiredElement<HTMLButtonElement>('#new-client').addEventListener('click', () => abrirFormulario())
requiredElement<HTMLButtonElement>('#cancel-client').addEventListener('click', fecharFormulario)

function showClients(): void {
  clientsView.classList.remove('d-none')
  checkoutView.classList.add('d-none')
}
function showCheckout(): void {
  clientsView.classList.add('d-none')
  checkoutView.classList.remove('d-none')
}
requiredElement<HTMLButtonElement>('#show-clients').addEventListener('click', showClients)
requiredElement<HTMLButtonElement>('#nav-checkout').addEventListener('click', showCheckout)
requiredElement<HTMLButtonElement>('#nav-clients').addEventListener('click', showClients)

requiredElement<HTMLFormElement>('#deliverer-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const name = requiredElement<HTMLInputElement>('#deliverer-name')
  const phone = requiredElement<HTMLInputElement>('#deliverer-phone')
  const vehicle = requiredElement<HTMLInputElement>('#deliverer-vehicle')
  const input: EntregadorInput = { nome: name.value.trim(), telefone: phone.value.trim(), veiculo: vehicle.value.trim(), disponivel: true }
  try {
    const created = entregadoresIntegrados
      ? await window.petShop.criarEntregador(input)
      : { ...input, id: Math.max(0, ...entregadoresCheckout.map(item => item.id)) + 1 }
    entregadoresCheckout.push(created)
    ;(event.currentTarget as HTMLFormElement).reset()
    renderEntregadores()
    setStatus('Entregador cadastrado.', 'success')
  } catch (error) { setStatus(errorMessage(error, 'Não foi possível cadastrar o entregador.'), 'danger') }
})

requiredElement<HTMLSelectElement>('#checkout-customer').addEventListener('change', () => {
  distanciaCalculada = null
  duracaoCalculada = null
  renderCarrinho()
})

requiredElement<HTMLButtonElement>('#calculate-delivery').addEventListener('click', async () => {
  const button = requiredElement<HTMLButtonElement>('#calculate-delivery')
  button.disabled = true
  const clienteId = Number(requiredElement<HTMLSelectElement>('#checkout-customer').value)
  const cliente = clientesCheckout.find(item => item.id === clienteId)
  if (!cliente) {
    setStatus('Selecione um cliente com endereço cadastrado.', 'danger')
    button.disabled = false
    return
  }
  const enderecoDestino = `${cliente.logradouro}, ${cliente.numero}, ${cliente.bairro}, ${cliente.cidade} - ${cliente.uf}, ${cliente.cep}, Brasil`
  setStatus('Consultando a rota para o endereço do cliente...', 'secondary')
  try {
    const rota = await window.petShop.calcularDistancia(enderecoDestino)
    distanciaCalculada = rota.distanciaKm
    duracaoCalculada = rota.duracaoMinutos
    const valores = checkout.calcularTotal(distanciaCalculada)
    requiredElement<HTMLElement>('#checkout-shipping').textContent = formatCurrency(valores.frete)
    requiredElement<HTMLElement>('#checkout-total').textContent = formatCurrency(valores.total)
    requiredElement<HTMLElement>('#distance-note').textContent = `${rota.distanciaKm} km · cerca de ${rota.duracaoMinutos} min desde o endereço configurado da loja.`
    requiredElement<HTMLButtonElement>('#create-order').disabled = checkout.listarItens().length === 0
    setStatus('Distância e frete calculados.', 'success')
  } catch (error) {
    distanciaCalculada = null
    duracaoCalculada = null
    requiredElement<HTMLElement>('#checkout-shipping').textContent = 'Indisponível'
    requiredElement<HTMLElement>('#checkout-total').textContent = formatCurrency(checkout.calcularSubtotal())
    requiredElement<HTMLButtonElement>('#create-order').disabled = true
    setStatus(errorMessage(error, 'Não foi possível calcular a distância.'), 'danger')
  } finally {
    button.disabled = false
  }
})

requiredElement<HTMLButtonElement>('#create-order').addEventListener('click', async () => {
  const clienteId = Number(requiredElement<HTMLSelectElement>('#checkout-customer').value)
  const entregadorValue = requiredElement<HTMLSelectElement>('#checkout-deliverer').value
  if (!distanciaCalculada) return setStatus('Calcule a distância antes de criar o pedido.', 'danger')
  const button = requiredElement<HTMLButtonElement>('#create-order')
  button.disabled = true
  try {
    const input: CriarPedidoInput = {
      clienteId,
      entregadorId: entregadorValue ? Number(entregadorValue) : null,
      itens: checkout.listarItens().map(({ produtoId, quantidade }) => ({ produtoId, quantidade })),
      distanciaKm: distanciaCalculada,
      duracaoMinutos: duracaoCalculada ?? 0
    }
    const pedido = await window.petShop.criarPedido(input)
    const previsto = new Date(pedido.previsaoEntrega!).toLocaleString('pt-BR')
    requiredElement<HTMLElement>('#checkout-subtotal').textContent = formatCurrency(pedido.subtotal)
    requiredElement<HTMLElement>('#checkout-shipping').textContent = formatCurrency(pedido.frete)
    requiredElement<HTMLElement>('#checkout-total').textContent = formatCurrency(pedido.total)
    requiredElement<HTMLElement>('#order-preview').textContent = `Pedido #${pedido.id} registrado · previsão: ${previsto}.`
    checkout.limparCarrinho()
    distanciaCalculada = null
    duracaoCalculada = null
    renderCarrinho()
    await carregarCheckoutData()
    setStatus('Pedido registrado e estoque atualizado.', 'success')
  } catch (error) {
    setStatus(errorMessage(error, 'Não foi possível criar o rascunho.'), 'danger')
  } finally {
    button.disabled = false
  }
})

clientForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!clientForm.reportValidity()) return

  saveClientButton.disabled = true
  const formData = new FormData(clientForm)
  const cliente: ClienteInput = {
    nome: stringValue(formData, 'nome'),
    email: optionalString(formData, 'email'),
    telefone: stringValue(formData, 'telefone'),
    cpf: optionalString(formData, 'cpf'),
    cep: stringValue(formData, 'cep'),
    logradouro: stringValue(formData, 'logradouro'),
    numero: stringValue(formData, 'numero'),
    complemento: optionalString(formData, 'complemento'),
    bairro: stringValue(formData, 'bairro'),
    cidade: stringValue(formData, 'cidade'),
    uf: stringValue(formData, 'uf')
  }

  try {
    if (clienteEmEdicao) {
      await window.petShop.atualizarCliente(clienteEmEdicao, cliente)
      setStatus('Cliente atualizado.', 'success')
    } else {
      await window.petShop.criarCliente(cliente)
      setStatus('Cliente cadastrado.', 'success')
    }
    fecharFormulario()
    await carregarClientes()
  } catch (error) {
    setStatus(errorMessage(error, 'Não foi possível salvar o cliente.'), 'danger')
  } finally {
    saveClientButton.disabled = false
  }
})

lookupCepButton.addEventListener('click', async () => {
  lookupCepButton.disabled = true
  setStatus('Consultando CEP...', 'secondary')

  try {
    const endereco = await window.petShop.consultarCep(
      requiredElement<HTMLInputElement>('#client-cep').value
    )
    requiredElement<HTMLInputElement>('#client-cep').value = endereco.cep
    requiredElement<HTMLInputElement>('#client-street').value = endereco.logradouro
    requiredElement<HTMLInputElement>('#client-complement').value = endereco.complemento
    requiredElement<HTMLInputElement>('#client-neighborhood').value = endereco.bairro
    requiredElement<HTMLInputElement>('#client-city').value = endereco.cidade
    requiredElement<HTMLInputElement>('#client-state').value = endereco.uf
    setStatus('Endereço preenchido pelo ViaCEP.', 'success')
  } catch (error) {
    setStatus(errorMessage(error, 'Não foi possível consultar o CEP.'), 'danger')
  } finally {
    lookupCepButton.disabled = false
  }
})

async function carregarClientes(): Promise<void> {
  try {
    const clientes = await window.petShop.listarClientes()
    clientesCheckout = clientes
    renderClientes(clientes)
    renderClientesCheckout()
  } catch (error) {
    setStatus(errorMessage(error, 'Não foi possível carregar os clientes.'), 'danger')
  }
}

function renderClientes(clientes: Cliente[]): void {
  clientsList.replaceChildren()
  clientsEmpty.classList.toggle('d-none', clientes.length > 0)

  for (const cliente of clientes) {
    const row = document.createElement('tr')
    const nameCell = document.createElement('th')
    nameCell.scope = 'row'
    nameCell.textContent = cliente.nome
    row.append(nameCell)

    const contactCell = document.createElement('td')
    contactCell.textContent = cliente.email ? `${cliente.telefone} · ${cliente.email}` : cliente.telefone
    row.append(contactCell)

    const cityCell = document.createElement('td')
    cityCell.textContent = `${cliente.cidade}/${cliente.uf}`
    row.append(cityCell)

    const actionsCell = document.createElement('td')
    actionsCell.className = 'text-end text-nowrap'
    const editButton = document.createElement('button')
    editButton.type = 'button'
    editButton.className = 'btn btn-outline-secondary btn-sm me-2'
    editButton.textContent = 'Editar'
    editButton.addEventListener('click', () => abrirFormulario(cliente))
    actionsCell.append(editButton)

    if (usuarioAtual?.nivel === 'admin') {
      const deleteButton = document.createElement('button')
      deleteButton.type = 'button'
      deleteButton.className = 'btn btn-outline-danger btn-sm'
      deleteButton.textContent = 'Excluir'
      deleteButton.addEventListener('click', () => void excluirCliente(cliente))
      actionsCell.append(deleteButton)
    }
    row.append(actionsCell)
    clientsList.append(row)
  }
}

async function excluirCliente(cliente: Cliente): Promise<void> {
  if (!window.confirm(`Excluir o cadastro de ${cliente.nome}?`)) return

  try {
    await window.petShop.excluirCliente(cliente.id)
    await carregarClientes()
    setStatus('Cliente excluído.', 'success')
  } catch (error) {
    setStatus(errorMessage(error, 'Não foi possível excluir o cliente.'), 'danger')
  }
}

function abrirFormulario(cliente?: Cliente): void {
  clientForm.reset()
  clienteEmEdicao = cliente?.id ?? null
  requiredElement<HTMLInputElement>('#client-id').value = cliente ? String(cliente.id) : ''
  requiredElement<HTMLElement>('#client-form-title').textContent = cliente ? 'Editar cliente' : 'Novo cliente'
  requiredElement<HTMLButtonElement>('#save-client').textContent = cliente ? 'Salvar alterações' : 'Salvar cliente'

  if (cliente) {
    requiredElement<HTMLInputElement>('#client-name').value = cliente.nome
    requiredElement<HTMLInputElement>('#client-email').value = cliente.email ?? ''
    requiredElement<HTMLInputElement>('#client-phone').value = cliente.telefone
    requiredElement<HTMLInputElement>('#client-cpf').value = cliente.cpf ?? ''
    requiredElement<HTMLInputElement>('#client-cep').value = cliente.cep
    requiredElement<HTMLInputElement>('#client-street').value = cliente.logradouro
    requiredElement<HTMLInputElement>('#client-number').value = cliente.numero
    requiredElement<HTMLInputElement>('#client-complement').value = cliente.complemento ?? ''
    requiredElement<HTMLInputElement>('#client-neighborhood').value = cliente.bairro
    requiredElement<HTMLInputElement>('#client-city').value = cliente.cidade
    requiredElement<HTMLInputElement>('#client-state').value = cliente.uf
  }

  clientForm.classList.remove('d-none')
  requiredElement<HTMLInputElement>('#client-name').focus()
}

function fecharFormulario(): void {
  clienteEmEdicao = null
  clientForm.reset()
  clientForm.classList.add('d-none')
}

function renderSession(): void {
  const autenticado = usuarioAtual !== null
  loginView.classList.toggle('d-none', autenticado)
  if (!autenticado) {
    clientsView.classList.add('d-none')
    checkoutView.classList.add('d-none')
  } else if (clientsView.classList.contains('d-none') && checkoutView.classList.contains('d-none')) {
    showCheckout()
  }
  appNav.classList.toggle('d-none', !autenticado)
  appNav.classList.toggle('d-flex', autenticado)
  sessionActions.classList.toggle('d-none', !autenticado)
  sessionActions.classList.toggle('d-flex', autenticado)
  sessionUser.textContent = usuarioAtual
    ? `${usuarioAtual.nome} · ${usuarioAtual.nivel === 'admin' ? 'Administrador' : 'Atendente'}`
    : ''
  catalogo.atualizarSessao(autenticado)
}

async function carregarCheckoutData(): Promise<void> {
  // Clientes vêm do IPC real. Produtos e entregadores usam fixtures até existirem handlers IPC.
  produtosIntegrados = false
  entregadoresIntegrados = false
  try {
    if (window.petShop.listarProdutos) {
      const produtos = await window.petShop.listarProdutos()
      produtosCheckout = produtos.map((produto: ProdutoResumo) => ({ ...produto, categoria: produto.categoria ?? 'Catálogo' }))
      produtosIntegrados = true
    }
  } catch (error) {
    produtosCheckout = missingIpcHandler(error) ? [...produtosMock] : []
    if (!missingIpcHandler(error)) setStatus(errorMessage(error, 'Falha ao carregar produtos.'), 'danger')
  }
  try {
    if (window.petShop.listarEntregadores) {
      const entregadores = await window.petShop.listarEntregadores()
      entregadoresCheckout = entregadores.map((item: EntregadorResumo) => ({ ...item }))
      entregadoresIntegrados = true
    }
  } catch (error) {
    entregadoresCheckout = missingIpcHandler(error) ? [...entregadoresMock] : []
    if (!missingIpcHandler(error)) setStatus(errorMessage(error, 'Falha ao carregar entregadores.'), 'danger')
  }
  requiredElement<HTMLElement>('#products-source').textContent = produtosIntegrados
    ? 'Produtos carregados pelo IPC do backend.'
    : 'Catálogo local de teste até a API IPC de produtos estar disponível.'
  requiredElement<HTMLElement>('#deliverers-source').textContent = entregadoresIntegrados
    ? 'Entregadores carregados pelo IPC do backend.'
    : 'dados locais de teste'
  renderProdutos()
  renderClientesCheckout()
  renderEntregadores()
}

function renderProdutos(): void {
  const container = requiredElement<HTMLElement>('#checkout-products')
  container.replaceChildren()
  for (const produto of produtosCheckout.filter(item => item.disponivel)) {
    const card = document.createElement('article')
    card.className = 'col-sm-6'
    const panel = document.createElement('div')
    panel.className = 'card h-100'
    const body = document.createElement('div')
    body.className = 'card-body d-flex justify-content-between align-items-center gap-2'
    const details = document.createElement('div')
    const title = document.createElement('h4')
    title.className = 'h6 mb-1'
    title.textContent = produto.nome
    const category = document.createElement('p')
    category.className = 'small text-secondary mb-1'
    category.textContent = produto.categoria ?? 'Catálogo'
    const price = document.createElement('strong')
    price.textContent = formatCurrency(produto.preco)
    details.append(title, category, price)
    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'btn btn-outline-primary btn-sm'
    add.textContent = 'Adicionar'
    add.addEventListener('click', () => {
      checkout.adicionarProduto(produto.id, produto.nome, produto.preco, 1)
      distanciaCalculada = null
      requiredElement<HTMLElement>('#order-preview').textContent = ''
      renderCarrinho()
    })
    body.append(details, add)
    panel.append(body)
    card.append(panel)
    container.append(card)
  }
}

function renderCarrinho(): void {
  const container = requiredElement<HTMLElement>('#cart-items')
  const itens = checkout.listarItens()
  container.replaceChildren()
  requiredElement<HTMLElement>('#cart-empty').classList.toggle('d-none', itens.length > 0)
  for (const item of itens) {
    const row = document.createElement('div')
    row.className = 'd-flex justify-content-between align-items-center gap-2 border-bottom pb-2'
    const description = document.createElement('div')
    description.className = 'small'
    description.textContent = `${item.nome} · ${formatCurrency(item.precoUnitario)} cada`
    const controls = document.createElement('div')
    controls.className = 'd-flex align-items-center gap-2'
    const decrement = quantityButton('−', () => { checkout.ajustarQuantidade(item.produtoId, -1); renderCarrinho() })
    const quantity = document.createElement('span')
    quantity.textContent = String(item.quantidade)
    quantity.setAttribute('aria-label', `Quantidade ${item.quantidade}`)
    const increment = quantityButton('+', () => {
      checkout.adicionarProduto(item.produtoId, item.nome, item.precoUnitario, 1)
      distanciaCalculada = null
      renderCarrinho()
    })
    controls.append(decrement, quantity, increment)
    row.append(description, controls)
    container.append(row)
  }
  const subtotal = checkout.calcularSubtotal()
  requiredElement<HTMLElement>('#checkout-subtotal').textContent = formatCurrency(subtotal)
  requiredElement<HTMLElement>('#checkout-total').textContent = formatCurrency(distanciaCalculada === null ? subtotal : checkout.calcularTotal(distanciaCalculada).total)
  if (distanciaCalculada === null) requiredElement<HTMLElement>('#checkout-shipping').textContent = 'A calcular'
  requiredElement<HTMLButtonElement>('#create-order').disabled = distanciaCalculada === null || itens.length === 0
}

function quantityButton(label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'btn btn-outline-secondary btn-sm'
  button.textContent = label
  button.setAttribute('aria-label', label === '+' ? 'Aumentar quantidade' : 'Diminuir quantidade')
  button.addEventListener('click', action)
  return button
}

function renderClientesCheckout(): void {
  const select = requiredElement<HTMLSelectElement>('#checkout-customer')
  const selected = select.value
  select.replaceChildren(new Option('Selecione um cliente', ''))
  for (const cliente of clientesCheckout) select.add(new Option(cliente.nome, String(cliente.id)))
  if (clientesCheckout.some(cliente => String(cliente.id) === selected)) select.value = selected
}

function renderEntregadores(): void {
  const list = requiredElement<HTMLElement>('#deliverers-list')
  const select = requiredElement<HTMLSelectElement>('#checkout-deliverer')
  const selected = select.value
  list.replaceChildren()
  select.replaceChildren(new Option('Sem entregador', ''))
  for (const entregador of entregadoresCheckout) {
    const option = new Option(`${entregador.nome} (${entregador.veiculo})`, String(entregador.id))
    option.disabled = !entregador.disponivel
    select.add(option)
    const row = document.createElement('div')
    row.className = 'list-group-item d-flex justify-content-between align-items-center gap-2 px-0'
    const label = document.createElement('span')
    label.className = 'small'
    label.textContent = `${entregador.nome} · ${entregador.telefone} · ${entregador.veiculo}`
    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = `btn btn-sm ${entregador.disponivel ? 'btn-outline-success' : 'btn-outline-secondary'}`
    toggle.textContent = entregador.disponivel ? 'Disponível' : 'Indisponível'
    toggle.addEventListener('click', async () => {
      toggle.disabled = true
      try {
        const input: EntregadorInput = { ...entregador, disponivel: !entregador.disponivel }
        const updated = entregadoresIntegrados
          ? await window.petShop.atualizarEntregador(entregador.id, input)
          : input
        Object.assign(entregador, updated)
        renderEntregadores()
      } catch (error) {
        toggle.disabled = false
        setStatus(errorMessage(error, 'Não foi possível atualizar a disponibilidade.'), 'danger')
      }
    })
    row.append(label, toggle)
    if (usuarioAtual?.nivel === 'admin') {
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'btn btn-outline-danger btn-sm'
      remove.textContent = 'Remover'
      remove.addEventListener('click', async () => {
        remove.disabled = true
        try {
          if (entregadoresIntegrados) await window.petShop.excluirEntregador(entregador.id)
          entregadoresCheckout = entregadoresCheckout.filter(item => item.id !== entregador.id)
          renderEntregadores()
          setStatus('Entregador removido.', 'success')
        } catch (error) {
          remove.disabled = false
          setStatus(errorMessage(error, 'Não foi possível remover o entregador.'), 'danger')
        }
      })
      row.append(remove)
    }
    list.append(row)
  }
  if (entregadoresCheckout.some(item => String(item.id) === selected && item.disponivel)) select.value = selected
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function setStatus(message: string, tone: 'secondary' | 'success' | 'danger'): void {
  appStatus.className = `small mb-3 text-${tone}`
  appStatus.textContent = message
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function missingIpcHandler(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('no handler registered')
}

function stringValue(data: FormData, key: string): string {
  return String(data.get(key) ?? '').trim()
}

function optionalString(data: FormData, key: string): string | null {
  return stringValue(data, key) || null
}

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Elemento obrigatório não encontrado: ${selector}`)
  return element
}

window.petShop.getUsuarioAtual().then((usuario) => {
  usuarioAtual = usuario
  renderSession()
  if (usuarioAtual) {
    void carregarClientes()
    void carregarCheckoutData()
  }
}).catch(() => {
  setStatus('Não foi possível restaurar a sessão.', 'danger')
})
