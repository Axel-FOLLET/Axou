// Formulaire de candidature à une annonce, ouvert depuis sa carte.
import { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AuthContext } from '../AuthContext'
import { apiFetch } from '../api.js'

// Nom de chaque champ de l'API, en français, pour le message « Il manque un champ ».
const FIELD_NAMES = {
    first_name: 'prénom',
    last_name: 'nom',
    email: 'adresse e-mail',
    message: 'message',
}

// CV facultatif : un PDF de 2 Mo maximum (même limite que l'API).
const MAX_CV_SIZE = 2 * 1024 * 1024
const CV_ERROR = 'Votre CV doit être un fichier PDF de 2 Mo maximum.'

export default function Form({ id, onClose }) {
    // Un visiteur saisit son identité ; une personne connectée ne remplit que le message.
    const { user } = useContext(AuthContext)
    const [firstName, setFirstName] = useState('')
    const [surname, setSurname] = useState('')
    const [telephone, setTelephone] = useState('')
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState('')
    // errors = un message par champ fautif ; status pilote le bouton : idle, sending, sent, error.
    const [errors, setErrors] = useState({})
    const [status, setStatus] = useState('idle')
    const [sendError, setSendError] = useState('')
    const [needLogin, setNeedLogin] = useState(false)
    // CV : fichier choisi ici, ou CV enregistré dans l'espace candidat (personne connectée).
    // cvChoice : 'profile' (CV enregistré), 'file' (un autre fichier) ou 'none'.
    const [cvFile, setCvFile] = useState(null)
    const [profileCv, setProfileCv] = useState(null)
    const [cvChoice, setCvChoice] = useState('file')

    // Personne connectée : le CV de son profil est proposé par défaut (404 : elle n'en a pas).
    useEffect(() => {
        if (!user) return
        async function fetchProfileCv() {
            const { ok, data } = await apiFetch('/api/me/cv')
            if (ok) {
                setProfileCv(data)
                setCvChoice('profile')
            }
        }
        fetchProfileCv()
    }, [user])

    // Laisse le V se dessiner avant de fermer le formulaire.
    useEffect(() => {
        if (status !== 'sent') return
        const timer = setTimeout(onClose, 1150)
        return () => clearTimeout(timer)
    }, [status, onClose])

    const handleSubmit = async (event) => {
        event.preventDefault()
        // Double clic ou renvoi pendant l'attente : on ignore.
        if (status === 'sending' || status === 'sent') return

        setSendError('')
        setNeedLogin(false)
        const newErrors = {}

        // Les informations personnelles sont nécessaires aux visiteurs seulement.
        if (!user) {
            if (firstName.trim() === '') {
                newErrors.firstName = 'Veuillez indiquer votre prénom.'
            } else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(firstName.trim())) {
                newErrors.firstName = 'Votre prénom ne peut contenir que des lettres, des espaces, des tirets ou des apostrophes.'
            }

            if (surname.trim() === '') {
                newErrors.surname = 'Veuillez indiquer votre nom.'
            } else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(surname.trim())) {
                newErrors.surname = 'Votre nom ne peut contenir que des lettres, des espaces, des tirets ou des apostrophes.'
            }

            if (telephone.trim() !== '' && !/^\+?[0-9 ]+$/.test(telephone.trim())) {
                newErrors.telephone = 'Votre téléphone ne peut contenir que des chiffres, des espaces et un + au début.'
            }

            if (email.trim() === '') {
                newErrors.email = 'Veuillez indiquer votre adresse e-mail.'
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                newErrors.email = 'Votre adresse e-mail doit ressembler à nom@exemple.fr.'
            }
        }

        // Message obligatoire pour tout le monde.
        if (message.trim() === '') {
            newErrors.message = 'Veuillez indiquer votre message.'
        }

        // Le fichier choisi est vérifié avant l'envoi ; l'API refait la vérification.
        const sendFile = cvChoice === 'file' && cvFile !== null
        if (sendFile && (!/\.pdf$/i.test(cvFile.name) || cvFile.size > MAX_CV_SIZE)) {
            newErrors.cv = CV_ERROR
        }

        // Au moins une erreur de saisie : rien n'est envoyé au serveur.
        setErrors(newErrors)
        if (Object.keys(newErrors).length > 0) return

        // Si connecté, le serveur prend l'identité dans la session.
        const body = { message: message.trim() }

        if (!user) {
            body.first_name = firstName.trim()
            body.last_name = surname.trim()
            body.email = email.trim()
            if (telephone.trim() !== '') {
                body.phone = telephone.trim()
            }
        }

        // CV du profil : le serveur en joint une copie à la candidature.
        if (user && profileCv && cvChoice === 'profile') {
            body.use_profile_cv = true
        }

        // Un fichier part dans un formulaire multipart, avec les autres champs ; sinon, en JSON.
        let payload = body
        if (sendFile) {
            payload = new FormData()
            Object.entries(body).forEach(([name, value]) => payload.append(name, value))
            payload.append('cv', cvFile)
        }

        setStatus('sending')

        try {
            const { status: httpStatus, error: apiError } = await apiFetch(`/api/ads/${id}/applications`, {
                method: 'POST',
                body: payload,
            })

            // 201 : candidature enregistrée, l'effet plus haut referme le formulaire.
            if (httpStatus === 201) {
                setStatus('sent')
                return
            }

            // Refus de l'API : le détail technique va dans la console, le candidat lit un message en français.
            console.error(httpStatus, apiError)
            setStatus('error')

            // Un message français par cas : champ manquant, candidature en double, annonce clôturée, compte existant.
            if (httpStatus === 400 && apiError.startsWith('Missing field: ')) {
                const field = apiError.replace('Missing field: ', '')
                setSendError(`Il manque un champ : ${FIELD_NAMES[field] || field}.`)
            } else if (httpStatus === 400 && apiError === 'Invalid field: cv') {
                setSendError(CV_ERROR)
            } else if (httpStatus === 409 && apiError === 'Already applied') {
                setSendError('Vous avez déjà candidaté à cette annonce.')
            } else if (httpStatus === 409 && apiError === 'Ad is closed') {
                setSendError('Cette annonce est clôturée : les candidatures ne sont plus possibles.')
            } else if (httpStatus === 401) {
                setSendError('Cette adresse e-mail correspond à un compte : connectez-vous pour candidater.')
                setNeedLogin(true)
            } else {
                throw new Error(`Unexpected response ${httpStatus}`)
            }
        } catch (err) {
            // Serveur arrêté, réponse illisible ou code inattendu.
            console.error(err)
            setStatus('error')
            setSendError("Nous n'arrivons pas à envoyer votre candidature pour le moment. Merci de réessayer dans quelques instants.")
        }
    }

    // noValidate : les messages du navigateur sont remplacés par les nôtres, en français.
    return (
        <form onSubmit={handleSubmit} noValidate>
            {/* Connecté : l'identité vient de la session, seuls les visiteurs voient ces champs. */}
            {user ? (
                <p>Vous candidatez en tant que {user.first_name} {user.last_name}.</p>
            ) : (
                <>
                    <label>
                        Nom
                        <input type="text" name="surname" value={surname}
                            onChange={(event) => setSurname(event.target.value)} />
                    </label>
                    {errors.surname && <p>{errors.surname}</p>}

                    <label>
                        Prénom
                        <input type="text" name="firstName" value={firstName}
                            onChange={(event) => setFirstName(event.target.value)} />
                    </label>
                    {errors.firstName && <p>{errors.firstName}</p>}

                    <label>
                        Téléphone (facultatif)
                        <input type="text" name="telephone" value={telephone}
                            onChange={(event) => setTelephone(event.target.value)} />
                    </label>
                    {errors.telephone && <p>{errors.telephone}</p>}

                    <label>
                        Adresse e-mail
                        <input type="email" name="email" value={email}
                            onChange={(event) => setEmail(event.target.value)} />
                    </label>
                    {errors.email && <p>{errors.email}</p>}
                </>
            )}

            <label>
                Message
                <textarea name="message" value={message}
                    onChange={(event) => setMessage(event.target.value)} />
            </label>
            {errors.message && <p>{errors.message}</p>}

            {/* Personne connectée qui a un CV dans son espace : il est joint par défaut, ou remplacé par un autre fichier. */}
            {profileCv && (
                <label>
                    CV joint
                    <select value={cvChoice} onChange={(event) => setCvChoice(event.target.value)}>
                        <option value="profile">Mon CV enregistré : {profileCv.filename}</option>
                        <option value="file">Un autre fichier</option>
                        <option value="none">Aucun CV</option>
                    </select>
                </label>
            )}

            {cvChoice === 'file' && (
                <label>
                    {profileCv ? 'Autre CV (PDF, 2 Mo maximum)' : 'CV (PDF, 2 Mo maximum, facultatif)'}
                    <input type="file" name="cv" accept="application/pdf,.pdf"
                        onChange={(event) => setCvFile(event.target.files[0] ?? null)} />
                </label>
            )}
            {errors.cv && <p>{errors.cv}</p>}

            {/* Bouton verrouillé pendant l'envoi : spinner, puis coche avant la fermeture. */}
            <button type="submit" disabled={status === 'sending' || status === 'sent'}>
                {status === 'sending' && <span className="spinner" aria-hidden="true"></span>}
                {status === 'sent' ? (
                    <>
                        <svg className="checkmark" viewBox="0 0 52 52" aria-hidden="true">
                            <path fill="none" stroke="currentColor" strokeWidth="5"
                                d="M14 27 l8 8 l16 -16" />
                        </svg>
                        Envoyée
                    </>
                ) : status === 'sending' ? 'Envoi en cours…' : 'Envoyer ma candidature'}
            </button>

            {/* aria-live : un lecteur d'écran annonce le résultat sans action de l'utilisateur. */}
            <div aria-live="polite">
                {status === 'sent' && (
                    <p className="visually-hidden">Votre candidature est envoyée.</p>
                )}
                {sendError && (
                    <p>
                        {sendError} {needLogin && <Link to="/login">Se connecter</Link>}
                    </p>
                )}
            </div>
        </form>
    )
}