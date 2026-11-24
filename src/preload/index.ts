import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from '../shared/contracts'

const api: DesktopApi = {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  testDatabaseConnection: () => ipcRenderer.invoke('database:test-connection'),
  login: (email, senha) => ipcRenderer.invoke('usuarios:login', email, senha),
  logout: () => ipcRenderer.invoke('usuarios:logout'),
  getUsuarioAtual: () => ipcRenderer.invoke('usuarios:atual'),
  listarClientes: () => ipcRenderer.invoke('clientes:listar'),
  criarCliente: (input) => ipcRenderer.invoke('clientes:criar', input),
  atualizarCliente: (id, input) => ipcRenderer.invoke('clientes:atualizar', id, input),
  excluirCliente: (id) => ipcRenderer.invoke('clientes:excluir', id),
  consultarCep: (cep) => ipcRenderer.invoke('viacep:consultar', cep),
  listarCatalogo: () => ipcRenderer.invoke('produtos:catalogo'),
  criarProduto: input => ipcRenderer.invoke('produtos:criar', input),
  atualizarProduto: (id, input, estoqueAnterior) => ipcRenderer.invoke('produtos:atualizar', id, input, estoqueAnterior),
  excluirProduto: id => ipcRenderer.invoke('produtos:excluir', id),
  atualizarCotacao: () => ipcRenderer.invoke('produtos:cotacao'),
  listarProdutos: () => ipcRenderer.invoke('produtos:listar'),
  listarEntregadores: () => ipcRenderer.invoke('entregadores:listar'),
  criarEntregador: (input) => ipcRenderer.invoke('entregadores:criar', input),
  atualizarEntregador: (id, input, anterior) => ipcRenderer.invoke('entregadores:atualizar', id, input, anterior),
  excluirEntregador: (id) => ipcRenderer.invoke('entregadores:excluir', id),
  calcularDistancia: (clienteId) => ipcRenderer.invoke('distancia:calcular', clienteId),
  criarPedido: (input) => ipcRenderer.invoke('pedidos:criar', input),
  listarPedidos: () => ipcRenderer.invoke('pedidos:listar')
}

contextBridge.exposeInMainWorld('petShop', api)
