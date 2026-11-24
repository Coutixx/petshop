import 'bootstrap/dist/css/bootstrap.min.css'
import { iniciarCatalogo } from '../catalogo'
import { ProdutoRepositoryLocal } from '../../../../../shared/domain/produtos/produto-repository-local'
import { ProdutoService } from '../../../../../shared/domain/produtos/produto-service'
import { produtosDemo } from '../../../../../shared/domain/produtos/produtos-demo'
import { CotacaoService } from '../../../../../shared/domain/produtos/cotacao-service'

try {
  const service = new ProdutoService(new ProdutoRepositoryLocal(produtosDemo, localStorage))
  const cambio = new CotacaoService()
  const catalogo = iniciarCatalogo({
    listarCatalogo: async () => service.listar(),
    criarProduto: async input => { service.criar(input) },
    atualizarProduto: async (id, input) => { service.atualizar(id, input) },
    excluirProduto: async id => service.excluir(id),
    atualizarCotacao: () => cambio.atualizar()
  })
  document.querySelectorAll<HTMLButtonElement>('[data-screen]').forEach(button => {
    button.addEventListener('click', () => catalogo.mostrar(button.dataset.screen!, true))
  })
  catalogo.mostrar('dashboard', true)
} catch {
  document.getElementById('clients-view')!.textContent = 'Não foi possível abrir o catálogo local. Os dados salvos foram preservados.'
}
