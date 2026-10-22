// Page « Créer un compte » : formulaire d'inscription pour un visiteur.
import { useContext, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { AuthContext } from '../AuthContext'
import { apiFetch } from '../api.js'
import { FIELD_NAMES } from '../fieldNames.js'

// --- Page publique : formulaire de création de compte ---
export default function AccountPage() {
    // Champs du formulaire, vides au départ.
    const [firstName, setFirstName] = useState('')
    const [surname, setSurname] = useState('')
    const [telephone, setTelephone] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    // errors = un message par champ fautif ; status pilote le bouton.
    const [errors, setErrors] = useState({})
    const [status, setStatus] = useState('idle')
    const [sendError, setSendError] = useState('')
    const [needLogin, setNeedLogin] = useState(false)
    const { user, setUser } = useContext(AuthContext)
    const navigate = useNavigate()

    // Même délai que la connexion (LoginPage.jsx) pour laisser le V se dessiner avant de changer de page.
    useEffect(() => {
        if (status !== 'sent') return
        const timer = setTimeout(() => navigate('/'), 1150)
        return () => clearTimeout(timer)
    }, [status, navigate])

    const handleSubmit = async (event) => {
        // Empêche le rechargement de la page lors de la soumission du formulaire.
        event.preventDefault()
        if (user || status === 'sending' || status === 'sent' || status === 'pending') return
        setSendError('')
        setNeedLogin(false)
        // Contrôles côté client avant l'envoi : un message par champ dans newErrors.
        const newErrors = {}

        if (firstName.trim() === '') {
            newErrors.firstName = "Veuillez indiquer votre prénom."
            }
        else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(firstName.trim())) {
            newErrors.firstName = "Votre prénom ne peut contenir que des lettres, des espaces, des tirets ou des apostrophes."
        }

        if (surname.trim() === '') {
            newErrors.surname = "Veuillez indiquer votre nom."
            } 
        else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(surname.trim())) {
            newErrors.surname = "Votre nom ne peut contenir que des lettres, des espaces, des tirets ou des apostrophes."  
        }

        // Téléphone facultatif : contrôlé seulement s'il est rempli.
        if (telephone.trim() !== '' && !/^\+?[0-9 ]+$/.test(telephone.trim())) {
            newErrors.telephone = "Votre téléphone ne peut contenir que des chiffres, des espaces et un + au début."
        }

        if (email.trim() === '') {
            newErrors.email = "Veuillez indiquer votre adresse e-mail."
        }
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            newErrors.email = "Votre adresse e-mail doit ressembler à nom@exemple.fr."
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


        // Les quatre champs obligatoires ; le téléphone n'est ajouté que s'il est rempli.
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

            // 201 : le compte est créé et la session ouverte par l'API ; l'effet plus haut change de page.
            if (httpStatus === 201) {
                setUser(data)
                setStatus('sent')
                return
            }

            // 202 : l'adresse était déjà enregistrée sans compte. Rien n'est créé tant que
            // le lien envoyé à cette adresse n'a pas été ouvert : connaître un email ne
            // donne jamais la main sur la fiche de quelqu'un d'autre.
            if (httpStatus === 202) {
                setStatus('pending')
                return
            }

            // Refus de l'API : le détail technique va dans la console, le candidat lit un message en français.
            console.error(httpStatus, apiError)
            setStatus('error')

            // Un message français par code de l'API ; 409 propose la connexion.
            if (httpStatus === 409) {
                setSendError('Cette adresse e-mail a déjà un compte : connectez-vous.')
                setNeedLogin(true)
            } else if (httpStatus === 400) {
                if (apiError === 'Password must be at least 8 characters') {
                    setSendError('Le mot de passe doit contenir au moins 8 caractères.')
                } else if (apiError.startsWith('Invalid field: ')) {
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
            setSendError("Nous n'arrivons pas à créer votre compte pour le moment. Merci de réessayer dans quelques instants.")
        }
    }

    // Déjà connecté : la modification de la fiche vit dans l'espace candidat, pas ici.
    // Sauf juste après l'inscription : la coche reste affichée jusqu'au changement de page.
    if (user && status !== 'sent') {
        return <Navigate to="/espace-candidat/informations" replace />
    }

    // Même cadre que la connexion (LoginPage.jsx) : un titre, puis le formulaire sans carte.
    // form-columns (forms.css) : Nom/Prénom puis Téléphone/E-mail par paires, le mot de passe seul sur sa ligne.
    // Chaque champ est dans un div avec son message d'erreur, pour que la paire reste alignée quand un message s'affiche.
    // noValidate : les messages du navigateur sont remplacés par les nôtres, en français.
    return (
      <div className="page account-page">
        <h1>Créer un compte</h1>
        <form className="form-columns" onSubmit={handleSubmit} noValidate>

            <div>
                <label>
                    Nom
                    <input type="text" name="surname" value={surname} onChange={(e) => setSurname(e.target.value)} />
                </label>
                {errors.surname && <p>{errors.surname}</p>}
            </div>

            <div>
                <label>
                    Prénom
                    <input type="text" name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </label>
                {errors.firstName && <p>{errors.firstName}</p>}
            </div>

            <div>
                <label>
                    Téléphone (facultatif)
                    <input type="text" name="telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
                </label>
                {errors.telephone && <p>{errors.telephone}</p>}
            </div>

            <div>
                <label>
                    Adresse e-mail
                    <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                {errors.email && <p>{errors.email}</p>}
            </div>

            <div className="field-wide">
                <label>
                    Mot de passe
                    <input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>
                {errors.password && <p>{errors.password}</p>}
            </div>

            {/* Bouton verrouillé pendant l'envoi : spinner, puis coche. */}
            <div className="form-actions">
                <button type="submit" disabled={status === 'sending' || status === 'sent' || status === 'pending'}>
                    {status === 'sending' && <span className="spinner" aria-hidden="true"></span>}
                    {status === 'sent' || status === 'pending' ? (
                        <>
                            <svg className="checkmark" viewBox="0 0 52 52" aria-hidden="true">
                                <path fill="none" stroke="currentColor" strokeWidth="5" d="M14 27 l8 8 l16 -16" />
                            </svg>
                            {status === 'sent' ? 'Compte créé' : 'Lien envoyé'}
                        </>
                    ) :status === 'sending' ? 'Création en cours…' : 'Créer un compte'}
                </button>
            </div>
            <div aria-live="polite">
                {status === 'sent' && (
                    <p>Votre compte est créé et votre session est ouverte.</p>
                )}
                {status === 'pending' && (
                    <p>
                        Votre adresse est déjà enregistrée chez nous, sans compte. Nous venons
                        d&apos;envoyer un lien de confirmation à {email.trim()} : votre compte
                        et vos candidatures seront accessibles dès que vous l&apos;aurez ouvert.
                    </p>
                )}
                {sendError && (
                    <p role="alert">
                        {sendError} {needLogin && <Link to="/login">Se connecter</Link>}
                    </p>
                )}
            </div>
        </form>
      </div>
    )
}
