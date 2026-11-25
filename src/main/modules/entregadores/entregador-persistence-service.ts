import type { EntregadorInput, EntregadorResumo } from '../../../shared/contracts'
import { EntregadorRepository } from './entregador-repository'

export interface EntregadorRepositoryPort {
  listar(): Promise<EntregadorResumo[]>
  criar(input: EntregadorInput): Promise<EntregadorResumo>
  atualizar(id: number, input: EntregadorInput, anterior?: EntregadorInput): Promise<EntregadorResumo | null>
  excluir(id: number): Promise<boolean>
}

export class EntregadorEntradaInvalidaError extends Error {
  constructor(message: string) { super(message); this.name = 'EntregadorEntradaInvalidaError' }
}

export class EntregadorNaoEncontradoError extends Error {
  constructor() { super('Entregador não encontrado.'); this.name = 'EntregadorNaoEncontradoError' }
}

export class EntregadorPersistenceService {
  constructor(private readonly repository: EntregadorRepositoryPort = new EntregadorRepository()) {}

  listar(): Promise<EntregadorResumo[]> { return this.repository.listar() }

  criar(input: EntregadorInput): Promise<EntregadorResumo> {
    return this.repository.criar(validar(input))
  }

  async atualizar(id: number, input: EntregadorInput, anterior?: EntregadorInput): Promise<EntregadorResumo> {
    validarId(id)
    const entregador = await this.repository.atualizar(id, validar(input), anterior && validar(anterior))
    if (!entregador && anterior) throw new EntregadorEntradaInvalidaError('O cadastro mudou. Confira a lista atualizada e tente novamente.')
    if (!entregador) throw new EntregadorNaoEncontradoError()
    return entregador
  }

  async excluir(id: number): Promise<void> {
    validarId(id)
    if (!(await this.repository.excluir(id))) throw new EntregadorNaoEncontradoError()
  }
}

function validar(input: EntregadorInput): EntregadorInput {
  if (!input || typeof input !== 'object') throw new EntregadorEntradaInvalidaError('Dados do entregador inválidos.')
  const nome = typeof input.nome === 'string' ? input.nome.trim() : ''
  const telefone = typeof input.telefone === 'string' ? input.telefone.trim() : ''
  const veiculo = typeof input.veiculo === 'string' ? input.veiculo.trim() : ''
  if (nome.length < 2 || nome.length > 120) throw new EntregadorEntradaInvalidaError('Informe um nome entre 2 e 120 caracteres.')
  if (telefone.replace(/\D/g, '').length < 10 || telefone.length > 20) throw new EntregadorEntradaInvalidaError('Informe um telefone válido com DDD.')
  if (!veiculo || veiculo.length > 40) throw new EntregadorEntradaInvalidaError('Informe um veículo com até 40 caracteres.')
  if (typeof input.disponivel !== 'boolean') throw new EntregadorEntradaInvalidaError('Disponibilidade inválida.')
  return { nome, telefone, veiculo, disponivel: input.disponivel }
}

function validarId(id: number): void {
  if (!Number.isSafeInteger(id) || id < 1) throw new EntregadorEntradaInvalidaError('Identificador de entregador inválido.')
}
