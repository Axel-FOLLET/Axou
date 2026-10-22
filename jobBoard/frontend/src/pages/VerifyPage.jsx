// Page ouverte depuis le lien reçu par email : elle confirme l'adresse, puis renvoie vers la connexion.
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

export default function VerifyPage() {
  const { t } = useLang()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  // Lien tronqué ou recopié sans le jeton : l'état part directement sur le refus, sans appel.
  const [status, setStatus] = useState(token === '' ? 'invalid' : 'checking')
  // Le lien ne sert qu'une fois : ce verrou empêche le second appel du double montage
  // de StrictMode, qui arriverait après la consommation du jeton et afficherait un refus.
  const started = useRef(false)

  useEffect(() => {
    // Sans jeton, il n'y a rien à envoyer au serveur ; le verrou coupe le second appel.
    if (token === '' || started.current) {
      return
    }
    started.current = true

    async function verify() {
      const { status: httpStatus } = await apiFetch('/api/auth/verify', {
        method: 'POST',
        body: { token },
      })

      if (httpStatus === 200) {
        setStatus('done')
      } else if (httpStatus === 409) {
        // La fiche a déjà un compte : le lien n'a plus d'objet.
        setStatus('already')
      } else {
        // Jeton inconnu, déjà utilisé ou périmé : un seul message, comme côté serveur.
        setStatus('invalid')
      }
    }

    verify()
  }, [token])

  return (
    <div className="page">
      <h1>{t('Confirmation de votre adresse', 'Confirming your address')}</h1>

      <div aria-live="polite">
        {status === 'checking' && <p>{t('Vérification en cours…', 'Checking…')}</p>}

        {status === 'done' && (
          <p>
            {t('Votre adresse est confirmée et votre compte est prêt. Vos candidatures vous attendent dans votre espace candidat.', 'Your address is confirmed and your account is ready. Your applications are waiting for you in your candidate area.')}{' '}
            <Link to="/login">{t('Se connecter', 'Log in')}</Link>
          </p>
        )}

        {status === 'already' && (
          <p>
            {t("Cette adresse a déjà un compte : ce lien n'est plus utile.", 'This address already has an account: this link is no longer needed.')}{' '}
            <Link to="/login">{t('Se connecter', 'Log in')}</Link>
          </p>
        )}

        {status === 'invalid' && (
          <p role="alert">
            {t("Ce lien n'est plus valable : il a déjà servi, ou il a plus de 24 heures. Recommencez la création de votre compte pour recevoir un nouveau lien.", 'This link is no longer valid: it has already been used, or it is more than 24 hours old. Create your account again to receive a new link.')}{' '}
            <Link to="/account">{t('Créer un compte', 'Create an account')}</Link>
          </p>
        )}
      </div>
    </div>
  )
}
