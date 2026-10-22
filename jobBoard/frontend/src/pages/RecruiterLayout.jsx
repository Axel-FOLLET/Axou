// Habillage de l'espace recruteur : ses onglets, puis la sous-page courante.
// Un seul appel vérifie l'accès : 401 → connexion, 403 → pas recruteur ; aucun onglet dans ces deux cas.
import { useContext, useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { AuthContext } from '../AuthContext'
import { apiFetch } from '../api.js'

export default function RecruiterLayout() {
  const { user } = useContext(AuthContext)
  // null tant que le serveur n'a pas répondu, puis le code reçu (200, 401, 403…).
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
        <Link to="/login">Connectez-vous pour accéder à l'espace recruteur.</Link>
      </div>
    )
  }

  if (accessStatus === 403) {
    return (
      <div className="page">
        <p>Cet espace est réservé aux recruteurs. Demandez à l'administration de rattacher votre compte à votre entreprise.</p>
      </div>
    )
  }

  // Rien tant que la vérification n'est pas finie : pas d'onglets qui apparaissent puis disparaissent.
  if (accessStatus === null) return null

  return (
    <div className="page">
      {/* Onglets en pastilles, comme le choix des tables en administration.
          tab-bar (tabs.css) : bande collée sous l'en-tête pendant le défilement. */}
      <div className="tab-bar">
        <nav className="tab-switch" aria-label="Espace recruteur">
          <NavLink to="/recruteur" end>Vue d'ensemble</NavLink>
          <NavLink to="/recruteur/entreprise">Mon entreprise</NavLink>
          <NavLink to="/recruteur/postes">Mes postes</NavLink>
          <NavLink to="/recruteur/nouvelle-offre">Publier une offre</NavLink>
        </nav>
      </div>

      {/* Outlet : la sous-page correspondant à l'URL s'affiche ici. */}
      <Outlet />
    </div>
  )
}
