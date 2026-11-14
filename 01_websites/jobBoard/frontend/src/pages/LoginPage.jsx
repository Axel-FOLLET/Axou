// Login page: checks the input, then POST /api/auth/login.
import { useContext, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthContext } from '../AuthContext'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

export default function LoginPage() {
  const { t } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // errors = one message per faulty field; sendError = the overall sending failure.
  const [errors, setErrors] = useState({})
  const [sendError, setSendError] = useState('')
  // status drives the button and the redirection: idle, sending, sent, error.
  const [status, setStatus] = useState('idle')
  const [destination, setDestination] = useState(null)
  const { setUser } = useContext(AuthContext)
  const navigate = useNavigate()

  // Same delay as in Apply to let the check mark finish drawing before changing page.
  useEffect(() => {
    if (status !== 'sent') return
    const timer = setTimeout(() => navigate(destination), 1150)
    return () => clearTimeout(timer)
  }, [status, destination, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    // Double click or resubmission while waiting: ignore.
    if (status === 'sending' || status === 'sent') return
    setSendError('')
    // Client-side checks before sending: one message per field in newErrors.
    const newErrors = {}

    if (email.trim() === '') {
        newErrors.email = t("Veuillez indiquer votre adresse e-mail.", "Please enter your email address.")
    }

    if (password.trim() === '') {
        newErrors.password = t("Veuillez indiquer votre mot de passe.", "Please enter your password.")
    }
    else if (password.includes(' ')) {
        newErrors.password = t("Le mot de passe ne peut pas contenir d'espaces.", "The password cannot contain spaces.")
    }
    else if (password.length < 8) {
        newErrors.password = t("Le mot de passe doit contenir au moins 8 caractères.", "The password must contain at least 8 characters.")
    }

    setErrors(newErrors)
      // At least one input error: nothing is sent to the server.
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

            // 200: remember the user, and the effect above changes page according to their role.
            if (httpStatus === 200) {
                setUser(data)
                setDestination(data.role === 'admin' ? '/admin' : '/')
                setStatus('sent')
                return
            }

            // Refusal by the API: the technical detail goes to the console, the candidate reads a message in their language.
            console.error(httpStatus, apiError)
            setStatus('error')

            if (httpStatus === 400) {
                setSendError(t("Merci de vérifier l'adresse e-mail et le mot de passe.", 'Please check the email address and password.'))
            } else if (httpStatus === 401) {
                setSendError(t('Adresse e-mail ou mot de passe incorrects.', 'Incorrect email address or password.'))
            } else if (httpStatus === 429) {
                // Too many attempts: the API returns the remaining wait in the Retry-After header.
                const minutes = retryAfter === null ? null : Math.ceil(retryAfter / 60)
                setSendError(minutes === null
                    ? t('Trop de tentatives de connexion. Merci de réessayer plus tard.', 'Too many login attempts. Please try again later.')
                    : t(`Trop de tentatives de connexion. Merci de réessayer dans ${minutes} minute${minutes > 1 ? 's' : ''}.`, `Too many login attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`))
            } else {
                throw new Error(`Unexpected response ${httpStatus}`)
            }
        } catch (err) {
            // Server stopped, unreadable response or unexpected code.
            console.error(err)
            setStatus('error')
            setSendError(t("Nous n'arrivons pas à vous connecter pour le moment. Merci de réessayer dans quelques instants.", 'We cannot log you in at the moment. Please try again in a few moments.'))
        }
  }

  return (
    <div className="page account-page">
      <h1>{t('Connexion', 'Log in')}</h1>
      {/* noValidate: the browser's messages are replaced by our own, in the chosen language.
          form-columns (forms.css): without a card, like the other forms; here each field takes the whole line. */}
      <form className="form-columns" onSubmit={handleSubmit} noValidate>
        <div className="field-wide">
          <label htmlFor="email">{t('Adresse e-mail', 'Email address')}</label>
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
          <label htmlFor="password">{t('Mot de passe', 'Password')}</label>
          <input
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password && <p>{errors.password}</p>}
        </div>
        {/* Button locked while sending: spinner, then check mark before the redirection. */}
        <div className="form-actions">
          <button type="submit" disabled={status === 'sending' || status === 'sent'}>
            {status === 'sending' && <span className="spinner" aria-hidden="true"></span>}
            {status === 'sent' ? (
              <>
                <svg className="checkmark" viewBox="0 0 52 52" aria-hidden="true">
                  <path fill="none" stroke="currentColor" strokeWidth="5" d="M14 27 l8 8 l16 -16" />
                </svg>
                {t('Connecté', 'Logged in')}
              </>
            ) : status === 'sending' ? t('Connexion en cours…', 'Logging in…') : t('Se connecter', 'Log in')}
          </button>
          {sendError && <p role="alert">{sendError}</p>}
        </div>
        {/* aria-live: the screen reader announces the success, the check mark alone is not enough. */}
        <div aria-live="polite">
          {status === 'sent' && <p className="visually-hidden">{t('Connexion réussie.', 'Logged in successfully.')}</p>}
        </div>
      </form>
      <p><Link to="/account">{t('Pas encore de compte ? Créer un compte', 'No account yet? Create an account')}</Link></p>
    </div>
  )
}
