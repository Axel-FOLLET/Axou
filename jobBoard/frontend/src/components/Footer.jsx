// Pied de page commun, en deux colonnes : navigation, puis mentions légales (LCEN, art. 1-1)
// et information sur les données (RGPD, art. 13), repliées. Contenu validé par l'équipe ;
// la démonstration est hébergée sur Render (voir README, « Déploiement sur Render »).
import { useContext } from 'react'
import { Link } from 'react-router'
import { AuthContext } from '../AuthContext'

export default function Footer() {
  const { user } = useContext(AuthContext)

  return (
    <footer className="site-footer">
      <div className="footer-columns">
        {/* Mêmes liens que l'en-tête, selon l'état : visiteur, personne connectée, administration. */}
        <nav aria-label="Navigation du pied de page">
          <h2 className="footer-title">Navigation</h2>
          <ul className="footer-links">
            <li><Link to="/">Accueil</Link></li>
            <li><Link to="/offres">Offres d'emploi</Link></li>
            <li><Link to="/recruteur">Espace recruteur</Link></li>
            {user ? (
              <>
                <li><Link to="/espace-candidat">Espace candidat</Link></li>
                {user.role === 'admin' && <li><Link to="/admin">Administration</Link></li>}
              </>
            ) : (
              <li><Link to="/login">Connexion</Link></li>
            )}
          </ul>
        </nav>

        {/* Le titre de la colonne ouvre et ferme le détail. */}
        <details className="legal">
          <summary className="footer-title">Mentions légales et données personnelles</summary>

          <h3>Éditeur</h3>
          <p>Y.I.A Jobs est un projet pédagogique non professionnel réalisé à Epitech par Axel FOLLET, Yohan AVRONSART et Ismail BASSIT.</p>
          <p>Directeur de la publication : Axel FOLLET. Contact : <a href="https://github.com/Axel-FOLLET/jobBoard" target="_blank" rel="noopener noreferrer">dépôt GitHub du projet</a>.</p>

          <h3>Hébergement</h3>
          <p>Démonstration hébergée sur Render (render.com) ; les données de démonstration sont fictives et remises à zéro à chaque redémarrage du service.</p>

          <h3>Données personnelles</h3>
          <p>Données collectées : nom, prénom, adresse e-mail, téléphone (facultatif), mot de passe (conservé sous forme d'empreinte, jamais en clair) et messages de candidature.</p>
          <p>Elles servent à créer et gérer votre compte, à vérifier votre adresse e-mail et à transmettre vos candidatures au recruteur de l'offre concernée. Base légale : l'exécution du service que vous demandez en créant un compte ou en postulant (RGPD, art. 6.1.b).</p>
          <p>Destinataires : l'équipe d'administration du site et le recruteur de l'offre à laquelle vous postulez. Sur cette démonstration, l'envoi d'e-mails est désactivé : aucun e-mail n'est envoyé.</p>
          <p>Durée de conservation : un an.</p>
          <p>Vous pouvez demander l'accès à vos données, leur rectification, leur effacement ou la limitation de leur traitement par le lien de contact ci-dessus, et adresser une réclamation à la <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer">CNIL</a>.</p>

          <h3>Cookies</h3>
          <p>Un seul cookie, nécessaire à la connexion : il garde votre session ouverte et ne sert à aucune mesure d'audience ni publicité. Il est donc dispensé de consentement.</p>
          <p>La police Manrope est chargée depuis Google Fonts : votre navigateur transmet alors votre adresse IP à Google.</p>
        </details>
      </div>

      <p className="copyright">© 2026 Y.I.A Jobs, projet Epitech</p>
    </footer>
  )
}
