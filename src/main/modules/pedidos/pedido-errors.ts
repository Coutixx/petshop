export class PedidoOperacaoError extends Error {
  constructor(message: string) { super(message); this.name = 'PedidoOperacaoError' }
}
