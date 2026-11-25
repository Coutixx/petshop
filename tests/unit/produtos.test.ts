import { describe, expect, it } from 'vitest'
import { ProdutoRepositoryLocal, type CatalogoStorage } from '../../src/shared/domain/produtos/produto-repository-local'
import { ProdutoService } from '../../src/shared/domain/produtos/produto-service'
import type { ProdutoInput } from '../../src/shared/domain/produtos/produto'

const input: ProdutoInput = { nome: ' Ração ', categoria: 'Alimentação', moeda: 'BRL', preco: 35.9, importado: false, estoque: 10 }

describe('catálogo local', () => {
  it('cadastra, lista, edita e exclui sem expor referências mutáveis', () => {
    const service = new ProdutoService(new ProdutoRepositoryLocal())
    const produto = service.criar(input)
    expect(produto.nome).toBe('Ração')
    produto.nome = 'Alterado externamente'
    service.listar()[0].estoque = 999
    expect(service.obter(produto.id)).toMatchObject({ nome: 'Ração', estoque: 10 })
    service.atualizar(produto.id, { ...input, nome: 'Ração premium' })
    expect(service.listar()).toHaveLength(1)
    expect(service.obter(produto.id).nome).toBe('Ração premium')
    service.excluir(produto.id)
    expect(service.listar()).toEqual([])
    expect(() => service.atualizar(produto.id, input)).toThrow('não encontrado')
    expect(() => service.excluir(produto.id)).toThrow('não encontrado')
  })

  it('mantém o catálogo salvo entre instâncias e não recria os exemplos após exclusão', () => {
    const dados = new Map<string, string>()
    const storage: CatalogoStorage = { getItem: (key) => dados.get(key) ?? null, setItem: (key, value) => { dados.set(key, value) } }
    const service = new ProdutoService(new ProdutoRepositoryLocal([], storage))
    const produto = service.criar(input)
    expect(new ProdutoRepositoryLocal([], storage).listar()).toEqual(service.listar())
    service.excluir(produto.id)
    expect(new ProdutoRepositoryLocal([{ ...input, id: 10 }], storage).listar()).toEqual([])
  })

  it('preserva os dados se o armazenamento estiver corrompido ou não puder gravar', () => {
    const storage = { getItem: () => '{quebrado', setItem: () => { throw new Error('Sem espaço') } }
    expect(() => new ProdutoRepositoryLocal([], storage)).toThrow()
    const repository = new ProdutoRepositoryLocal([{ ...input, id: 1 }], { ...storage, getItem: () => null })
    const service = new ProdutoService(repository)
    expect(() => service.atualizarEstoque(1, 0)).toThrow('Sem espaço')
    expect(service.obter(1).estoque).toBe(10)
    expect(() => service.excluir(1)).toThrow('Sem espaço')
    expect(service.listar()).toHaveLength(1)
  })

  it('recusa identificadores duplicados nos dados carregados', () => {
    expect(() => new ProdutoRepositoryLocal([{ ...input, id: 1 }, { ...input, id: 1 }])).toThrow('duplicado')
  })
})
