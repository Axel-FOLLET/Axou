// Page shown for any unknown URL (route * in App.jsx).
import { Link } from 'react-router';
import { useLang } from '../lang.js';

export default function NotFoundPage() {
  const { t } = useLang();

  return (
    <div className="page">
      <h1>{t('Page introuvable', 'Page not found')}</h1>
      {/* A calm sentence and a single way back. */}
      <p>{t("Cette page n'existe pas ou a été déplacée.", 'This page does not exist or has been moved.')}</p>
      <Link to="/">{t("Retour à l'accueil", 'Back to the home page')}</Link>
    </div>
  );
}
