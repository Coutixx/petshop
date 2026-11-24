import { app, ipcMain } from 'electron'
import type { ClienteInput, CriarPedidoInput, EntregadorInput, RotaCalculada, UsuarioAutenticado } from '../../shared/contracts'
import { testMySqlConnection } from '../database/connection'
import { MySqlClienteRepository } from '../modules/clientes/cliente-repository'
import { ClienteNaoEncontradoError, ClienteService, EntradaInvalidaError } from '../modules/clientes/cliente-service'
import { exigirAdmin, exigirLogin, NaoAutorizadoError } from '../modules/usuarios/authorization'
import { MySqlUsuarioRepository } from '../modules/usuarios/usuario-repository'
import { CredenciaisInvalidasError, UsuarioService } from '../modules/usuarios/usuario-service'
import { ViaCepError, ViaCepService } from '../modules/viacep/viacep-service'
import { DistanceApiError, DistanceService } from '../../services/DistanceService'
import type { ProdutoInput } from '../../shared/domain/produtos/produto'
import { CotacaoService } from '../../shared/domain/produtos/cotacao-service'
import { PedidoRepository } from '../modules/pedidos/pedido-repository'
import { ProdutoOperacaoError, ProdutoRepository } from '../modules/produtos/produto-repository'
import { EntregadorPersistenceService, EntregadorEntradaInvalidaError, EntregadorNaoEncontradoError } from '../modules/entregadores/entregador-persistence-service'
import { PedidoEntradaInvalidaError, PedidoService } from '../modules/pedidos/pedido-service'
import { PedidoOperacaoError } from '../modules/pedidos/pedido-errors'

