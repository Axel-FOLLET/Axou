// Page ouverte depuis le lien reçu par email : elle confirme l'adresse, puis renvoie vers la connexion.
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { apiFetch } from '../api.js'

export default function VerifyPage() {
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
      <h1>Confirmation de votre adresse</h1>

      <div aria-live="polite">
        {status === 'checking' && <p>Vérification en cours…</p>}

        {status === 'done' && (
          <p>
            Votre adresse est confirmée et votre compte est prêt. Vos candidatures vous
            attendent dans votre espace candidat. <Link to="/login">Se connecter</Link>
          </p>
        )}

        {status === 'already' && (
          <p>
            Cette adresse a déjà un compte : ce lien n&apos;est plus utile.{' '}
            <Link to="/login">Se connecter</Link>
          </p>
        )}

        {status === 'invalid' && (
          <p role="alert">
            Ce lien n&apos;est plus valable : il a déjà servi, ou il a plus de 24 heures.
            Recommencez la création de votre compte pour recevoir un nouveau lien.{' '}
            <Link to="/account">Créer un compte</Link>
          </p>
        )}
      </div>
    </div>
  )
}
