// Point d'entrée : monte l'application React dans la div #root de index.html.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import './styles/index.css'
import App from './App.jsx'
import AuthProvider from './AuthProvider.jsx'
import LangProvider from './LangProvider.jsx'


// Les fournisseurs enveloppent App : la langue, le routeur, puis l'utilisateur connecté,
// pour que chaque page puisse lire les trois.
createRoot(document.getElementById('root')).render(
  // StrictMode : en développement, React monte les composants deux fois
  // pour repérer les effets mal nettoyés. Un double appel réseau est normal ici.
  <StrictMode>
    <LangProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </LangProvider>
  </StrictMode>,
)
