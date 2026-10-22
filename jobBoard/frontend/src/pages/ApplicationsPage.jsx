import { useContext, useState, useEffect } from "react";
import { Link } from "react-router";
import { AuthContext } from "../AuthContext";
import { apiFetch } from "../api.js";

// "2026-10-08 18:15:02" (UTC, comme le renvoie SQLite) -> "8 octobre 2026"
function formatDate(value) {
    return new Date(value.replace(" ", "T") + "Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Page « Mes candidatures » : réservée au visiteur connecté.
export default function ApplicationsPage() {
    const { user } = useContext(AuthContext);
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
            <h1>Mes candidatures</h1>
            {/* user à null = visiteur non connecté : on propose la connexion plutôt que la liste. */}
            {user === null || errorStatus === 401 ? (
                <Link to="/login">Connectez-vous pour voir vos candidatures.</Link>
            ) : errorStatus !== null ? (
                <p>Impossible de charger vos candidatures pour le moment.</p>
            ) : (
                <>
                <p>Bonjour {user.first_name}, voici vos candidatures.</p>
                    {applications.length === 0 ? (
                        <Link to="/offres">Vous n'avez pas encore candidaté. Découvrir les offres</Link>
                    ) : (<ul>
                            {applications.map((application) => (
                                <li key={application.id}>
                                    <h3>{application.title}</h3>
                                    <p>Entreprise : {application.company}</p>
                                    <p>Envoyée le {formatDate(application.created_at)}</p>
                                    {/* Statuts de l'API traduits pour l'écran : pending, accepted, sinon refusée. */}
                                    <p className={`application-status status-${application.status}`}>Statut : {application.status === 'pending' ? 'En attente' : application.status === 'accepted' ? 'Retenue' : 'Refusée'}</p>
                                </li>
                            ))}
                        </ul>)}
                </>
            )}
        </div>
    );
}
