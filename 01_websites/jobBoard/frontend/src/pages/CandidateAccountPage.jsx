// "My details" tab of the candidate area: the account editing form, then the saved CV.
import { useContext } from 'react'
import { Link } from 'react-router'
import { AuthContext } from '../AuthContext'
import MyAccount from '../components/MyAccount.jsx'
import MyCv from '../components/MyCv.jsx'
import { useLang } from '../lang.js'

export default function CandidateAccountPage() {
  const { user } = useContext(AuthContext)
  const { t } = useLang()

  // user at null = visitor not logged in: MyAccount needs the record to prefill its fields.
  if (!user) {
    return <Link to="/login">{t('Connectez-vous pour modifier vos informations.', 'Log in to edit your details.')}</Link>
  }

  return (
    <>
      <h1>{t('Mes informations', 'My details')}</h1>
      <MyAccount user={user} />
      <MyCv />
    </>
  )
}
