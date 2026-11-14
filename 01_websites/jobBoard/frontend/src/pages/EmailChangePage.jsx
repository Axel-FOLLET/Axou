// Page opened from the link received at the new address: it confirms the email address change.
// Same model as VerifyPage.jsx, useRef lock included.
import { useContext, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AuthContext } from '../AuthContext'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

export default function EmailChangePage() {
  const { t } = useLang()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  // Truncated link or copied without the token: the state goes straight to the refusal, without a call.
  const [status, setStatus] = useState(token === '' ? 'invalid' : 'checking')
  // The link works only once: this lock prevents the second call of the StrictMode
  // double mount, which would come after the token was consumed and answer 400.
  const started = useRef(false)
  const { setUser } = useContext(AuthContext)

  useEffect(() => {
    // Without a token there is nothing to send to the server; the lock cuts the second call.
    if (token === '' || started.current) {
      return
    }
    started.current = true

    async function confirm() {
      const { status: httpStatus, data } = await apiFetch('/api/auth/email-change/confirm', {
        method: 'POST',
        body: { token },
      })

      if (httpStatus === 200) {
        // Person logged in on this account: the header and "My details" immediately show the new address.
        // Link opened without a session, or on another account: nothing changes on screen.
        setUser((current) => (current && current.id === data.id ? data : current))
        setStatus('done')
      } else if (httpStatus === 409) {
        // The address was taken by another record between the request and the click.
        setStatus('taken')
      } else if (httpStatus === 400) {
        // Unknown, already used or expired token: a single message, as on the server side.
        setStatus('invalid')
      } else {
        // Server unreachable or unexpected response.
        setStatus('error')
      }
    }

    confirm()
  }, [token, setUser])

  return (
    <div className="page">
      <h1>{t("Changement d'adresse e-mail", 'Email address change')}</h1>

      <div aria-live="polite">
        {status === 'checking' && <p>{t('Vérification en cours…', 'Checking…')}</p>}

        {status === 'done' && <p>{t('Votre adresse e-mail a été modifiée.', 'Your email address has been changed.')}</p>}

        {status === 'taken' && (
          <p role="alert">{t('Cette adresse a été prise par un autre compte entre-temps.', 'This address has been taken by another account in the meantime.')}</p>
        )}

        {status === 'invalid' && (
          <p role="alert">
            {t("Ce lien n'est plus valide. Refaites la demande depuis « Mon compte ».", 'This link is no longer valid. Make the request again from "My account".')}{' '}
            <Link to="/espace-candidat/informations">{t('Mon compte', 'My account')}</Link>
          </p>
        )}

        {status === 'error' && (
          <p role="alert">
            {t("Nous n'arrivons pas à confirmer votre adresse pour le moment. Merci de réessayer dans quelques instants.", 'We cannot confirm your address at the moment. Please try again in a few moments.')}
          </p>
        )}
      </div>
    </div>
  )
}
