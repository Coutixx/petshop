import type { Produto } from './produto'

export const produtosDemo: Produto[] = [
  { id: 1, nome: 'Ração para cães adultos 10 kg', categoria: 'Alimentação', moeda: 'BRL', preco: 129.9, importado: false, estoque: 18 },
  { id: 2, nome: 'Shampoo neutro 500 ml', categoria: 'Higiene', moeda: 'BRL', preco: 24.9, importado: false, estoque: 4 },
  { id: 3, nome: 'Brinquedo interativo importado', categoria: 'Brinquedos', moeda: 'USD', preco: 12.5, importado: true, estoque: 7 },
  { id: 4, nome: 'Coleira ajustável', categoria: 'Acessórios', moeda: 'BRL', preco: 34.9, importado: false, estoque: 0 },
  { id: 5, nome: 'Suplemento importado', categoria: 'Saúde', moeda: 'USD', preco: 19.9, importado: true, estoque: 0 },
  { id: 6, nome: 'Areia sanitária 4 kg', categoria: 'Higiene', moeda: 'BRL', preco: 29.9, importado: false, estoque: 22 }
]
