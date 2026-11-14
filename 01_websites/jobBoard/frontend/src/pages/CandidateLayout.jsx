// Layout of the candidate area: its two tabs, then the current sub-page.
import { NavLink, Outlet } from 'react-router'
import { useLang } from '../lang.js'

export default function CandidateLayout() {
  const { t } = useLang()

  return (
    <div className="page">
      {/* Tabs as pills, like the table choice in administration.
          tab-bar (tabs.css): strip stuck under the header while scrolling. */}
      <div className="tab-bar">
        <nav className="tab-switch" aria-label={t('Espace candidat', 'Candidate area')}>
          <NavLink to="/espace-candidat" end>{t('Mes candidatures', 'My applications')}</NavLink>
          <NavLink to="/espace-candidat/informations">{t('Mes informations', 'My details')}</NavLink>
        </nav>
      </div>

      {/* Outlet: the sub-page matching the URL is displayed here. */}
      <Outlet />
    </div>
  )
}
