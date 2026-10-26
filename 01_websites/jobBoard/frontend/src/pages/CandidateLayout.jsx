// Habillage de l'espace candidat : ses deux onglets, puis la sous-page courante.
import { NavLink, Outlet } from 'react-router'
import { useLang } from '../lang.js'

export default function CandidateLayout() {
  const { t } = useLang()

  return (
    <div className="page">
      {/* Onglets en pastilles, comme le choix des tables en administration.
          tab-bar (tabs.css) : bande collée sous l'en-tête pendant le défilement. */}
      <div className="tab-bar">
        <nav className="tab-switch" aria-label={t('Espace candidat', 'Candidate area')}>
          <NavLink to="/espace-candidat" end>{t('Mes candidatures', 'My applications')}</NavLink>
          <NavLink to="/espace-candidat/informations">{t('Mes informations', 'My details')}</NavLink>
        </nav>
      </div>

      {/* Outlet : la sous-page correspondant à l'URL s'affiche ici. */}
      <Outlet />
    </div>
  )
}
