// Entry point: mounts the React application in the #root div of index.html.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import './styles/index.css'
import App from './App.jsx'
import AuthProvider from './AuthProvider.jsx'
import LangProvider from './LangProvider.jsx'


// The providers wrap App: language, router, then the logged-in user,
// so that every page can read all three.
createRoot(document.getElementById('root')).render(
  // StrictMode: in development, React mounts components twice
  // to spot effects that are not cleaned up. A double network call is normal here.
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
