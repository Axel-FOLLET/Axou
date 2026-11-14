// Layout of the recruiter area: its tabs, then the current sub-page.
// A single call checks access: 401 → login, 403 → not a recruiter; no tabs in these two cases.
import { useContext, useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { AuthContext } from '../AuthContext'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

export default function RecruiterLayout() {
  const { user } = useContext(AuthContext)
  const { t } = useLang()
  // null until the server has answered, then the code received (200, 401, 403…).
  const [accessStatus, setAccessStatus] = useState(null)

  useEffect(() => {
    if (user === null) return
    async function checkAccess() {
      const { status, error } = await apiFetch('/api/recruiter/company')
      setAccessStatus(status)
      if (status === 401 || status === 403) console.error('Recruiter access refused:', status, error)
    }
    checkAccess()
  }, [user])

  if (user === null || accessStatus === 401) {
    return (
      <div className="page">
        <Link to="/login">{t("Connectez-vous pour accéder à l'espace recruteur.", 'Log in to access the recruiter area.')}</Link>
      </div>
    )
  }

  if (accessStatus === 403) {
    return (
      <div className="page">
        <p>{t("Cet espace est réservé aux recruteurs. Demandez à l'administration de rattacher votre compte à votre entreprise.", 'This area is reserved for recruiters. Ask the administrators to link your account to your company.')}</p>
      </div>
    )
  }

  // Nothing until the check is finished: no tabs that appear then disappear.
  if (accessStatus === null) return null

  return (
    <div className="page">
      {/* Tabs as pills, like the table choice in administration.
          tab-bar (tabs.css): strip stuck under the header while scrolling. */}
      <div className="tab-bar">
        <nav className="tab-switch" aria-label={t('Espace recruteur', 'Recruiter area')}>
          <NavLink to="/recruteur" end>{t("Vue d'ensemble", 'Overview')}</NavLink>
          <NavLink to="/recruteur/entreprise">{t('Mon entreprise', 'My company')}</NavLink>
          <NavLink to="/recruteur/postes">{t('Mes postes', 'My positions')}</NavLink>
          <NavLink to="/recruteur/nouvelle-offre">{t('Publier une offre', 'Post a job offer')}</NavLink>
        </nav>
      </div>

      {/* Outlet: the sub-page matching the URL is displayed here. */}
      <Outlet />
    </div>
  )
}
