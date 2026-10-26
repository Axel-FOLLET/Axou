import { useContext, useState, useEffect } from "react";
import { Link } from "react-router";
import { AuthContext } from "../AuthContext";
import { apiFetch } from "../api.js";
import { useLang } from "../lang.js";

// "2026-10-08 18:15:02" (UTC, comme le renvoie SQLite) -> "8 octobre 2026" (locale vient de useLang).
function formatDate(value, locale) {
    return new Date(value.replace(" ", "T") + "Z").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

// Page « Mes candidatures » : réservée au visiteur connecté.
export default function ApplicationsPage() {
    const { user } = useContext(AuthContext);
    const { t, locale } = useLang();
    const [applications, setApplications] = useState([]);
    const [errorStatus, setErrorStatus] = useState(null);

    useEffect(() => {
        if (user === null) return;
            async function fetchApplications() {
                  // Lit l'API /api/me/applications.
                const { ok, status, data, error } = await apiFetch('/api/me/applications');
                if (ok) {
                    setApplications(data);
                    setErrorStatus(null);
                } else {
                    // 401 = session expirée, autre code ou 0 = API indisponible : géré dans l'affichage.
                    setErrorStatus(status);
                    console.error('Error fetching applications:', status, error);
                }
            }
        fetchApplications();
    }, [user]);

    return (
        <div className="applications-page">
            <h1>{t("Mes candidatures", "My applications")}</h1>
            {/* user à null = visiteur non connecté : on propose la connexion plutôt que la liste. */}
            {user === null || errorStatus === 401 ? (
                <Link to="/login">{t("Connectez-vous pour voir vos candidatures.", "Log in to see your applications.")}</Link>
            ) : errorStatus !== null ? (
                <p>{t("Impossible de charger vos candidatures pour le moment.", "Unable to load your applications at the moment.")}</p>
            ) : (
                <>
                <p>{t(`Bonjour ${user.first_name}, voici vos candidatures.`, `Hello ${user.first_name}, here are your applications.`)}</p>
                    {applications.length === 0 ? (
                        <Link to="/offres">{t("Vous n'avez pas encore candidaté. Découvrir les offres", "You have not applied yet. Discover the job offers")}</Link>
                    ) : (<ul>
                            {applications.map((application) => (
                                <li key={application.id}>
                                    <h3>{application.title}</h3>
                                    <p>{t("Entreprise :", "Company:")} {application.company}</p>
                                    <p>{t("Envoyée le", "Sent on")} {formatDate(application.created_at, locale)}</p>
                                    {/* Statuts de l'API traduits pour l'écran : pending, accepted, sinon refusée. */}
                                    <p className={`application-status status-${application.status}`}>{t("Statut :", "Status:")} {application.status === 'pending' ? t('En attente', 'Pending') : application.status === 'accepted' ? t('Retenue', 'Accepted') : t('Refusée', 'Rejected')}</p>
                                </li>
                            ))}
                        </ul>)}
                </>
            )}
        </div>
    );
}
