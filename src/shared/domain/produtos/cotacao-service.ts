export interface Cotacao {
  taxa: number
  atualizadaEm: string
}

export interface ResultadoCotacao {
  cotacao: Cotacao | null
  emCache: boolean
  mensagem: string
}

// Consulta pública sem chave: https://docs.awesomeapi.com.br/api-de-moedas
export class CotacaoService {
  private ultima: Cotacao | null = null

  // A função nativa do navegador não pode receber o serviço como `this`.
  constructor(private readonly consultar: typeof fetch = (input, init) => fetch(input, init)) {}

  get taxa(): number | null { return this.ultima?.taxa ?? null }

  async atualizar(): Promise<ResultadoCotacao> {
    try {
      const response = await this.consultar('https://economia.awesomeapi.com.br/json/last/USD-BRL', {
        signal: AbortSignal.timeout(8000), redirect: 'error'
      })
      if (!response.ok) throw new Error('Resposta indisponível.')
      const body = await response.json()
      const moeda = body?.USDBRL
      const taxa = Number(moeda?.ask)
      const timestamp = Number(moeda?.timestamp)
      if (moeda?.code !== 'USD' || moeda?.codein !== 'BRL' || !Number.isFinite(taxa) || taxa <= 0 ||
          !Number.isFinite(timestamp) || timestamp <= 0 || timestamp * 1000 > Date.now() + 300000) {
        throw new Error('Cotação inválida.')
      }
      this.ultima = { taxa, atualizadaEm: new Date(timestamp * 1000).toISOString() }
      return { cotacao: { ...this.ultima }, emCache: false, mensagem: 'Cotação de venda (ask), referência AwesomeAPI.' }
    } catch {
      return {
        cotacao: this.ultima ? { ...this.ultima } : null,
        emCache: this.ultima !== null,
        mensagem: this.ultima
          ? 'API indisponível. Usando a última cotação obtida nesta sessão; confira a data.'
          : 'Cotação indisponível. As conversões aguardam uma consulta válida. Tente atualizar novamente.'
      }
    }
  }
}
