import 'bootstrap/dist/css/bootstrap.min.css'
import './styles.css'

import { iniciarCatalogo } from './modules/produtos/catalogo'

import type {
  Cliente,
  ClienteInput,
  CriarPedidoInput,
  EntregadorInput,
  EntregadorResumo,
  PedidoRegistrado,
  ProdutoResumo,
  UsuarioAutenticado
} from '../../shared/contracts'
import { criarServicoEmail, tentarEnviarReciboVenda } from '../../shared/domain/recibos/email-service'

import type { ProdutoCheckout } from '../../models/Produto'

import { CheckoutService } from '../../services/CheckoutService'

const catalogo = iniciarCatalogo(window.petShop)

const version = requiredElement<HTMLElement>('#app-version')
const testDatabaseButton = requiredElement<HTMLButtonElement>('#test-db')
const databaseStatus = requiredElement<HTMLElement>('#db-status')
const loginView = requiredElement<HTMLElement>('#login-view')
const loginForm = requiredElement<HTMLFormElement>('#login-form')
const loginSubmit = requiredElement<HTMLButtonElement>('#login-submit')
const clientsView = requiredElement<HTMLElement>('#clients-view')
const checkoutView = requiredElement<HTMLElement>('#checkout-view')
const historyView = requiredElement<HTMLElement>('#history-view')
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
let produtosCheckout: ProdutoCheckout[] = []
let entregadoresCheckout: EntregadorResumo[] = []
let distanciaCalculada: number | null = null
let duracaoCalculada: number | null = null
let revisaoEntregadores = 0
let revisaoProdutos = 0
let revisaoRota = 0
let entregadorEmEdicao: EntregadorResumo | null = null
let salvandoEntregador = false
let confirmandoPedido = false
let telaAtual = 'dashboard'
const delivererForm = requiredElement<HTMLFormElement>('#deliverer-form')
const delivererSubmit = requiredElement<HTMLButtonElement>('#deliverer-form button[type=submit]')
const delivererStatus = requiredElement<HTMLElement>('#deliverers-source')
const emailService = criarServicoEmail()

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
  catalogo.encerrar()
  renderSession()
  window.location.reload()
})

requiredElement<HTMLButtonElement>('#new-client').addEventListener('click', () => abrirFormulario())
requiredElement<HTMLButtonElement>('#cancel-client').addEventListener('click', fecharFormulario)

function mostrarTela(tela: string): void {
  if (!usuarioAtual) return
  telaAtual = tela
  setStatus('', 'secondary')
  clientsView.classList.toggle('d-none', tela !== 'clientes')
  checkoutView.classList.toggle('d-none', tela !== 'checkout')
  historyView.classList.toggle('d-none', tela !== 'historico')
  catalogo.mostrar(tela, usuarioAtual.nivel === 'admin')
  for (const button of appNav.querySelectorAll<HTMLButtonElement>('[data-screen]')) {
    if (button.dataset.screen === tela) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  }
  if (tela === 'checkout') {
    void carregarClientes()
    void carregarCheckoutData()
  }
  if (tela === 'clientes') void carregarClientes()
  if (tela === 'historico') void carregarHistorico()
}
for (const button of appNav.querySelectorAll<HTMLButtonElement>('[data-screen]')) {
  button.addEventListener('click', () => mostrarTela(button.dataset.screen!))
}
requiredElement<HTMLButtonElement>('#refresh-history').addEventListener('click', () => void carregarHistorico())

delivererForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (salvandoEntregador) return
  const name = requiredElement<HTMLInputElement>('#deliverer-name')
  const phone = requiredElement<HTMLInputElement>('#deliverer-phone')
  const vehicle = requiredElement<HTMLInputElement>('#deliverer-vehicle')
  const anterior = entregadorEmEdicao
  const input: EntregadorInput = {
    nome: name.value.trim(), telefone: phone.value.trim(), veiculo: vehicle.value.trim(),
    disponivel: anterior?.disponivel ?? true
  }
  await alterarEntregador(async () => {
    if (anterior) {
      const atualizado = await window.petShop.atualizarEntregador(anterior.id, input, anterior)
      entregadoresCheckout = entregadoresCheckout.map(item => item.id === anterior.id ? atualizado : item)
    } else {
      entregadoresCheckout.push(await window.petShop.criarEntregador(input))
    }
    editarEntregador(null)
  }, anterior ? 'Cadastro atualizado.' : 'Entregador cadastrado.')
})

