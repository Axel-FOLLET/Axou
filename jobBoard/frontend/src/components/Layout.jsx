// Habillage commun à toutes les pages : en-tête, navigation, la page courante, puis le pied de page.
import { useContext, useState } from 'react'
import { AuthContext } from '../AuthContext'
import { Outlet, NavLink, Link, useNavigate } from 'react-router'
import { apiFetch } from '../api.js'
import Footer from './Footer.jsx'

export default function Layout() {
  const { user, setUser } = useContext(AuthContext)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  // Déconnexion : on prévient l'API, puis on vide le contexte dans tous les cas.
  async function handleLogout() {
    try {
      const { ok, error: apiError } = await apiFetch('/api/auth/logout', { method: 'POST' })
      if (!ok) {
        throw new Error(apiError)
      }
    } catch (error) {
      console.error('Error logging out:', error)
    }
    // Même si l'appel a échoué, on déconnecte côté navigateur et on revient à l'accueil.
    setUser(null)
    navigate('/')
  }

  return (
    <div>
      <header>
        <nav aria-label="Navigation principale">
          {/* Le logo est le lien vers la page d'accueil : pas de lien « Accueil » dans le menu. */}
          <Link className="logo" to="/" aria-label="Y.I.A Jobs, retour à l'accueil">
            Y.I.A J<span className="logo-o">o</span>bs
          </Link>
          <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="navigation-links" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? 'Fermer le menu' : '☰ Menu'}
          </button>
          <div id="navigation-links" className={`nav-links${menuOpen ? ' is-open' : ''}`} onClick={(event) => {
            if (event.target.closest('a, button')) setMenuOpen(false)
          }} onKeyDown={(event) => {
            if (event.key === 'Escape') setMenuOpen(false)
          }}>
          <NavLink to="/offres">Offres d'emploi</NavLink>
          {/* Navigation selon l'état : visiteur, personne connectée, administration. */}
          {user ? ( 
            <>
              <NavLink to="/recruteur">Espace recruteur</NavLink>
              <NavLink to="/espace-candidat">Espace candidat</NavLink>
              {user.role === 'admin' && <NavLink to="/admin">Administration</NavLink>}
              <button type="button" onClick={handleLogout}>Se déconnecter</button>
            </>
          ) : (
            <NavLink to="/login">Connexion</NavLink>
          )}
          </div>
        </nav>
      </header>
      {/* Outlet : la page correspondant à l'URL s'affiche ici. */}
      <Outlet />
      <Footer />
    </div>
  )
}
