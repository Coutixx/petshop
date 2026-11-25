import type { Entregador } from './entregador'
import { entregadoresMock } from './entregadores-mock'

export class EntregadorService {
  private readonly entregadores: Entregador[]

  constructor(entregadores: readonly Entregador[] = entregadoresMock) {
    this.entregadores = entregadores.map((entregador) => ({ ...entregador }))
  }

  listar(): Entregador[] { return this.entregadores.map((entregador) => ({ ...entregador })) }
  buscarPorId(id: number): Entregador | undefined {
    const entregador = this.entregadores.find((item) => item.id === id)
    return entregador && { ...entregador }
  }

  adicionar(entregador: Entregador): Entregador {
    if (this.buscarPorId(entregador.id)) throw new Error('Já existe um entregador com esse ID.')
    this.entregadores.push({ ...entregador })
    return { ...entregador }
  }

  atualizar(id: number, dadosAtualizados: Entregador): Entregador | undefined {
    const indice = this.entregadores.findIndex((entregador) => entregador.id === id)
    if (indice === -1) return undefined
    this.entregadores[indice] = { ...dadosAtualizados, id }
    return { ...this.entregadores[indice] }
  }

  remover(id: number): boolean {
    const indice = this.entregadores.findIndex((entregador) => entregador.id === id)
    if (indice === -1) return false
    this.entregadores.splice(indice, 1)
    return true
  }
}
