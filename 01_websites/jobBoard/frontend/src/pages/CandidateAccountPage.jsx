// Onglet « Mes informations » de l'espace candidat : le formulaire de modification du compte, puis le CV enregistré.
import { useContext } from 'react'
import { Link } from 'react-router'
import { AuthContext } from '../AuthContext'
import MonCompte from '../components/MonCompte.jsx'
import MonCv from '../components/MonCv.jsx'
import { useLang } from '../lang.js'

export default function CandidateAccountPage() {
  const { user } = useContext(AuthContext)
  const { t } = useLang()

  // user à null = visiteur non connecté : MonCompte a besoin de la fiche pour préremplir ses champs.
  if (!user) {
    return <Link to="/login">{t('Connectez-vous pour modifier vos informations.', 'Log in to edit your details.')}</Link>
  }

  return (
    <>
      <h1>{t('Mes informations', 'My details')}</h1>
      <MonCompte user={user} />
      <MonCv />
    </>
  )
}