function editarEntregador(entregador: EntregadorResumo | null): void {
  entregadorEmEdicao = entregador
  delivererForm.reset()
  delivererSubmit.textContent = entregador ? 'Salvar' : 'Adicionar'
  requiredElement('#cancel-deliverer').classList.toggle('d-none', !entregador)
  if (entregador) {
    requiredElement<HTMLInputElement>('#deliverer-name').value = entregador.nome
    requiredElement<HTMLInputElement>('#deliverer-phone').value = entregador.telefone
    requiredElement<HTMLInputElement>('#deliverer-vehicle').value = entregador.veiculo
    requiredElement('#deliverer-name').focus()
  }
}
requiredElement('#cancel-deliverer').addEventListener('click', () => editarEntregador(null))

async function alterarEntregador(alterar: () => Promise<void>, mensagem: string): Promise<void> {
  if (salvandoEntregador || !usuarioAtual) return
  salvandoEntregador = true
  revisaoEntregadores++
  delivererSubmit.disabled = true
  delivererStatus.textContent = 'Salvando…'
  renderEntregadores()
  let falha = ''
  try {
    await alterar()
    delivererStatus.textContent = mensagem
  } catch (error) {
    falha = errorMessage(error, 'Não foi possível salvar o entregador.')
  } finally {
    salvandoEntregador = false
    delivererSubmit.disabled = false
    renderEntregadores()
  }
  if (falha) {
    await carregarEntregadores()
    delivererStatus.textContent = falha
  }
}

