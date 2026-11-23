import type { ProdutoCheckout } from '../models/Produto'

// Fixtures do checkout enquanto o backend de produtos não expõe uma API IPC.
export const produtosMock: ProdutoCheckout[] = [
  { id: 1, nome: 'Ração para cães 3 kg', categoria: 'Alimentação', preco: 89.9, disponivel: true },
  { id: 2, nome: 'Brinquedo mordedor', categoria: 'Brinquedos', preco: 24.5, disponivel: true },
  { id: 3, nome: 'Areia sanitária 4 kg', categoria: 'Higiene', preco: 32, disponivel: true },
  { id: 4, nome: 'Shampoo neutro 500 ml', categoria: 'Higiene', preco: 18.9, disponivel: true }
]
