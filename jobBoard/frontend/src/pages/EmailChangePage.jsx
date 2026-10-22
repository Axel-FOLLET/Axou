// Page ouverte depuis le lien reçu à la nouvelle adresse : elle confirme le changement d'adresse e-mail.
// Même modèle que VerifyPage.jsx, verrou useRef compris.
import { useContext, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AuthContext } from '../AuthContext'
import { apiFetch } from '../api.js'

export default function EmailChangePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  // Lien tronqué ou recopié sans le jeton : l'état part directement sur le refus, sans appel.
  const [status, setStatus] = useState(token === '' ? 'invalid' : 'checking')
  // Le lien ne sert qu'une fois : ce verrou empêche le second appel du double montage
  // de StrictMode, qui arriverait après la consommation du jeton et répondrait 400.
  const started = useRef(false)
  const { setUser } = useContext(AuthContext)

  useEffect(() => {
    // Sans jeton, il n'y a rien à envoyer au serveur ; le verrou coupe le second appel.
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
        // Personne connectée sur ce compte : l'en-tête et « Mes informations » affichent tout de suite la nouvelle adresse.
        // Lien ouvert sans session, ou sur un autre compte : rien ne change à l'écran.
        setUser((current) => (current && current.id === data.id ? data : current))
        setStatus('done')
      } else if (httpStatus === 409) {
        // L'adresse a été prise par une autre fiche entre la demande et le clic.
        setStatus('taken')
      } else if (httpStatus === 400) {
        // Jeton inconnu, déjà utilisé ou périmé : un seul message, comme côté serveur.
        setStatus('invalid')
      } else {
        // Serveur injoignable ou réponse inattendue.
        setStatus('error')
      }
    }

    confirm()
  }, [token, setUser])

  return (
    <div className="page">
      <h1>Changement d&apos;adresse e-mail</h1>

      <div aria-live="polite">
        {status === 'checking' && <p>Vérification en cours…</p>}

        {status === 'done' && <p>Votre adresse e-mail a été modifiée.</p>}

        {status === 'taken' && (
          <p role="alert">Cette adresse a été prise par un autre compte entre-temps.</p>
        )}

        {status === 'invalid' && (
          <p role="alert">
            Ce lien n&apos;est plus valide. Refaites la demande depuis « Mon compte ».{' '}
            <Link to="/espace-candidat/informations">Mon compte</Link>
          </p>
        )}

        {status === 'error' && (
          <p role="alert">
            Nous n&apos;arrivons pas à confirmer votre adresse pour le moment. Merci de réessayer dans quelques instants.
          </p>
        )}
      </div>
    </div>
  )
}
