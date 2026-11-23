import 'bootstrap/dist/css/bootstrap.min.css'
import { iniciarCatalogo } from '../catalogo'

iniciarCatalogo().atualizarSessao(false)
document.getElementById('demo-catalog')?.click()
