// Formulaire de candidature à une annonce, ouvert depuis sa carte.
import { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AuthContext } from '../AuthContext'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

// Nom de chaque champ de l'API, par langue, pour le message « Il manque un champ » : FIELD_NAMES[lang][champ].
const FIELD_NAMES = {
    fr: {
        first_name: 'prénom',
        last_name: 'nom',
        email: 'adresse e-mail',
        message: 'message',
    },
    en: {
        first_name: 'first name',
        last_name: 'last name',
        email: 'email address',
        message: 'message',
    },
}

// CV facultatif : un PDF de 2 Mo maximum (même limite que l'API).
const MAX_CV_SIZE = 2 * 1024 * 1024
const CV_ERROR = {
    fr: 'Votre CV doit être un fichier PDF de 2 Mo maximum.',
    en: 'Your CV must be a PDF file of 2 MB maximum.',
}

export default function Form({ id, onClose }) {
    const { t, lang } = useLang()
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
                newErrors.firstName = t('Veuillez indiquer votre prénom.', 'Please enter your first name.')
            } else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(firstName.trim())) {
                newErrors.firstName = t('Votre prénom ne peut contenir que des lettres, des espaces, des tirets ou des apostrophes.', 'Your first name can only contain letters, spaces, hyphens or apostrophes.')
            }

            if (surname.trim() === '') {
                newErrors.surname = t('Veuillez indiquer votre nom.', 'Please enter your last name.')
            } else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(surname.trim())) {
                newErrors.surname = t('Votre nom ne peut contenir que des lettres, des espaces, des tirets ou des apostrophes.', 'Your last name can only contain letters, spaces, hyphens or apostrophes.')
            }

            if (telephone.trim() !== '' && !/^\+?[0-9 ]+$/.test(telephone.trim())) {
                newErrors.telephone = t('Votre téléphone ne peut contenir que des chiffres, des espaces et un + au début.', 'Your phone number can only contain digits, spaces and a leading +.')
            }

            if (email.trim() === '') {
                newErrors.email = t('Veuillez indiquer votre adresse e-mail.', 'Please enter your email address.')
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                newErrors.email = t('Votre adresse e-mail doit ressembler à nom@exemple.fr.', 'Your email address must look like name@example.com.')
            }
        }

        // Message obligatoire pour tout le monde.
        if (message.trim() === '') {
            newErrors.message = t('Veuillez indiquer votre message.', 'Please enter your message.')
        }

        // Le fichier choisi est vérifié avant l'envoi ; l'API refait la vérification.
        const sendFile = cvChoice === 'file' && cvFile !== null
        if (sendFile && (!/\.pdf$/i.test(cvFile.name) || cvFile.size > MAX_CV_SIZE)) {
            newErrors.cv = CV_ERROR[lang]
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
                setSendError(t(`Il manque un champ : ${FIELD_NAMES.fr[field] || field}.`, `A field is missing: ${FIELD_NAMES.en[field] || field}.`))
            } else if (httpStatus === 400 && apiError === 'Invalid field: cv') {
                setSendError(CV_ERROR[lang])
            } else if (httpStatus === 409 && apiError === 'Already applied') {
                setSendError(t('Vous avez déjà candidaté à cette annonce.', 'You have already applied to this job offer.'))
            } else if (httpStatus === 409 && apiError === 'Ad is closed') {
                setSendError(t('Cette annonce est clôturée : les candidatures ne sont plus possibles.', 'This job offer is closed: applications are no longer possible.'))
            } else if (httpStatus === 401) {
                setSendError(t('Cette adresse e-mail correspond à un compte : connectez-vous pour candidater.', 'This email address belongs to an account: log in to apply.'))
                setNeedLogin(true)
            } else {
                throw new Error(`Unexpected response ${httpStatus}`)
            }
        } catch (err) {
            // Serveur arrêté, réponse illisible ou code inattendu.
            console.error(err)
            setStatus('error')
            setSendError(t("Nous n'arrivons pas à envoyer votre candidature pour le moment. Merci de réessayer dans quelques instants.", 'We cannot send your application at the moment. Please try again in a few moments.'))
        }
    }

    // noValidate : les messages du navigateur sont remplacés par les nôtres, en français.
    return (
        <form onSubmit={handleSubmit} noValidate>
            {/* Connecté : l'identité vient de la session, seuls les visiteurs voient ces champs. */}
            {user ? (
                <p>{t('Vous candidatez en tant que ', 'You are applying as ')}{user.first_name} {user.last_name}.</p>
            ) : (
                <>
                    <label>
                        {t('Nom', 'Last name')}
                        <input type="text" name="surname" value={surname}
                            onChange={(event) => setSurname(event.target.value)} />
                    </label>
                    {errors.surname && <p>{errors.surname}</p>}

                    <label>
                        {t('Prénom', 'First name')}
                        <input type="text" name="firstName" value={firstName}
                            onChange={(event) => setFirstName(event.target.value)} />
                    </label>
                    {errors.firstName && <p>{errors.firstName}</p>}

                    <label>
                        {t('Téléphone (facultatif)', 'Phone number (optional)')}
                        <input type="text" name="telephone" value={telephone}
                            onChange={(event) => setTelephone(event.target.value)} />
                    </label>
                    {errors.telephone && <p>{errors.telephone}</p>}

                    <label>
                        {t('Adresse e-mail', 'Email address')}
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
                    {t('CV joint', 'Attached CV')}
                    <select value={cvChoice} onChange={(event) => setCvChoice(event.target.value)}>
                        <option value="profile">{t('Mon CV enregistré : ', 'My saved CV: ')}{profileCv.filename}</option>
                        <option value="file">{t('Un autre fichier', 'Another file')}</option>
                        <option value="none">{t('Aucun CV', 'No CV')}</option>
                    </select>
                </label>
            )}

            {cvChoice === 'file' && (
                <label>
                    {profileCv ? t('Autre CV (PDF, 2 Mo maximum)', 'Other CV (PDF, 2 MB maximum)') : t('CV (PDF, 2 Mo maximum, facultatif)', 'CV (PDF, 2 MB maximum, optional)')}
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
                        {t('Envoyée', 'Sent')}
                    </>
                ) : status === 'sending' ? t('Envoi en cours…', 'Sending…') : t('Envoyer ma candidature', 'Send my application')}
            </button>

            {/* aria-live : un lecteur d'écran annonce le résultat sans action de l'utilisateur. */}
            <div aria-live="polite">
                {status === 'sent' && (
                    <p className="visually-hidden">{t('Votre candidature est envoyée.', 'Your application has been sent.')}</p>
                )}
                {sendError && (
                    <p>
                        {sendError} {needLogin && <Link to="/login">{t('Se connecter', 'Log in')}</Link>}
                    </p>
                )}
            </div>
        </form>
    )
}