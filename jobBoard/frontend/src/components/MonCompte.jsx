// Formulaire de modification des informations, affiché à une personne déjà connectée.
import { useContext, useState } from 'react'
import { Link } from 'react-router'
import { AuthContext } from '../AuthContext'
import { apiFetch } from '../api.js'
import { FIELD_NAMES } from '../fieldNames.js'

export default function MonCompte({ user }) {
    // Champs préremplis avec les informations actuelles de la personne.
    const [firstName, setFirstName] = useState(user.first_name)
    const [surname, setSurname] = useState(user.last_name)
    const [telephone, setTelephone] = useState(user.phone ?? '')
    // status pilote le bouton et les messages : idle, sending, sent, nochange, error.
    const [status, setStatus] = useState('idle')
    // sendError = échec de l'enregistrement ; needLogin = session perdue (401).
    const [sendError, setSendError] = useState('')
    const [needLogin, setNeedLogin] = useState(false)
    const { setUser } = useContext(AuthContext)
    // Changement d'adresse : petit formulaire séparé, ouvert par « Changer d'adresse ».
    const [showEmailForm, setShowEmailForm] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [password, setPassword] = useState('')
    // emailStatus : idle, sending, sent, error ; sentTo = adresse à laquelle le lien est parti.
    const [emailStatus, setEmailStatus] = useState('idle')
    const [emailError, setEmailError] = useState('')
    const [sentTo, setSentTo] = useState('')

    // POST /api/auth/email-change : l'adresse ne change qu'après le clic sur le lien reçu à la nouvelle adresse.
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
        // Refus de l'API : le détail technique va dans la console, la personne lit un message en français.
        console.error(httpStatus, apiError)
        setEmailStatus('error')
        if (apiError === 'Invalid credentials') setEmailError('Mot de passe incorrect.')
        else if (apiError === 'Login required') setEmailError("Votre session a expiré. Reconnectez-vous pour changer d'adresse.")
        else if (apiError === 'Invalid value') setEmailError("C'est déjà votre adresse actuelle.")
        else if (apiError === 'Invalid field: email') setEmailError('Adresse e-mail invalide.')
        else if (apiError === 'Invalid field: password') setEmailError('Merci de saisir votre mot de passe actuel.')
        else if (apiError === 'Email already used') setEmailError('Cette adresse est déjà utilisée.')
        else setEmailError("Nous n'arrivons pas à envoyer la demande pour le moment. Merci de réessayer dans quelques instants.")
    }

    const handleSubmit = async (event) => {
        // Empêche le rechargement de la page lors de la soumission du formulaire.
        event.preventDefault()
        if (status === 'sending') return

        // On n'envoie que les champs réellement modifiés : le PATCH reste partiel.
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

        // Aucun champ modifié : on le dit sans appeler l'API.
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

            // 200 : l'API renvoie la fiche à jour, on rafraîchit le contexte pour tout le site.
            if (httpStatus === 200) {
                setUser(data)
                setStatus('sent')
                return
            }

            // Refus de l'API : le détail technique va dans la console, la personne lit un message en français.
            console.error(httpStatus, apiError)
            setStatus('error')

            // Un message français par code de l'API ; 401 ajoute un lien de reconnexion.
            if (httpStatus === 401) {
                setSendError('Votre session a expiré.')
                setNeedLogin(true)
            } else if (httpStatus === 400) {
                if (apiError.startsWith('Invalid field: ')) {
                    const field = apiError.replace('Invalid field: ', '')
                    setSendError(`Merci de vérifier le champ : ${FIELD_NAMES[field] || 'informations du compte'}.`)
                } else {
                    setSendError('Merci de vérifier les informations du compte.')
                }
            } else {
                throw new Error(`Unexpected response ${httpStatus}`)
            }
        } catch (err) {
            // Serveur arrêté, réponse illisible ou code inattendu.
            console.error(err)
            setStatus('error')
            setSendError("Nous n'arrivons pas à enregistrer vos informations pour le moment. Merci de réessayer dans quelques instants.")
        }
    }

    // noValidate : les messages du navigateur sont remplacés par les nôtres, en français.
    // form-columns (forms.css) : Nom/Prénom puis Téléphone/Adresse e-mail, par paires.
    // Deux formulaires l'un sous l'autre : un formulaire ne peut pas en contenir un autre en HTML.
    return (
        <>
        <form className="form-columns" onSubmit={handleSubmit} noValidate>
            <label>
                Nom
                <input type="text" name="surname" value={surname} onChange={(e) => setSurname(e.target.value)} />
            </label>

            <label>
                Prénom
                <input type="text" name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>

            <label>
                Téléphone (facultatif)
                <input type="text" name="telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </label>

            {/* Adresse affichée seulement : l'API refuse de la modifier sans vérification. */}
            <label>
                Adresse e-mail
                <input type="email" name="email" value={user.email} readOnly />
            </label>

            <div className="form-actions">
                <button type="submit" disabled={status === 'sending'}>
                    {status === 'sending' ? 'Enregistrement…' : 'Enregistrer'}
                </button>
            </div>
            {/* aria-live : un lecteur d'écran annonce le résultat sans action de l'utilisateur. */}
            <div aria-live="polite">
                {status === 'sent' && <p>Vos informations sont enregistrées.</p>}
                {status === 'nochange' && <p>Aucune modification à enregistrer.</p>}
                {sendError && (
                    <p role="alert">
                        {sendError} {needLogin && <Link to="/login">Se connecter</Link>}
                    </p>
                )}
            </div>
        </form>

        {/* Changement d'adresse : nouvelle adresse et mot de passe actuel, qui prouve que c'est bien la titulaire du compte. */}
        {!showEmailForm && (
            <p>
                <button type="button" className="button-secondary" onClick={() => { setShowEmailForm(true); setEmailStatus('idle'); setEmailError('') }}>
                    Changer d&apos;adresse
                </button>
            </p>
        )}
        {showEmailForm && (
            <form className="form-columns" onSubmit={handleEmailSubmit} noValidate>
                <label>
                    Nouvelle adresse e-mail
                    <input type="email" name="newEmail" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                </label>

                <label>
                    Mot de passe actuel
                    <input type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>

                <div className="form-actions">
                    <button type="button" className="button-secondary" onClick={() => setShowEmailForm(false)}>Annuler</button>
                    <button type="submit" disabled={emailStatus === 'sending'}>
                        {emailStatus === 'sending' ? 'Envoi…' : "Changer d'adresse"}
                    </button>
                </div>
            </form>
        )}
        <div aria-live="polite">
            {emailStatus === 'sent' && (
                <p>
                    Un lien de confirmation a été envoyé à {sentTo}. Votre adresse actuelle reste active jusqu&apos;à la confirmation.
                </p>
            )}
            {emailError && <p role="alert">{emailError}</p>}
        </div>
        </>
    )
}
