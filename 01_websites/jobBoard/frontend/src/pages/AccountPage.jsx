// "Create an account" page: sign-up form for a visitor.
import { useContext, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { AuthContext } from '../AuthContext'
import { apiFetch } from '../api.js'
import { FIELD_NAMES } from '../fieldNames.js'
import { useLang } from '../lang.js'

// --- Public page: account creation form ---
export default function AccountPage() {
    const { t, lang } = useLang()
    // Form fields, empty at the start.
    const [firstName, setFirstName] = useState('')
    const [surname, setSurname] = useState('')
    const [telephone, setTelephone] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    // errors = one message per faulty field; status drives the button.
    const [errors, setErrors] = useState({})
    const [status, setStatus] = useState('idle')
    const [sendError, setSendError] = useState('')
    const [needLogin, setNeedLogin] = useState(false)
    const { user, setUser } = useContext(AuthContext)
    const navigate = useNavigate()

    // Same delay as the login (LoginPage.jsx) to let the check mark finish drawing before changing page.
    useEffect(() => {
        if (status !== 'sent') return
        const timer = setTimeout(() => navigate('/'), 1150)
        return () => clearTimeout(timer)
    }, [status, navigate])

    const handleSubmit = async (event) => {
        // Prevents the page from reloading when the form is submitted.
        event.preventDefault()
        if (user || status === 'sending' || status === 'sent' || status === 'pending') return
        setSendError('')
        setNeedLogin(false)
        // Client-side checks before sending: one message per field in newErrors.
        const newErrors = {}

        if (firstName.trim() === '') {
            newErrors.firstName = t("Veuillez indiquer votre prénom.", "Please enter your first name.")
            }
        else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(firstName.trim())) {
            newErrors.firstName = t("Votre prénom ne peut contenir que des lettres, des espaces, des tirets ou des apostrophes.", "Your first name can only contain letters, spaces, hyphens or apostrophes.")
        }

        if (surname.trim() === '') {
            newErrors.surname = t("Veuillez indiquer votre nom.", "Please enter your last name.")
            }
        else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(surname.trim())) {
            newErrors.surname = t("Votre nom ne peut contenir que des lettres, des espaces, des tirets ou des apostrophes.", "Your last name can only contain letters, spaces, hyphens or apostrophes.")
        }

        // Phone is optional: checked only if filled in.
        if (telephone.trim() !== '' && !/^\+?[0-9 ]+$/.test(telephone.trim())) {
            newErrors.telephone = t("Votre téléphone ne peut contenir que des chiffres, des espaces et un + au début.", "Your phone number can only contain digits, spaces and a leading +.")
        }

        if (email.trim() === '') {
            newErrors.email = t("Veuillez indiquer votre adresse e-mail.", "Please enter your email address.")
        }
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            newErrors.email = t("Votre adresse e-mail doit ressembler à nom@exemple.fr.", "Your email address must look like name@example.com.")
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


        // The four required fields; the phone is added only if filled in.
        const body = {
            first_name: firstName.trim(),
            last_name: surname.trim(),
            email: email.trim(),
            password: password,
        }
        if (telephone.trim() !== '') {
            body.phone = telephone.trim()
        }

        setSendError('')
        setNeedLogin(false)
        setStatus('sending')

        try {
            const { status: httpStatus, data, error: apiError } = await apiFetch('/api/auth/register', {
                method: 'POST',
                body,
            })

            // 201: account created and session opened by the API; the effect above changes page.
            if (httpStatus === 201) {
                setUser(data)
                setStatus('sent')
                return
            }

            // 202: the address was already registered without an account. Nothing is created until
            // the link sent to that address has been opened: knowing an email address
            // never gives control over somebody else's record.
            if (httpStatus === 202) {
                setStatus('pending')
                return
            }

            // Refusal by the API: the technical detail goes to the console, the candidate reads a message in their language.
            console.error(httpStatus, apiError)
            setStatus('error')

            // One message per API code; 409 suggests logging in.
            if (httpStatus === 409) {
                setSendError(t('Cette adresse e-mail a déjà un compte : connectez-vous.', 'This email address already has an account: log in.'))
                setNeedLogin(true)
            } else if (httpStatus === 400) {
                if (apiError === 'Password must be at least 8 characters') {
                    setSendError(t('Le mot de passe doit contenir au moins 8 caractères.', 'The password must contain at least 8 characters.'))
                } else if (apiError.startsWith('Invalid field: ')) {
                    const field = apiError.replace('Invalid field: ', '')
                    setSendError(t(`Merci de vérifier le champ : ${FIELD_NAMES[lang][field] || 'informations du compte'}.`, `Please check the field: ${FIELD_NAMES[lang][field] || 'account details'}.`))
                } else {
                    setSendError(t('Merci de vérifier les informations du compte.', 'Please check the account details.'))
                }
            } else {
                throw new Error(`Unexpected response ${httpStatus}`)
            }
        } catch (err) {
            // Server stopped, unreadable response or unexpected code.
            console.error(err)
            setStatus('error')
            setSendError(t("Nous n'arrivons pas à créer votre compte pour le moment. Merci de réessayer dans quelques instants.", 'We cannot create your account at the moment. Please try again in a few moments.'))
        }
    }

    // Already logged in: editing the record lives in the candidate area, not here.
    // Except right after sign-up: the check mark stays displayed until the page changes.
    if (user && status !== 'sent') {
        return <Navigate to="/espace-candidat/informations" replace />
    }

    // Same frame as the login (LoginPage.jsx): a title, then the form without a card.
    // form-columns (forms.css): Last name/First name then Phone/Email in pairs, the password alone on its line.
    // Each field is in a div with its error message, so that the pair stays aligned when a message appears.
    // noValidate: the browser's messages are replaced by our own, in the chosen language.
    return (
      <div className="page account-page">
        <h1>{t('Créer un compte', 'Create an account')}</h1>
        <form className="form-columns" onSubmit={handleSubmit} noValidate>

            <div>
                <label>
                    {t('Nom', 'Last name')}
                    <input type="text" name="surname" value={surname} onChange={(e) => setSurname(e.target.value)} />
                </label>
                {errors.surname && <p>{errors.surname}</p>}
            </div>

            <div>
                <label>
                    {t('Prénom', 'First name')}
                    <input type="text" name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </label>
                {errors.firstName && <p>{errors.firstName}</p>}
            </div>

            <div>
                <label>
                    {t('Téléphone (facultatif)', 'Phone number (optional)')}
                    <input type="text" name="telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
                </label>
                {errors.telephone && <p>{errors.telephone}</p>}
            </div>

            <div>
                <label>
                    {t('Adresse e-mail', 'Email address')}
                    <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                {errors.email && <p>{errors.email}</p>}
            </div>

            <div className="field-wide">
                <label>
                    {t('Mot de passe', 'Password')}
                    <input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>
                {errors.password && <p>{errors.password}</p>}
            </div>

            {/* Button locked while sending: spinner, then check mark. */}
            <div className="form-actions">
                <button type="submit" disabled={status === 'sending' || status === 'sent' || status === 'pending'}>
                    {status === 'sending' && <span className="spinner" aria-hidden="true"></span>}
                    {status === 'sent' || status === 'pending' ? (
                        <>
                            <svg className="checkmark" viewBox="0 0 52 52" aria-hidden="true">
                                <path fill="none" stroke="currentColor" strokeWidth="5" d="M14 27 l8 8 l16 -16" />
                            </svg>
                            {status === 'sent' ? t('Compte créé', 'Account created') : t('Lien envoyé', 'Link sent')}
                        </>
                    ) :status === 'sending' ? t('Création en cours…', 'Creating…') : t('Créer un compte', 'Create an account')}
                </button>
            </div>
            <div aria-live="polite">
                {status === 'sent' && (
                    <p>{t('Votre compte est créé et votre session est ouverte.', 'Your account has been created and you are logged in.')}</p>
                )}
                {status === 'pending' && (
                    <p>
                        {t(
                            `Votre adresse est déjà enregistrée chez nous, sans compte. Nous venons d'envoyer un lien de confirmation à ${email.trim()} : votre compte et vos candidatures seront accessibles dès que vous l'aurez ouvert.`,
                            `Your address is already registered with us, without an account. We have just sent a confirmation link to ${email.trim()}: your account and your applications will be available as soon as you open it.`
                        )}
                    </p>
                )}
                {sendError && (
                    <p role="alert">
                        {sendError} {needLogin && <Link to="/login">{t('Se connecter', 'Log in')}</Link>}
                    </p>
                )}
            </div>
        </form>
      </div>
    )
}
