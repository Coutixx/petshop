import type { Produto, ProdutoInput } from '../domain/produtos/produto'
import type { ResultadoCotacao } from '../domain/produtos/cotacao-service'

export interface ClienteResumo {
  id: number
  nome: string
}

export type NivelAcesso = 'admin' | 'atendente'

export interface UsuarioAutenticado {
  id: number
  nome: string
  email: string
  nivel: NivelAcesso
}

export interface Cliente {
  id: number
  nome: string
  email: string | null
  telefone: string
  cpf: string | null
  cep: string
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  cidade: string
  uf: string
}

export type ClienteInput = Omit<Cliente, 'id'>

export interface EnderecoViaCep {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

export interface ProdutoResumo {
  id: number
  nome: string
  categoria?: string
  preco: number
  disponivel: boolean
}

export interface EntregadorResumo {
  id: number
  nome: string
  telefone: string
  veiculo: string
  disponivel: boolean
}

export type EntregadorInput = Omit<EntregadorResumo, 'id'>

export interface Coordenadas {
  latitude: number
  longitude: number
}

export interface RotaCalculada {
  distanciaKm: number
  duracaoMinutos: number
}

export interface ItemPedidoRascunho {
  precoEsperado?: number
  produtoId: number
  quantidade: number
}

export interface PedidoRascunho {
  clienteId: number
  entregadorId: number | null
  itens: ItemPedidoRascunho[]
  frete: number
  criadoEm: string
  previsaoEntrega: string | null
}

export interface CriarPedidoInput {
  clienteId: number
  entregadorId: number | null
  itens: ItemPedidoRascunho[]
  distanciaKm: number
  duracaoMinutos: number
}

export interface ItemPedidoConfirmado {
  produtoId: number
  nome: string
  precoUnitario: number
  quantidade: number
  subtotal: number
}

export interface PedidoRegistrado {
  id: number
  clienteId: number
  clienteNome: string
  clienteEmail: string | null
  entregadorId: number | null
  itens: ItemPedidoConfirmado[]
  subtotal: number
  frete: number
  total: number
  criadoEm: string
  previsaoEntrega: string | null
}

export interface DesktopApi {
  getAppVersion(): Promise<string>
  testDatabaseConnection(): Promise<DatabaseConnectionTestResult>
  login(email: string, senha: string): Promise<UsuarioAutenticado>
  logout(): Promise<void>
  getUsuarioAtual(): Promise<UsuarioAutenticado | null>
  listarClientes(): Promise<Cliente[]>
  criarCliente(input: ClienteInput): Promise<Cliente>
  atualizarCliente(id: number, input: ClienteInput): Promise<Cliente>
  excluirCliente(id: number): Promise<void>
  consultarCep(cep: string): Promise<EnderecoViaCep>
  listarCatalogo(): Promise<Produto[]>
  criarProduto(input: ProdutoInput): Promise<void>
  atualizarProduto(id: number, input: ProdutoInput, estoqueAnterior: number): Promise<void>
  excluirProduto(id: number): Promise<void>
  atualizarCotacao(): Promise<ResultadoCotacao>
  listarProdutos(): Promise<ProdutoResumo[]>
  listarEntregadores(): Promise<EntregadorResumo[]>
  criarEntregador(input: EntregadorInput): Promise<EntregadorResumo>
  atualizarEntregador(id: number, input: EntregadorInput, anterior?: EntregadorInput): Promise<EntregadorResumo>
  excluirEntregador(id: number): Promise<void>
  calcularDistancia(clienteId: number): Promise<RotaCalculada>
  criarPedido(input: CriarPedidoInput): Promise<PedidoRegistrado>
  listarPedidos(): Promise<PedidoRegistrado[]>
}

export interface DatabaseConnectionTestResult {
  ok: boolean
  message: string
}
