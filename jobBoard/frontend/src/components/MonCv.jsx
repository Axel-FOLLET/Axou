// CV enregistré dans l'espace candidat (GET, PUT, DELETE /api/me/cv), proposé ensuite dans le formulaire de candidature.
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { apiFetch } from '../api.js'
import { useLang } from '../lang.js'

// Même limite que l'API : un PDF de 2 Mo maximum.
const MAX_CV_SIZE = 2 * 1024 * 1024
const CV_ERROR = {
    fr: 'Votre CV doit être un fichier PDF de 2 Mo maximum.',
    en: 'Your CV must be a PDF file of 2 MB maximum.',
}

// "2026-10-16 09:30:00" (UTC, comme le renvoie SQLite) -> "16 octobre 2026" (locale vient de useLang).
function formatDate(value, locale) {
    return new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function MonCv() {
    const { t, lang, locale } = useLang()
    // cv = { filename, uploaded_at } ou null si la personne n'en a pas (404 CV not found).
    const [cv, setCv] = useState(null)
    const [loaded, setLoaded] = useState(false)
    const [cvFile, setCvFile] = useState(null)
    // status : idle, sending, saved, deleted, error.
    const [status, setStatus] = useState('idle')
    const [sendError, setSendError] = useState('')
    const [needLogin, setNeedLogin] = useState(false)
    // Change à chaque envoi réussi : vide le champ fichier.
    const [inputKey, setInputKey] = useState(0)

    useEffect(() => {
        async function fetchCv() {
            const { ok, status: httpStatus, data, error } = await apiFetch('/api/me/cv')
            if (ok) setCv(data)
            else if (httpStatus !== 404) console.error('Error fetching CV:', httpStatus, error)
            setLoaded(true)
        }
        fetchCv()
    }, [])

    // Refus de l'API : le détail technique va dans la console, la personne lit un message en français.
    function showError(httpStatus, apiError) {
        console.error(httpStatus, apiError)
        setStatus('error')
        if (httpStatus === 401) {
            setSendError(t('Votre session a expiré.', 'Your session has expired.'))
            setNeedLogin(true)
        } else if (apiError === 'Invalid field: cv') {
            setSendError(CV_ERROR[lang])
        } else {
            setSendError(t("Nous n'arrivons pas à enregistrer votre CV pour le moment. Merci de réessayer dans quelques instants.", 'We are unable to save your CV at the moment. Please try again in a few moments.'))
        }
    }

    // PUT /api/me/cv : envoie un premier CV ou remplace l'ancien.
    const handleSubmit = async (event) => {
        event.preventDefault()
        if (status === 'sending') return
        setSendError('')
        setNeedLogin(false)

        if (cvFile === null) {
            setStatus('error')
            setSendError(t('Choisissez un fichier PDF.', 'Choose a PDF file.'))
            return
        }
        // Vérifié avant l'envoi ; l'API refait la vérification.
        if (!/\.pdf$/i.test(cvFile.name) || cvFile.size > MAX_CV_SIZE) {
            setStatus('error')
            setSendError(CV_ERROR[lang])
            return
        }

        const payload = new FormData()
        payload.append('cv', cvFile)
        setStatus('sending')
        const { ok, status: httpStatus, data, error: apiError } = await apiFetch('/api/me/cv', { method: 'PUT', body: payload })
        if (ok) {
            setCv(data)
            setCvFile(null)
            setInputKey((key) => key + 1)
            setStatus('saved')
            return
        }
        showError(httpStatus, apiError)
    }

    // DELETE /api/me/cv : les CV déjà joints à des candidatures restent chez les recruteurs.
    const handleDelete = async () => {
        if (!window.confirm(t('Supprimer votre CV enregistré ? Les candidatures déjà envoyées gardent leur CV.', 'Delete your saved CV? Applications already sent keep their CV.'))) return
        setSendError('')
        setNeedLogin(false)
        setStatus('sending')
        const { status: httpStatus, error: apiError } = await apiFetch('/api/me/cv', { method: 'DELETE' })
        // 404 : déjà supprimé ailleurs, le résultat est le même.
        if (httpStatus === 204 || httpStatus === 404) {
            setCv(null)
            setStatus('deleted')
            return
        }
        showError(httpStatus, apiError)
    }

    return (
        <section>
            <h2>{t('Mon CV', 'My CV')}</h2>
            {!loaded ? (
                <p>{t('Chargement…', 'Loading…')}</p>
            ) : cv ? (
                <p>
                    {/* Le PDF se télécharge directement depuis l'API (même origine grâce au proxy, cookie compris). */}
                    <a href="/api/me/cv/file" download>{cv.filename}</a>{t(`, envoyé le ${formatDate(cv.uploaded_at, locale)}.`, `, sent on ${formatDate(cv.uploaded_at, locale)}.`)}
                    {' '}{t('Il est proposé par défaut quand vous candidatez.', 'It is offered by default when you apply.')}
                </p>
            ) : (
                <p>{t('Aucun CV enregistré. Ajoutez-en un pour le joindre à vos candidatures en un clic.', 'No CV saved. Add one to attach it to your applications in one click.')}</p>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <label>
                    {cv ? t('Remplacer mon CV (PDF, 2 Mo maximum)', 'Replace my CV (PDF, 2 MB maximum)') : t('Ajouter mon CV (PDF, 2 Mo maximum)', 'Add my CV (PDF, 2 MB maximum)')}
                    <input key={inputKey} type="file" name="cv" accept="application/pdf,.pdf"
                        onChange={(event) => setCvFile(event.target.files[0] ?? null)} />
                </label>

                <div className="form-actions">
                    {cv && (
                        <button type="button" className="button-danger" disabled={status === 'sending'} onClick={handleDelete}>
                            {t('Supprimer mon CV', 'Delete my CV')}
                        </button>
                    )}
                    <button type="submit" disabled={status === 'sending'}>
                        {status === 'sending' ? t('Envoi…', 'Sending…') : t('Enregistrer mon CV', 'Save my CV')}
                    </button>
                </div>
                {/* aria-live : un lecteur d'écran annonce le résultat sans action de l'utilisateur. */}
                <div aria-live="polite">
                    {status === 'saved' && <p>{t('Votre CV est enregistré.', 'Your CV has been saved.')}</p>}
                    {status === 'deleted' && <p>{t('Votre CV est supprimé.', 'Your CV has been deleted.')}</p>}
                    {sendError && (
                        <p role="alert">
                            {sendError} {needLogin && <Link to="/login">{t('Se connecter', 'Log in')}</Link>}
                        </p>
                    )}
                </div>
            </form>
        </section>
    )
}
