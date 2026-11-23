import type { Coordenadas, RotaCalculada } from '../shared/contracts'

export type { Coordenadas, RotaCalculada } from '../shared/contracts'

type FetchLike = typeof fetch

export class DistanceApiError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DistanceApiError'
  }
}

export class DistanceService {
  private static geocodeGate: Promise<void> = Promise.resolve()
  private static lastGeocodeAt = 0
  constructor(
    private readonly fetcher: FetchLike = fetch,
    private readonly timeoutMs = 5000,
    private readonly originAddress = process.env.STORE_ADDRESS?.trim() ?? ''
  ) {}

  async calcularRotaPorEndereco(destino: string): Promise<RotaCalculada> {
    if (!this.originAddress) {
      throw new DistanceApiError('Configure STORE_ADDRESS no .env com o endereço de origem da loja.')
    }
    if (!destino.trim()) throw new DistanceApiError('O cliente não possui endereço para calcular a entrega.')
    const origemCoords = await this.geocodificar(this.originAddress)
    const destinoCoords = await this.geocodificar(destino)
    return this.calcularRota(origemCoords, destinoCoords)
  }

  async calcularRota(origem: Coordenadas, destino: Coordenadas): Promise<RotaCalculada> {
    const coords = `${origem.longitude},${origem.latitude};${destino.longitude},${destino.latitude}`
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.fetcher(url, { signal: controller.signal })
      if (!response.ok) throw new DistanceApiError(`API de distância respondeu HTTP ${response.status}.`)
      const data: unknown = await response.json()
      if (!isRouteResponse(data) || data.code !== 'Ok' || !data.routes.length) {
        throw new DistanceApiError('A API de distância não encontrou uma rota válida.')
      }
      const rota = data.routes[0]
      return { distanciaKm: Number((rota.distance / 1000).toFixed(2)), duracaoMinutos: Math.ceil(rota.duration / 60) }
    } catch (error) {
      if (error instanceof DistanceApiError) throw error
      if (controller.signal.aborted) throw new DistanceApiError('A consulta de distância excedeu o tempo limite.', { cause: error })
      throw new DistanceApiError('Não foi possível conectar à API de distância.', { cause: error })
    } finally {
      clearTimeout(timeout)
    }
  }

  private async geocodificar(endereco: string): Promise<Coordenadas> {
    await DistanceService.respeitarLimiteGeocodificacao()
    const params = new URLSearchParams({ q: endereco, format: 'jsonv2', limit: '1', countrycodes: 'br' })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetcher(`https://nominatim.openstreetmap.org/search?${params}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'PetShopCotil/1.0 (desktop checkout)' }
      })
      if (!response.ok) throw new DistanceApiError(`Geocodificação respondeu HTTP ${response.status}.`)
      const data: unknown = await response.json()
      if (!Array.isArray(data) || !data.length || !isGeocodedPoint(data[0])) {
        throw new DistanceApiError('Não foi possível localizar o endereço informado.')
      }
      return { latitude: Number(data[0].lat), longitude: Number(data[0].lon) }
    } catch (error) {
      if (error instanceof DistanceApiError) throw error
      if (controller.signal.aborted) throw new DistanceApiError('A geocodificação excedeu o tempo limite.', { cause: error })
      throw new DistanceApiError('Não foi possível conectar ao serviço de geocodificação.', { cause: error })
    } finally {
      clearTimeout(timeout)
    }
  }

  private static async respeitarLimiteGeocodificacao(): Promise<void> {
    const anterior = DistanceService.geocodeGate
    let liberar!: () => void
    DistanceService.geocodeGate = new Promise<void>(resolve => { liberar = resolve })
    await anterior
    try {
      const espera = Math.max(0, 1000 - (Date.now() - DistanceService.lastGeocodeAt))
      if (espera) await new Promise(resolve => setTimeout(resolve, espera))
      DistanceService.lastGeocodeAt = Date.now()
    } finally {
      liberar()
    }
  }
}

function isGeocodedPoint(value: unknown): value is { lat: string; lon: string } {
  if (typeof value !== 'object' || value === null) return false
  const point = value as { lat?: unknown; lon?: unknown }
  return typeof point.lat === 'string' && Number.isFinite(Number(point.lat)) &&
    typeof point.lon === 'string' && Number.isFinite(Number(point.lon))
}

function isRouteResponse(value: unknown): value is { code: string; routes: Array<{ distance: number; duration: number }> } {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { code?: unknown; routes?: unknown }
  if (typeof candidate.code !== 'string' || !Array.isArray(candidate.routes)) return false
  return candidate.routes.every((route: unknown) => {
    if (typeof route !== 'object' || route === null) return false
    const item = route as { distance?: unknown; duration?: unknown }
    return typeof item.distance === 'number' && Number.isFinite(item.distance) &&
      typeof item.duration === 'number' && Number.isFinite(item.duration)
  })
}
