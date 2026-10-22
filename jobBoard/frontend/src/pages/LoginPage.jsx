// Page de connexion : contrôle la saisie, puis POST /api/auth/login.
import { useContext, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthContext } from '../AuthContext'
import { apiFetch } from '../api.js'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // errors = un message par champ fautif ; sendError = l'échec global de l'envoi.
  const [errors, setErrors] = useState({})
  const [sendError, setSendError] = useState('')
  // status pilote le bouton et la redirection : idle, sending, sent, error.
  const [status, setStatus] = useState('idle')
  const [destination, setDestination] = useState(null)
  const { setUser } = useContext(AuthContext)
  const navigate = useNavigate()

  // Même délai que dans Apply pour laisser le V se dessiner avant de changer de page.
  useEffect(() => {
    if (status !== 'sent') return
    const timer = setTimeout(() => navigate(destination), 1150)
    return () => clearTimeout(timer)
  }, [status, destination, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    // Double clic ou renvoi pendant l'attente : on ignore.
    if (status === 'sending' || status === 'sent') return
    setSendError('')
    // Contrôles côté client avant l'envoi : un message par champ dans newErrors.
    const newErrors = {}

    if (email.trim() === '') {
        newErrors.email = "Veuillez indiquer votre adresse e-mail."
    }

    if (password.trim() === '') {
        newErrors.password = "Veuillez indiquer votre mot de passe."
    }
    else if (password.includes(' ')) {
        newErrors.password = "Le mot de passe ne peut pas contenir d'espaces."
    }
    else if (password.length < 8) {
        newErrors.password = "Le mot de passe doit contenir au moins 8 caractères."
    }

    setErrors(newErrors)
      // Au moins une erreur de saisie : rien n'est envoyé au serveur.
      if (Object.keys(newErrors).length > 0) {
          return
      }

    const body = {
        email: email.trim(),
        password: password,
    }
        setSendError('')
        setStatus('sending')

        try {
            const { status: httpStatus, data, error: apiError, retryAfter } = await apiFetch('/api/auth/login', {
                method: 'POST',
                body,
            })

            // 200 : on mémorise l'utilisateur, et l'effet plus haut change de page selon son rôle.
            if (httpStatus === 200) {
                setUser(data)
                setDestination(data.role === 'admin' ? '/admin' : '/')
                setStatus('sent')
                return
            }

            // Refus de l'API : le détail technique va dans la console, le candidat lit un message en français.
            console.error(httpStatus, apiError)
            setStatus('error')

            if (httpStatus === 400) {
                setSendError("Merci de vérifier l'adresse e-mail et le mot de passe.")
            } else if (httpStatus === 401) {
                setSendError('Adresse e-mail ou mot de passe incorrects.')
            } else if (httpStatus === 429) {
                // Trop de tentatives : l'API renvoie l'attente restante dans l'en-tête Retry-After.
                const minutes = retryAfter === null ? null : Math.ceil(retryAfter / 60)
                setSendError(minutes === null
                    ? 'Trop de tentatives de connexion. Merci de réessayer plus tard.'
                    : `Trop de tentatives de connexion. Merci de réessayer dans ${minutes} minute${minutes > 1 ? 's' : ''}.`)
            } else {
                throw new Error(`Unexpected response ${httpStatus}`)
            }
        } catch (err) {
            // Serveur arrêté, réponse illisible ou code inattendu.
            console.error(err)
            setStatus('error')
            setSendError("Nous n'arrivons pas à vous connecter pour le moment. Merci de réessayer dans quelques instants.")
        }
  }

  return (
    <div className="page account-page">
      <h1>Connexion</h1>
      {/* noValidate : les messages du navigateur sont remplacés par les nôtres, en français.
          form-columns (forms.css) : sans carte, comme les autres formulaires ; ici chaque champ prend toute la ligne. */}
      <form className="form-columns" onSubmit={handleSubmit} noValidate>
        <div className="field-wide">
          <label htmlFor="email">Adresse e-mail</label>
          <input
            type="email"
            id="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <p>{errors.email}</p>}
        </div>
        <div className="field-wide">
          <label htmlFor="password">Mot de passe</label>
          <input
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password && <p>{errors.password}</p>}
        </div>
        {/* Bouton verrouillé pendant l'envoi : spinner, puis coche avant la redirection. */}
        <div className="form-actions">
          <button type="submit" disabled={status === 'sending' || status === 'sent'}>
            {status === 'sending' && <span className="spinner" aria-hidden="true"></span>}
            {status === 'sent' ? (
              <>
                <svg className="checkmark" viewBox="0 0 52 52" aria-hidden="true">
                  <path fill="none" stroke="currentColor" strokeWidth="5" d="M14 27 l8 8 l16 -16" />
                </svg>
                Connecté
              </>
            ) : status === 'sending' ? 'Connexion en cours…' : 'Se connecter'}
          </button>
          {sendError && <p role="alert">{sendError}</p>}
        </div>
        {/* aria-live : le lecteur d'écran annonce le succès sans que la coche suffise. */}
        <div aria-live="polite">
          {status === 'sent' && <p className="visually-hidden">Connexion réussie.</p>}
        </div>
      </form>
      <p><Link to="/account">Pas encore de compte ? Créer un compte</Link></p>
    </div>
  )
}
