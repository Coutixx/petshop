import { afterEach, describe, expect, it, vi } from 'vitest'
import { CotacaoService } from '../../src/shared/domain/produtos/cotacao-service'

const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const valido = { USDBRL: { code: 'USD', codein: 'BRL', bid: '5.10', ask: '5.1234', timestamp: '1700000000' } }

describe('cotação pública USD/BRL', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('consulta pelo adaptador padrão sem passar o serviço como contexto ao fetch nativo', async () => {
    vi.stubGlobal('fetch', function (this: unknown) {
      if (this instanceof CotacaoService) throw new TypeError('Illegal invocation')
      return Promise.resolve(response(valido))
    })
    expect((await new CotacaoService().atualizar()).cotacao?.taxa).toBe(5.1234)
  })

  it('usa a taxa de venda e o horário do provedor com prazo limite de consulta', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(valido))
    const resultado = await new CotacaoService(fetcher).atualizar()
    expect(resultado).toMatchObject({ emCache: false, cotacao: { taxa: 5.1234, atualizadaEm: '2023-11-14T22:13:20.000Z' } })
    expect(fetcher).toHaveBeenCalledWith('https://economia.awesomeapi.com.br/json/last/USD-BRL', expect.objectContaining({ signal: expect.any(AbortSignal), redirect: 'error' }))
  })
  it('preserva a última taxa em falha e a substitui após recuperação', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(valido))
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(response({ USDBRL: { ...valido.USDBRL, ask: '6' } }))
    const service = new CotacaoService(fetcher)
    const primeiro = await service.atualizar()
    const fallback = await service.atualizar()
    expect(fallback).toMatchObject({ emCache: true, cotacao: primeiro.cotacao })
    expect((await service.atualizar()).cotacao?.taxa).toBe(6)
  })
  it.each([
    {}, { USDBRL: { ...valido.USDBRL, ask: 'NaN' } }, { USDBRL: { ...valido.USDBRL, ask: '0' } },
    { USDBRL: { ...valido.USDBRL, ask: '-2' } }, { USDBRL: { ...valido.USDBRL, timestamp: 'quebrado' } },
    { USDBRL: { ...valido.USDBRL, timestamp: '999999999999' } }, { USDBRL: { ...valido.USDBRL, code: 'EUR' } }
  ])('trata resposta inválida sem fallback fictício: %j', async (body) => {
    expect(await new CotacaoService(vi.fn<typeof fetch>().mockResolvedValue(response(body))).atualizar()).toMatchObject({ cotacao: null, emCache: false })
  })
  it.each([429, 500, 503])('trata HTTP %s', async (code) => {
    expect((await new CotacaoService(vi.fn<typeof fetch>().mockResolvedValue(response({}, code))).atualizar()).cotacao).toBeNull()
  })
  it('trata timeout e JSON inválido', async () => {
    expect((await new CotacaoService(vi.fn<typeof fetch>().mockRejectedValue(new DOMException('Timeout', 'TimeoutError'))).atualizar()).cotacao).toBeNull()
    expect((await new CotacaoService(vi.fn<typeof fetch>().mockResolvedValue(new Response('{'))).atualizar()).cotacao).toBeNull()
  })
})
