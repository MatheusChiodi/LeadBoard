import { Link } from 'react-router-dom'

/**
 * Tela das ferramentas ainda não portadas.
 *
 * A entrada continua no catálogo, e não escondida, porque esconder faria a lista
 * mentir sobre o que o produto vai ter. Melhor dizer "ainda não" do que abrir uma
 * página em branco ou sumir com a ferramenta.
 */
export default function EmBreve() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-text">Ferramenta em migração</h1>
      <p className="text-sm text-text-muted">
        A lógica desta ferramenta ainda está sendo portada do projeto de origem. As demais do
        catálogo já funcionam.
      </p>
      <Link
        to="/ferramentas"
        className="text-sm text-accent underline-offset-4 hover:underline"
      >
        Ver as ferramentas disponíveis
      </Link>
    </section>
  )
}
