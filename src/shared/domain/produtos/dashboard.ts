import { converterPreco, type Produto } from './produto'

export function indicadoresEstoque(produtos: Produto[], taxa: number | null) {
  const semEstoque = produtos.filter((produto) => produto.estoque === 0)
  const estoqueBaixo = produtos.filter((produto) => produto.estoque > 0 && produto.estoque <= 5)
  let valorEstoqueBRL = 0
  let valoresPendentes = 0
  for (const produto of produtos) {
    if (produto.estoque === 0) continue
    const preco = converterPreco(produto, 'BRL', taxa)
    if (preco === null) valoresPendentes++
    else valorEstoqueBRL += preco * produto.estoque
  }
  return {
    totalProdutos: produtos.length,
    unidades: produtos.reduce((total, produto) => total + produto.estoque, 0),
    importados: produtos.filter((produto) => produto.importado).length,
    semEstoque,
    estoqueBaixo,
    valorEstoqueBRL: Number(valorEstoqueBRL.toFixed(2)),
    valoresPendentes
  }
}
