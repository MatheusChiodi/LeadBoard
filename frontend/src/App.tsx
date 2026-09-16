import { BrowserRouter, Link } from 'react-router-dom'

import { AppRoutes } from './core/router/routes'

/**
 * Casca da aplicação.
 *
 * Temporária: pela seção 6 o LeadBoard usa o shell de janelas do Focus como
 * casca do produto inteiro, com Tools, Draw e Focus virando janelas dentro dele.
 * Até o shell existir, uma navegação simples mantém o produto usável.
 */
export function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-surface text-text">
        <header className="border-b border-border">
          <nav className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-3">
            <Link to="/" className="text-sm font-bold text-text">
              Lead<span className="text-accent">Board</span>
            </Link>
            <Link
              to="/ferramentas"
              className="text-sm text-text-muted transition hover:text-accent"
            >
              Ferramentas
            </Link>
          </nav>
        </header>

        <main className="flex-1">
          <AppRoutes />
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