type SafeHandler = (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown

export function registerAppHandlers(): void {
  const usuarioService = new UsuarioService(new MySqlUsuarioRepository())
  const clienteRepository = new MySqlClienteRepository()
  const clienteService = new ClienteService(clienteRepository)
  const viaCepService = new ViaCepService()
  const distanceService = new DistanceService()
  const produtoRepository = new ProdutoRepository()
  const entregadorService = new EntregadorPersistenceService()
  let cambio = new CotacaoService()
  const pedidoService = new PedidoService(new PedidoRepository(() => cambio.taxa))
  let usuarioAtual: UsuarioAutenticado | null = null

  let ultimaRota: { clienteId: number; endereco: string; rota: RotaCalculada } | null = null
  let consultaRota = 0

  function encerrarSessao(): void {
    usuarioAtual = null
    cambio = new CotacaoService()
    ultimaRota = null
    consultaRota++
  }
  app.on('browser-window-created', (_event, window) => window.once('closed', encerrarSessao))

  async function enderecoEntrega(id: number): Promise<string> {
    const cliente = await clienteRepository.buscarPorId(id)
    if (!cliente) throw new ClienteNaoEncontradoError()
    return [cliente.logradouro, cliente.numero, cliente.bairro, cliente.cidade + ' - ' + cliente.uf, cliente.cep, 'Brasil'].join(', ')
  }

  ipcMain.handle('app:get-version', () => app.getVersion())
  handleSafely('database:test-connection', async () => {
    exigirLogin(usuarioAtual)
    try {
      await testMySqlConnection()
      return { ok: true, message: 'Conexão MySQL estabelecida.' }
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN'
      console.error(`Falha no teste MySQL (${code}).`)
      return {
        ok: false,
        message: 'Não foi possível conectar. Confira o .env e o acesso à rede da escola.'
      }
    }
  })

  handleSafely('usuarios:login', async (_event, email, senha) => {
    encerrarSessao()
    const usuario = await usuarioService.autenticar(
      typeof email === 'string' ? email : '',
      typeof senha === 'string' ? senha : ''
    )
    if (_event.sender.isDestroyed()) throw new NaoAutorizadoError()
    usuarioAtual = usuario
    return usuarioAtual
  })
  handleSafely('usuarios:logout', encerrarSessao)
  handleSafely('usuarios:atual', () => usuarioAtual)

  handleSafely('clientes:listar', () => {
    exigirLogin(usuarioAtual)
    return clienteService.listar()
  })
  handleSafely('clientes:criar', (_event, input) => {
    exigirLogin(usuarioAtual)
    return clienteService.criar(input as ClienteInput)
  })
  handleSafely('clientes:atualizar', (_event, id, input) => {
    exigirLogin(usuarioAtual)
    return clienteService.atualizar(typeof id === 'number' ? id : Number.NaN, input as ClienteInput)
  })
  handleSafely('clientes:excluir', (_event, id) => {
    exigirAdmin(usuarioAtual)
    return clienteService.excluir(typeof id === 'number' ? id : Number.NaN)
  })
  handleSafely('viacep:consultar', (_event, cep) => {
    exigirLogin(usuarioAtual)
    return viaCepService.consultar(typeof cep === 'string' ? cep : '')
  })
  handleSafely('distancia:calcular', async (_event, clienteId) => {
    exigirLogin(usuarioAtual)
    if (typeof clienteId !== 'number' || !Number.isSafeInteger(clienteId) || clienteId < 1) {
      throw new EntradaInvalidaError('Selecione um cliente.')
    }
    const consulta = ++consultaRota
    ultimaRota = null
    const endereco = await enderecoEntrega(clienteId)
    const rota = await distanceService.calcularRotaPorEndereco(endereco)
    if (consulta === consultaRota) ultimaRota = { clienteId, endereco, rota }
    return rota
  })
  handleSafely('produtos:catalogo', () => {
    exigirLogin(usuarioAtual)
    return produtoRepository.listar()
  })
  handleSafely('produtos:criar', (_event, input) => {
    exigirLogin(usuarioAtual)
    return produtoRepository.criar(input as ProdutoInput)
  })
  handleSafely('produtos:atualizar', (_event, id, input, estoqueAnterior) => {
    exigirLogin(usuarioAtual)
    return produtoRepository.atualizar(Number(id), input as ProdutoInput, Number(estoqueAnterior))
  })
  handleSafely('produtos:excluir', (_event, id) => {
    exigirAdmin(usuarioAtual)
    return produtoRepository.excluir(Number(id))
  })
  handleSafely('produtos:cotacao', () => {
    exigirLogin(usuarioAtual)
    return cambio.atualizar()
  })
  handleSafely('produtos:listar', () => {
    exigirLogin(usuarioAtual)
    return produtoRepository.listarDisponiveis(cambio.taxa)
  })
  handleSafely('entregadores:listar', () => {
    exigirLogin(usuarioAtual)
    return entregadorService.listar()
  })
  handleSafely('entregadores:criar', (_event, input) => {
    exigirLogin(usuarioAtual)
    return entregadorService.criar(input as EntregadorInput)
  })
  handleSafely('entregadores:atualizar', (_event, id, input) => {
    exigirLogin(usuarioAtual)
    return entregadorService.atualizar(typeof id === 'number' ? id : Number.NaN, input as EntregadorInput)
  })
  handleSafely('entregadores:excluir', (_event, id) => {
    exigirAdmin(usuarioAtual)
    return entregadorService.excluir(typeof id === 'number' ? id : Number.NaN)
  })
  handleSafely('pedidos:criar', async (_event, input) => {
    exigirLogin(usuarioAtual)
    const pedido = input as CriarPedidoInput
    const cotacao = ultimaRota
    if (!cotacao || cotacao.clienteId !== pedido?.clienteId ||
        await enderecoEntrega(cotacao.clienteId) !== cotacao.endereco || ultimaRota !== cotacao) {
      throw new PedidoEntradaInvalidaError('Calcule a rota para o endereço atual do cliente.')
    }
    ultimaRota = null
    return pedidoService.criar({ ...pedido, ...cotacao.rota })
  })
  handleSafely('pedidos:listar', () => {
    exigirLogin(usuarioAtual)
    return pedidoService.listar()
  })
}

function handleSafely(channel: string, handler: SafeHandler): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args)
    } catch (error) {
      if (
        error instanceof EntradaInvalidaError || error instanceof ClienteNaoEncontradoError ||
        error instanceof CredenciaisInvalidasError || error instanceof ViaCepError ||
        error instanceof NaoAutorizadoError || error instanceof DistanceApiError
        || error instanceof EntregadorEntradaInvalidaError || error instanceof EntregadorNaoEncontradoError
        || error instanceof PedidoEntradaInvalidaError
        || error instanceof ProdutoOperacaoError || error instanceof PedidoOperacaoError
      ) {
        throw new Error(error.message)
      }

      const code = error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN'
      console.error(`Falha no handler ${channel} (${code}).`)
      throw new Error('Não foi possível concluir a operação. Tente novamente.')
    }
  })
}
