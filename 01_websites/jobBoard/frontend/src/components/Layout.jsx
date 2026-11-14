// Common frame of all pages: header, navigation, the current page, then the footer.
import { useContext, useState } from 'react'
import { AuthContext } from '../AuthContext'
import { Outlet, NavLink, Link, useNavigate } from 'react-router'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'
import Footer from './Footer.jsx'

export default function Layout() {
  const { user, setUser } = useContext(AuthContext)
  const { lang, setLang, t } = useLang()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  // Logout: tell the API, then clear the context in all cases.
  async function handleLogout() {
    try {
      const { ok, error: apiError } = await apiFetch('/api/auth/logout', { method: 'POST' })
      if (!ok) {
        throw new Error(apiError)
      }
    } catch (error) {
      console.error('Error logging out:', error)
    }
    // Even if the call failed, log out on the browser side and return to the home page.
    setUser(null)
    navigate('/')
  }

  return (
    <div>
      <header>
        <nav aria-label={t('Navigation principale', 'Main navigation')}>
          {/* The logo is the link to the home page: no "Home" link in the menu. */}
          <Link className="logo" to="/" aria-label={t("Y.I.A Jobs, retour à l'accueil", 'Y.I.A Jobs, back to the home page')}>
            Y.I.A J<span className="logo-o">o</span>bs
          </Link>
          <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="navigation-links" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? t('Fermer le menu', 'Close menu') : '☰ Menu'}
          </button>
          <div id="navigation-links" className={`nav-links${menuOpen ? ' is-open' : ''}`} onClick={(event) => {
            if (event.target.closest('a, button')) setMenuOpen(false)
          }} onKeyDown={(event) => {
            if (event.key === 'Escape') setMenuOpen(false)
          }}>
          <NavLink to="/offres">{t("Offres d'emploi", 'Job offers')}</NavLink>
          {/* Navigation depending on the state: visitor, logged-in person, administration. */}
          {user ? ( 
            <>
              <NavLink to="/recruteur">{t('Espace recruteur', 'Recruiter area')}</NavLink>
              <NavLink to="/espace-candidat">{t('Espace candidat', 'Candidate area')}</NavLink>
              {user.role === 'admin' && <NavLink to="/admin">{t('Administration', 'Admin')}</NavLink>}
              <button type="button" onClick={handleLogout}>{t('Se déconnecter', 'Log out')}</button>
            </>
          ) : (
            <NavLink to="/login">{t('Connexion', 'Log in')}</NavLink>
          )}
          {/* Language button: it shows the language offered, written in that language. */}
          <button type="button" lang={lang === 'en' ? 'fr' : 'en'} onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}>
            {lang === 'en' ? 'Français' : 'English'}
          </button>
          </div>
        </nav>
      </header>
      {/* Outlet: the page matching the URL is displayed here. */}
      <Outlet />
      <Footer />
    </div>
  )
}
