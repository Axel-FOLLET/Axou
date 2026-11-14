// Form to edit the account details, shown to an already logged-in person.
import { useContext, useState } from 'react'
import { Link } from 'react-router'
import { AuthContext } from '../AuthContext'
import { apiFetch } from '../api.js'
import { FIELD_NAMES } from '../fieldNames.js'
import { useLang } from '../lang.js'

export default function MyAccount({ user }) {
    const { t, lang } = useLang()
    // Fields prefilled with the person's current details.
    const [firstName, setFirstName] = useState(user.first_name)
    const [surname, setSurname] = useState(user.last_name)
    const [telephone, setTelephone] = useState(user.phone ?? '')
    // status drives the button and the messages: idle, sending, sent, nochange, error.
    const [status, setStatus] = useState('idle')
    // sendError = saving failed; needLogin = session lost (401).
    const [sendError, setSendError] = useState('')
    const [needLogin, setNeedLogin] = useState(false)
    const { setUser } = useContext(AuthContext)
    // Email change: a small separate form, opened by the "Change email address" button.
    const [showEmailForm, setShowEmailForm] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [password, setPassword] = useState('')
    // emailStatus: idle, sending, sent, error; sentTo = address the link was sent to.
    const [emailStatus, setEmailStatus] = useState('idle')
    const [emailError, setEmailError] = useState('')
    const [sentTo, setSentTo] = useState('')

    // POST /api/auth/email-change: the address only changes after the link received at the new address is clicked.
    const handleEmailSubmit = async (event) => {
        event.preventDefault()
        if (emailStatus === 'sending') return
        const address = newEmail.trim()
        setEmailError('')
        setEmailStatus('sending')
        const { status: httpStatus, error: apiError } = await apiFetch('/api/auth/email-change', {
            method: 'POST',
            body: { email: address, password },
        })
        if (httpStatus === 202) {
            setSentTo(address)
            setEmailStatus('sent')
            setShowEmailForm(false)
            setNewEmail('')
            setPassword('')
            return
        }
        // Refusal by the API: the technical detail goes to the console, the person reads a message in their language.
        console.error(httpStatus, apiError)
        setEmailStatus('error')
        if (apiError === 'Invalid credentials') setEmailError(t('Mot de passe incorrect.', 'Incorrect password.'))
        else if (apiError === 'Login required') setEmailError(t("Votre session a expiré. Reconnectez-vous pour changer d'adresse.", 'Your session has expired. Log in again to change your email address.'))
        else if (apiError === 'Invalid value') setEmailError(t("C'est déjà votre adresse actuelle.", 'This is already your current email address.'))
        else if (apiError === 'Invalid field: email') setEmailError(t('Adresse e-mail invalide.', 'Invalid email address.'))
        else if (apiError === 'Invalid field: password') setEmailError(t('Merci de saisir votre mot de passe actuel.', 'Please enter your current password.'))
        else if (apiError === 'Email already used') setEmailError(t('Cette adresse est déjà utilisée.', 'This email address is already in use.'))
        else setEmailError(t("Nous n'arrivons pas à envoyer la demande pour le moment. Merci de réessayer dans quelques instants.", 'We are unable to send the request at the moment. Please try again in a few moments.'))
    }

    const handleSubmit = async (event) => {
        // Prevents the page from reloading when the form is submitted.
        event.preventDefault()
        if (status === 'sending') return

        // Only the fields that were really modified are sent: the PATCH stays partial.
        const body = {}
        if (firstName.trim() !== user.first_name) {
            body.first_name = firstName.trim()
        }
        if (surname.trim() !== user.last_name) {
            body.last_name = surname.trim()
        }
        if (telephone.trim() !== (user.phone ?? '')) {
            body.phone = telephone.trim()
        }

        setSendError('')
        setNeedLogin(false)

        // No field modified: say so without calling the API.
        if (Object.keys(body).length === 0) {
            setStatus('nochange')
            return
        }

        setStatus('sending')

        try {
            const { status: httpStatus, data, error: apiError } = await apiFetch('/api/auth/me', {
                method: 'PATCH',
                body,
            })

            // 200: the API returns the updated record, refresh the context for the whole site.
            if (httpStatus === 200) {
                setUser(data)
                setStatus('sent')
                return
            }

            // Refusal by the API: the technical detail goes to the console, the person reads a message in their language.
            console.error(httpStatus, apiError)
            setStatus('error')

            // One message per API code; 401 adds a link to log in again.
            if (httpStatus === 401) {
                setSendError(t('Votre session a expiré.', 'Your session has expired.'))
                setNeedLogin(true)
            } else if (httpStatus === 400) {
                if (apiError.startsWith('Invalid field: ')) {
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
            setSendError(t("Nous n'arrivons pas à enregistrer vos informations pour le moment. Merci de réessayer dans quelques instants.", 'We are unable to save your details at the moment. Please try again in a few moments.'))
        }
    }

    // noValidate: the browser's messages are replaced by our own, in the chosen language.
    // form-columns (forms.css): Last name/First name then Phone/Email address, in pairs.
    // Two forms one under the other: HTML does not allow a form inside another.
    return (
        <>
        <form className="form-columns" onSubmit={handleSubmit} noValidate>
            <label>
                {t('Nom', 'Last name')}
                <input type="text" name="surname" value={surname} onChange={(e) => setSurname(e.target.value)} />
            </label>

            <label>
                {t('Prénom', 'First name')}
                <input type="text" name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>

            <label>
                {t('Téléphone (facultatif)', 'Phone number (optional)')}
                <input type="text" name="telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </label>

            {/* Address shown only: the API refuses to change it without verification. */}
            <label>
                {t('Adresse e-mail', 'Email address')}
                <input type="email" name="email" value={user.email} readOnly />
            </label>

            <div className="form-actions">
                <button type="submit" disabled={status === 'sending'}>
                    {status === 'sending' ? t('Enregistrement…', 'Saving…') : t('Enregistrer', 'Save')}
                </button>
            </div>
            {/* aria-live: a screen reader announces the result without any user action. */}
            <div aria-live="polite">
                {status === 'sent' && <p>{t('Vos informations sont enregistrées.', 'Your details have been saved.')}</p>}
                {status === 'nochange' && <p>{t('Aucune modification à enregistrer.', 'No changes to save.')}</p>}
                {sendError && (
                    <p role="alert">
                        {sendError} {needLogin && <Link to="/login">{t('Se connecter', 'Log in')}</Link>}
                    </p>
                )}
            </div>
        </form>

        {/* Email change: new address and current password, which proves that the person is the account holder. */}
        {!showEmailForm && (
            <p>
                <button type="button" className="button-secondary" onClick={() => { setShowEmailForm(true); setEmailStatus('idle'); setEmailError('') }}>
                    {t("Changer d'adresse", 'Change email address')}
                </button>
            </p>
        )}
        {showEmailForm && (
            <form className="form-columns" onSubmit={handleEmailSubmit} noValidate>
                <label>
                    {t('Nouvelle adresse e-mail', 'New email address')}
                    <input type="email" name="newEmail" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                </label>

                <label>
                    {t('Mot de passe actuel', 'Current password')}
                    <input type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>

                <div className="form-actions">
                    <button type="button" className="button-secondary" onClick={() => setShowEmailForm(false)}>{t('Annuler', 'Cancel')}</button>
                    <button type="submit" disabled={emailStatus === 'sending'}>
                        {emailStatus === 'sending' ? t('Envoi…', 'Sending…') : t("Changer d'adresse", 'Change email address')}
                    </button>
                </div>
            </form>
        )}
        <div aria-live="polite">
            {emailStatus === 'sent' && (
                <p>
                    {t(`Un lien de confirmation a été envoyé à ${sentTo}. Votre adresse actuelle reste active jusqu'à la confirmation.`, `A confirmation link has been sent to ${sentTo}. Your current email address remains active until you confirm.`)}
                </p>
            )}
            {emailError && <p role="alert">{emailError}</p>}
        </div>
        </>
    )
}
