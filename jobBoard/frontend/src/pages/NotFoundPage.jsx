// Page affichée pour toute URL inconnue (route * dans App.jsx).
import { Link } from 'react-router';
import { useLang } from '../lang.js';

export default function NotFoundPage() {
  const { t } = useLang();

  return (
    <div className="page">
      <h1>{t('Page introuvable', 'Page not found')}</h1>
      {/* Une phrase calme et un seul chemin de retour. */}
      <p>{t("Cette page n'existe pas ou a été déplacée.", 'This page does not exist or has been moved.')}</p>
      <Link to="/">{t("Retour à l'accueil", 'Back to the home page')}</Link>
    </div>
  );
}
