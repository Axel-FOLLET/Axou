// Habillage de l'espace candidat : ses deux onglets, puis la sous-page courante.
import { NavLink, Outlet } from 'react-router'

export default function CandidateLayout() {
  return (
    <div className="page">
      {/* Onglets en pastilles, comme le choix des tables en administration.
          tab-bar (tabs.css) : bande collée sous l'en-tête pendant le défilement. */}
      <div className="tab-bar">
        <nav className="tab-switch" aria-label="Espace candidat">
          <NavLink to="/espace-candidat" end>Mes candidatures</NavLink>
          <NavLink to="/espace-candidat/informations">Mes informations</NavLink>
        </nav>
      </div>

      {/* Outlet : la sous-page correspondant à l'URL s'affiche ici. */}
      <Outlet />
    </div>
  )
}
