import { app, ipcMain } from 'electron'
import type { ClienteInput, CriarPedidoInput, EntregadorInput, UsuarioAutenticado } from '../../shared/contracts'
import { testMySqlConnection } from '../database/connection'
import { MySqlClienteRepository } from '../modules/clientes/cliente-repository'
import { ClienteNaoEncontradoError, ClienteService, EntradaInvalidaError } from '../modules/clientes/cliente-service'
import { exigirAdmin, exigirLogin, NaoAutorizadoError } from '../modules/usuarios/authorization'
import { MySqlUsuarioRepository } from '../modules/usuarios/usuario-repository'
import { CredenciaisInvalidasError, UsuarioService } from '../modules/usuarios/usuario-service'
import { ViaCepError, ViaCepService } from '../modules/viacep/viacep-service'
import { DistanceApiError, DistanceService } from '../../services/DistanceService'
import { ProdutoRepository } from '../modules/produtos/produto-repository'
import { EntregadorPersistenceService, EntregadorEntradaInvalidaError, EntregadorNaoEncontradoError } from '../modules/entregadores/entregador-persistence-service'
import { PedidoEntradaInvalidaError, PedidoService } from '../modules/pedidos/pedido-service'
import { PedidoOperacaoError } from '../modules/pedidos/pedido-errors'

type SafeHandler = (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown

export function registerAppHandlers(): void {
  const usuarioService = new UsuarioService(new MySqlUsuarioRepository())
  const clienteService = new ClienteService(new MySqlClienteRepository())
  const viaCepService = new ViaCepService()
  const distanceService = new DistanceService()
  const produtoRepository = new ProdutoRepository()
  const entregadorService = new EntregadorPersistenceService()
  const pedidoService = new PedidoService()
  let usuarioAtual: UsuarioAutenticado | null = null

  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('database:test-connection', async () => {
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
    usuarioAtual = await usuarioService.autenticar(
      typeof email === 'string' ? email : '',
      typeof senha === 'string' ? senha : ''
    )
    return usuarioAtual
  })
  handleSafely('usuarios:logout', () => {
    usuarioAtual = null
  })
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
  handleSafely('distancia:calcular', (_event, destino) => {
    exigirLogin(usuarioAtual)
    return distanceService.calcularRotaPorEndereco(typeof destino === 'string' ? destino : '')
  })
  handleSafely('produtos:listar', () => {
    exigirLogin(usuarioAtual)
    return produtoRepository.listarDisponiveis()
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
  handleSafely('pedidos:criar', (_event, input) => {
    exigirLogin(usuarioAtual)
    return pedidoService.criar(input as CriarPedidoInput)
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
        || error instanceof PedidoOperacaoError
      ) {
        throw new Error(error.message)
      }

      const code = error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN'
      console.error(`Falha no handler ${channel} (${code}).`)
      throw new Error('Não foi possível concluir a operação. Tente novamente.')
    }
  })
}
