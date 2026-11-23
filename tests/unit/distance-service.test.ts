import { describe, expect, it, vi } from 'vitest'
import { DistanceApiError, DistanceService } from '../../src/services/DistanceService'

describe('DistanceService', () => {
  const origem = { latitude: -22.9056, longitude: -47.0608 }
  const destino = { latitude: -22.907, longitude: -47.062 }

  it('converte a rota da API para quilômetros e minutos', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      code: 'Ok', routes: [{ distance: 2450, duration: 301 }]
    }), { status: 200 }))
    const service = new DistanceService(fetcher)
    await expect(service.calcularRota(origem, destino)).resolves.toEqual({ distanciaKm: 2.45, duracaoMinutos: 6 })
  })

  it('trata falha de conexão da API', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network down'))
    const service = new DistanceService(fetcher)
    await expect(service.calcularRota(origem, destino)).rejects.toThrow(DistanceApiError)
    await expect(service.calcularRota(origem, destino)).rejects.toThrow('Não foi possível conectar à API de distância.')
  })

  it('trata erro HTTP e resposta sem rota', async () => {
    const http = new DistanceService(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })))
    await expect(http.calcularRota(origem, destino)).rejects.toThrow('HTTP 503')
    const semRota = new DistanceService(vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: 'NoRoute', routes: [] }), { status: 200 })
    ))
    await expect(semRota.calcularRota(origem, destino)).rejects.toThrow('não encontrou uma rota válida')
  })

  it('exige origem configurada e trata endereço sem resultado', async () => {
    const semOrigem = new DistanceService(vi.fn<typeof fetch>(), 5, '')
    await expect(semOrigem.calcularRotaPorEndereco('Rua A, 10, Limeira, SP'))
      .rejects.toThrow('Configure STORE_ADDRESS')
    const semResultado = new DistanceService(vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    ), 5, 'Rua da Loja, 10, Limeira, SP')
    await expect(semResultado.calcularRotaPorEndereco('Rua do Cliente, 20, Limeira, SP'))
      .rejects.toThrow('Não foi possível localizar o endereço')
  })

  it('aborta chamadas que excedem o timeout', async () => {
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const service = new DistanceService(fetcher, 5)
    await expect(service.calcularRota(origem, destino)).rejects.toThrow('excedeu o tempo limite')
  })
})
