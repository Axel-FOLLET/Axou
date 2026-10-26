// Pied de page commun, en deux colonnes : navigation, puis mentions légales (LCEN, art. 1-1)
// et information sur les données (RGPD, art. 13), repliées. Contenu validé par l'équipe ;
// la démonstration est hébergée sur Render (voir README, « Déploiement sur Render »).
import { useContext } from 'react'
import { Link } from 'react-router'
import { AuthContext } from '../AuthContext'
import { useLang } from '../lang.js'

export default function Footer() {
  const { user } = useContext(AuthContext)
  const { t } = useLang()

  return (
    <footer className="site-footer">
      <div className="footer-columns">
        {/* Mêmes liens que l'en-tête, selon l'état : visiteur, personne connectée, administration. */}
        <nav aria-label={t('Navigation du pied de page', 'Footer navigation')}>
          <h2 className="footer-title">Navigation</h2>
          <ul className="footer-links">
            <li><Link to="/">{t('Accueil', 'Home')}</Link></li>
            <li><Link to="/offres">{t("Offres d'emploi", 'Job offers')}</Link></li>
            <li><Link to="/recruteur">{t('Espace recruteur', 'Recruiter area')}</Link></li>
            {user ? (
              <>
                <li><Link to="/espace-candidat">{t('Espace candidat', 'Candidate area')}</Link></li>
                {user.role === 'admin' && <li><Link to="/admin">{t('Administration', 'Admin')}</Link></li>}
              </>
            ) : (
              <li><Link to="/login">{t('Connexion', 'Log in')}</Link></li>
            )}
          </ul>
        </nav>

        {/* Le titre de la colonne ouvre et ferme le détail. */}
        <details className="legal">
          <summary className="footer-title">{t('Mentions légales et données personnelles', 'Legal notice and personal data')}</summary>

          <h3>{t('Éditeur', 'Publisher')}</h3>
          <p>{t('Y.I.A Jobs est un projet pédagogique non professionnel réalisé à Epitech par Axel FOLLET, Yohan AVRONSART et Ismail BASSIT.', 'Y.I.A Jobs is a non-professional educational project carried out at Epitech by Axel FOLLET, Yohan AVRONSART and Ismail BASSIT.')}</p>
          <p>{t('Directeur de la publication : Axel FOLLET. Contact : ', 'Publication director: Axel FOLLET. Contact: ')}<a href="https://github.com/Axel-FOLLET/jobBoard" target="_blank" rel="noopener noreferrer">{t('dépôt GitHub du projet', 'project GitHub repository')}</a>.</p>

          <h3>{t('Hébergement', 'Hosting')}</h3>
          <p>{t('Démonstration hébergée sur Render (render.com) ; les données de démonstration sont fictives et remises à zéro à chaque redémarrage du service.', 'Demo hosted on Render (render.com); the demo data is fictitious and reset each time the service restarts.')}</p>

          <h3>{t('Données personnelles', 'Personal data')}</h3>
          <p>{t("Données collectées : nom, prénom, adresse e-mail, téléphone (facultatif), mot de passe (conservé sous forme d'empreinte, jamais en clair) et messages de candidature.", 'Data collected: last name, first name, email address, phone number (optional), password (stored as a hash, never in plain text) and application messages.')}</p>
          <p>{t("Elles servent à créer et gérer votre compte, à vérifier votre adresse e-mail et à transmettre vos candidatures au recruteur de l'offre concernée. Base légale : l'exécution du service que vous demandez en créant un compte ou en postulant (RGPD, art. 6.1.b).", 'It is used to create and manage your account, to verify your email address and to send your applications to the recruiter of the job offer concerned. Legal basis: performance of the service you request by creating an account or applying (GDPR, Art. 6(1)(b)).')}</p>
          <p>{t("Destinataires : l'équipe d'administration du site et le recruteur de l'offre à laquelle vous postulez. Sur cette démonstration, l'envoi d'e-mails est désactivé : aucun e-mail n'est envoyé.", 'Recipients: the site administration team and the recruiter of the job offer you apply to. On this demo, sending emails is disabled: no email is sent.')}</p>
          <p>{t('Durée de conservation : un an.', 'Retention period: one year.')}</p>
          <p>{t("Vous pouvez demander l'accès à vos données, leur rectification, leur effacement ou la limitation de leur traitement par le lien de contact ci-dessus, et adresser une réclamation à la ", 'You can request access to your data, its rectification, its erasure or the restriction of its processing through the contact link above, and lodge a complaint with the ')}<a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer">CNIL</a>.</p>

          <h3>Cookies</h3>
          <p>{t("Un seul cookie, nécessaire à la connexion : il garde votre session ouverte et ne sert à aucune mesure d'audience ni publicité. Il est donc dispensé de consentement.", 'A single cookie, needed to log in: it keeps your session open and is used for neither audience measurement nor advertising. It is therefore exempt from consent.')}</p>
          <p>{t('La police Manrope est chargée depuis Google Fonts : votre navigateur transmet alors votre adresse IP à Google.', 'The Manrope font is loaded from Google Fonts: your browser therefore sends your IP address to Google.')}</p>
        </details>
      </div>

      <p className="copyright">{t('© 2026 Y.I.A Jobs, projet Epitech', '© 2026 Y.I.A Jobs, Epitech project')}</p>
    </footer>
  )
}