requiredElement<HTMLSelectElement>('#checkout-customer').addEventListener('change', () => {
  revisaoRota++
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
  const revisao = ++revisaoRota
  distanciaCalculada = null
  duracaoCalculada = null
  renderCarrinho()
  setStatus('Consultando a rota para o endereço do cliente...', 'secondary')
  try {
    const rota = await window.petShop.calcularDistancia(clienteId)
    if (revisao !== revisaoRota) return
    distanciaCalculada = rota.distanciaKm
    duracaoCalculada = rota.duracaoMinutos
    const valores = checkout.calcularTotal(distanciaCalculada)
    requiredElement<HTMLElement>('#checkout-shipping').textContent = formatCurrency(valores.frete)
    requiredElement<HTMLElement>('#checkout-total').textContent = formatCurrency(valores.total)
    requiredElement<HTMLElement>('#distance-note').textContent = `${rota.distanciaKm} km · cerca de ${rota.duracaoMinutos} min desde o endereço configurado da loja.`
    requiredElement<HTMLButtonElement>('#create-order').disabled = checkout.listarItens().length === 0
    setStatus('Distância e frete calculados.', 'success')
  } catch (error) {
    if (revisao !== revisaoRota) return
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
  if (confirmandoPedido) return
  if (distanciaCalculada === null) return setStatus('Calcule a distância antes de criar o pedido.', 'danger')
  confirmandoPedido = true
  checkoutView.inert = true
  renderCarrinho()
  try {
    const input: CriarPedidoInput = {
      clienteId,
      entregadorId: entregadorValue ? Number(entregadorValue) : null,
      itens: checkout.listarItens().map(({ produtoId, quantidade, precoUnitario }) => ({ produtoId, quantidade, precoEsperado: precoUnitario })),
      distanciaKm: distanciaCalculada,
      duracaoMinutos: duracaoCalculada ?? 0
    }
    const pedido = await window.petShop.criarPedido(input)
    if (pedido.entregadorId !== null) {
      revisaoEntregadores++
      const entregador = entregadoresCheckout.find(item => item.id === pedido.entregadorId)
      if (entregador) entregador.disponivel = false
      renderEntregadores()
    }
    const previsto = new Date(pedido.previsaoEntrega!).toLocaleString('pt-BR')
    requiredElement<HTMLElement>('#checkout-subtotal').textContent = formatCurrency(pedido.subtotal)
    requiredElement<HTMLElement>('#checkout-shipping').textContent = formatCurrency(pedido.frete)
    requiredElement<HTMLElement>('#checkout-total').textContent = formatCurrency(pedido.total)
    requiredElement<HTMLElement>('#order-preview').textContent = `Pedido #${pedido.id} registrado · previsão: ${previsto}.`
    const envio = await tentarEnviarReciboVenda({
      id: String(pedido.id),
      cliente: pedido.clienteNome,
      email: pedido.clienteEmail ?? '',
      totalCentavos: Math.round(pedido.total * 100),
      status: 'confirmada',
    }, emailService)
    if (envio.enviado) {
      requiredElement<HTMLElement>('#order-preview').textContent += ' Recibo processado em modo mock.'
    } else {
      requiredElement<HTMLElement>('#order-preview').textContent += ` Venda confirmada; falha no recibo: ${envio.erro.message}`
    }
    checkout.limparCarrinho()
    distanciaCalculada = null
    duracaoCalculada = null
    renderCarrinho()
    void carregarCheckoutData()
    setStatus('Pedido confirmado e estoque atualizado.', 'success')
  } catch (error) {
    distanciaCalculada = null
    duracaoCalculada = null
    setStatus(errorMessage(error, 'Não foi possível confirmar o pedido.'), 'danger')
    void carregarCheckoutData()
  } finally {
    confirmandoPedido = false
    checkoutView.inert = false
    renderCarrinho()
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
  document.body.classList.toggle('signed-out', !autenticado)
  if (autenticado) mostrarTela('dashboard')
  else {
    for (const view of [clientsView, checkoutView, historyView]) view.classList.add('d-none')
    catalogo.mostrar('', false)
  }
  appNav.classList.toggle('d-none', !autenticado)
  appNav.classList.toggle('d-flex', autenticado)
  sessionActions.classList.toggle('d-none', !autenticado)
  sessionActions.classList.toggle('d-flex', autenticado)
  sessionUser.textContent = usuarioAtual
    ? `${usuarioAtual.nome} · ${usuarioAtual.nivel === 'admin' ? 'Administrador' : 'Atendente'}`
    : ''
}

async function carregarProdutos(): Promise<void> {
  const revisao = ++revisaoProdutos
  const status = requiredElement<HTMLElement>('#products-source')
  try {
    const produtos = await window.petShop.listarProdutos()
    if (revisao !== revisaoProdutos) return
    produtosCheckout = produtos.map((produto: ProdutoResumo) => ({ ...produto, categoria: produto.categoria ?? 'Catálogo' }))
    status.textContent = produtos.some(produto => produto.disponivel) ? '' : 'Nenhum produto disponível para venda.'
    renderProdutos()
  } catch (error) {
    if (revisao !== revisaoProdutos) return
    produtosCheckout = []
    renderProdutos()
    status.textContent = errorMessage(error, 'Falha ao carregar produtos.')
  }
}

async function carregarEntregadores(): Promise<void> {
  if (salvandoEntregador) return
  const revisao = ++revisaoEntregadores
  delivererSubmit.disabled = true
  delivererStatus.textContent = 'Carregando…'
  try {
    const lista = await window.petShop.listarEntregadores()
    if (revisao !== revisaoEntregadores) return
    entregadoresCheckout = lista
    renderEntregadores()
    delivererStatus.textContent = lista.length ? '' : 'Nenhum entregador cadastrado.'
  } catch (error) {
    if (revisao !== revisaoEntregadores) return
    delivererStatus.textContent = errorMessage(error, 'Falha ao carregar entregadores.')
  } finally {
    if (revisao === revisaoEntregadores) delivererSubmit.disabled = false
  }
}

function carregarCheckoutData(): Promise<unknown> {
  return Promise.all([carregarProdutos(), carregarEntregadores()])
}
window.addEventListener('focus', () => {
  if (usuarioAtual && telaAtual === 'checkout') void carregarEntregadores()
})

async function carregarHistorico(): Promise<void> {
  const container = requiredElement<HTMLElement>('#history-list')
  const empty = requiredElement<HTMLElement>('#history-empty')
  try {
    const pedidos = await window.petShop.listarPedidos()
    empty.textContent = 'Nenhum pedido confirmado.'
    container.replaceChildren()
    empty.classList.toggle('d-none', pedidos.length > 0)
    for (const pedido of pedidos) container.append(renderPedidoHistorico(pedido))
  } catch (error) {
    container.replaceChildren()
    empty.classList.remove('d-none')
    empty.textContent = errorMessage(error, 'Não foi possível carregar o histórico.')
  }
}

function renderPedidoHistorico(pedido: PedidoRegistrado): HTMLElement {
  const details = document.createElement('details')
  details.className = 'border rounded bg-white'

  const summary = document.createElement('summary')
  summary.className = 'd-flex flex-wrap align-items-center gap-3 p-3'
  const numero = String(pedido.id).padStart(5, '0')
  summary.innerHTML = `
    <strong>Pedido #${numero}</strong>
    <span class="text-secondary">${escapeHtml(pedido.clienteNome)}</span>
    <strong class="ms-auto">${formatCurrency(pedido.total)}</strong>
    <span class="badge text-bg-success">Confirmada</span>
  `
  details.append(summary)

  const receipt = document.createElement('article')
  receipt.className = 'border-top p-3'

  const meta = document.createElement('p')
  meta.className = 'text-secondary small'
  meta.textContent = `Cliente: ${pedido.clienteNome} · ${
    pedido.clienteEmail ?? 'Sem e-mail cadastrado'
  } · Pedido em ${new Date(pedido.criadoEm).toLocaleString('pt-BR')}`
  receipt.append(meta)

  const table = document.createElement('div')
  table.className = 'table-responsive'
  const tableElement = document.createElement('table')
  tableElement.className = 'table table-sm align-middle'
  tableElement.innerHTML = `
    <thead><tr><th>Produto</th><th class="text-end">Qtd.</th><th class="text-end">Unitário</th><th class="text-end">Subtotal</th></tr></thead>
  `
  const body = document.createElement('tbody')
  for (const item of pedido.itens) {
    const row = document.createElement('tr')
    row.innerHTML = `
      <td>${escapeHtml(item.nome)}</td>
      <td class="text-end">${item.quantidade}</td>
      <td class="text-end">${formatCurrency(item.precoUnitario)}</td>
      <td class="text-end">${formatCurrency(item.subtotal)}</td>
    `
    body.append(row)
  }
  tableElement.append(body)
  table.append(tableElement)
  receipt.append(table)

  const totals = document.createElement('div')
  totals.className = 'ms-auto text-end'
  totals.style.maxWidth = '240px'
  totals.innerHTML = `
    <div class="d-flex justify-content-between"><span>Subtotal</span><strong>${formatCurrency(pedido.subtotal)}</strong></div>
    <div class="d-flex justify-content-between"><span>Frete</span><strong>${formatCurrency(pedido.frete)}</strong></div>
    <div class="d-flex justify-content-between fs-5 mt-1"><span>Total</span><strong>${formatCurrency(pedido.total)}</strong></div>
  `
  receipt.append(totals)

  const actions = document.createElement('div')
  actions.className = 'd-flex align-items-center gap-2 mt-3'
  const printButton = document.createElement('button')
  printButton.type = 'button'
  printButton.className = 'btn btn-outline-secondary btn-sm'
  printButton.textContent = 'Imprimir recibo'
  printButton.addEventListener('click', () => {
    details.open = true
    details.classList.add('imprimir')
    try { window.print() } finally { details.classList.remove('imprimir') }
  })
  const sendButton = document.createElement('button')
  sendButton.type = 'button'
  sendButton.className = 'btn btn-outline-primary btn-sm'
  sendButton.textContent = 'Enviar por e-mail'
  const status = document.createElement('span')
  status.className = 'small text-secondary'
  status.setAttribute('role', 'status')
  sendButton.addEventListener('click', async () => {
    sendButton.disabled = true
    status.textContent = 'Processando envio em modo mock...'
    const resultado = await tentarEnviarReciboVenda({
      id: String(pedido.id),
      cliente: pedido.clienteNome,
      email: pedido.clienteEmail ?? '',
      totalCentavos: Math.round(pedido.total * 100),
      status: 'confirmada',
    }, emailService)
    if (resultado.enviado) {
      status.className = 'small text-success'
      status.textContent = 'Recibo processado em modo mock.'
    } else {
      status.className = 'small text-danger'
      status.textContent = `Venda confirmada. Envio não realizado: ${resultado.erro.message}`
    }
    sendButton.disabled = false
  })
  actions.append(sendButton, printButton, status)
  receipt.append(actions)
  details.append(receipt)
  return details
}

function escapeHtml(value: string): string {
  const element = document.createElement('span')
  element.textContent = value
  return element.innerHTML
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
      try {
        checkout.adicionarProduto(produto.id, produto.nome, produto.preco, 1)
      } catch (error) {
        setStatus(errorMessage(error, 'Não foi possível adicionar o produto.'), 'danger')
        return
      }
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
      renderCarrinho()
    })
    controls.append(decrement, quantity, increment)
    row.append(description, controls)
    container.append(row)
  }
  const subtotal = checkout.calcularSubtotal()
  requiredElement<HTMLElement>('#checkout-subtotal').textContent = formatCurrency(subtotal)
  requiredElement<HTMLElement>('#checkout-total').textContent = formatCurrency(distanciaCalculada === null ? subtotal : checkout.calcularTotal(distanciaCalculada).total)
  if (distanciaCalculada === null) {
    requiredElement<HTMLElement>('#checkout-shipping').textContent = 'A calcular'
    requiredElement<HTMLElement>('#distance-note').textContent = ''
  }
  requiredElement<HTMLButtonElement>('#create-order').disabled = confirmandoPedido || distanciaCalculada === null || itens.length === 0
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

function opcao(rotulo: string, valor: string): HTMLOptionElement {
  const elemento = document.createElement('option')
  elemento.textContent = rotulo
  elemento.value = valor
  return elemento
}

function renderClientesCheckout(): void {
  const select = requiredElement<HTMLSelectElement>('#checkout-customer')
  const selected = select.value
  select.replaceChildren(opcao('Selecione um cliente', ''))
  for (const cliente of clientesCheckout) select.add(opcao(cliente.nome, String(cliente.id)))
  if (clientesCheckout.some(cliente => String(cliente.id) === selected)) select.value = selected
}

function renderEntregadores(): void {
  const list = requiredElement<HTMLElement>('#deliverers-list')
  const select = requiredElement<HTMLSelectElement>('#checkout-deliverer')
  const selected = select.value
  list.replaceChildren()
  select.replaceChildren(opcao('Sem entregador', ''))
  for (const entregador of [...entregadoresCheckout].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id - b.id)) {
    const option = opcao(`${entregador.nome} (${entregador.veiculo})`, String(entregador.id))
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
    toggle.disabled = salvandoEntregador
    toggle.addEventListener('click', () => void alterarEntregador(async () => {
      const updated = await window.petShop.atualizarEntregador(entregador.id, { ...entregador, disponivel: !entregador.disponivel }, entregador)
      entregadoresCheckout = entregadoresCheckout.map(item => item.id === updated.id ? updated : item)
    }, 'Disponibilidade atualizada.'))
    const editar = document.createElement('button')
    editar.type = 'button'
    editar.className = 'btn btn-sm btn-outline-secondary'
    editar.textContent = 'Editar'
    editar.disabled = salvandoEntregador
    editar.addEventListener('click', () => editarEntregador(entregador))
    row.append(label, toggle, editar)
    if (usuarioAtual?.nivel === 'admin') {
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'btn btn-outline-danger btn-sm'
      remove.textContent = 'Remover'
      remove.disabled = salvandoEntregador
      remove.addEventListener('click', () => void alterarEntregador(async () => {
        await window.petShop.excluirEntregador(entregador.id)
        if (entregadorEmEdicao?.id === entregador.id) editarEntregador(null)
        entregadoresCheckout = entregadoresCheckout.filter(item => item.id !== entregador.id)
      }, 'Entregador removido.'))
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
  if (!(error instanceof Error) || !error.message) return fallback
  return error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
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

}).catch(() => {
  setStatus('Não foi possível restaurar a sessão.', 'danger')
})
