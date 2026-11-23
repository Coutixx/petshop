import { describe, expect, it, vi } from 'vitest'
import type { EntregadorInput, EntregadorResumo } from '../../src/shared/contracts'
import { EntregadorEntradaInvalidaError, EntregadorPersistenceService, type EntregadorRepositoryPort } from '../../src/main/modules/entregadores/entregador-persistence-service'

const input: EntregadorInput = { nome: ' Ana Costa ', telefone: '(19) 99999-1111', veiculo: 'Moto', disponivel: true }
const row: EntregadorResumo = { id: 7, nome: 'Ana Costa', telefone: '(19) 99999-1111', veiculo: 'Moto', disponivel: true }

describe('EntregadorPersistenceService', () => {
  it('normaliza e delega o cadastro ao repositório', async () => {
    const criar = vi.fn(async (value: EntregadorInput) => ({ ...value, id: 7 }))
    const repository: EntregadorRepositoryPort = {
      listar: vi.fn(async () => [row]), criar,
      atualizar: vi.fn(async () => row), excluir: vi.fn(async () => true)
    }
    const service = new EntregadorPersistenceService(repository)
    await expect(service.criar(input)).resolves.toEqual(row)
    expect(criar).toHaveBeenCalledWith({ ...input, nome: 'Ana Costa' })
  })

  it('rejeita telefone inválido', async () => {
    const service = new EntregadorPersistenceService({
      listar: vi.fn(async () => []), criar: vi.fn(async () => row),
      atualizar: vi.fn(async () => row), excluir: vi.fn(async () => true)
    })
    expect(() => service.criar({ ...input, telefone: '123' })).toThrow(EntregadorEntradaInvalidaError)
  })
})
