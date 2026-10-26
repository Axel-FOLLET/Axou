// Table des routes : une URL, un composant de page.
import { Routes, Route } from 'react-router'

import Layout from './components/Layout.jsx'
import JobBoardPage from './pages/JobBoardPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import VerifyPage from './pages/VerifyPage.jsx'
import EmailChangePage from './pages/EmailChangePage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import ApplicationsPage from './pages/ApplicationsPage.jsx'
import HomePage from './pages/HomePage.jsx'
import CandidateLayout from './pages/CandidateLayout.jsx'
import CandidateAccountPage from './pages/CandidateAccountPage.jsx'
import RecruiterLayout from './pages/RecruiterLayout.jsx'
import RecruiterPage from './pages/RecruiterPage.jsx'
import RecruiterOffersPage from './pages/RecruiterOffersPage.jsx'
import RecruiterCompanyPage from './pages/RecruiterCompanyPage.jsx'
import RecruiterNewOfferPage from './pages/RecruiterNewOfferPage.jsx'
import RecruiterEditOfferPage from './pages/RecruiterEditOfferPage.jsx'
import RecruiterApplicationsPage from './pages/RecruiterApplicationsPage.jsx'

export default function App() {
  return (
    <Routes>
      {/* Route sans path : Layout encadre toutes les pages listées en dessous. */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/offres" element={<JobBoardPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/account" element={<AccountPage />} />
        {/* Cible du lien envoyé par email quand l'adresse était déjà enregistrée sans compte. */}
        <Route path="/verification" element={<VerifyPage />} />
        {/* Cible du lien envoyé à la nouvelle adresse lors d'un changement d'e-mail. */}
        <Route path="/confirmation-email" element={<EmailChangePage />} />
        <Route path="/admin" element={<AdminPage />} />
        {/* Espace candidat : les informations du compte et les candidatures sous un seul onglet. */}
        <Route path="/espace-candidat" element={<CandidateLayout />}>
          <Route index element={<ApplicationsPage />} />
          <Route path="informations" element={<CandidateAccountPage />} />
        </Route>
        {/* Espace recruteur : RecruiterLayout encadre ses trois sous-pages. */}
        <Route path="/recruteur" element={<RecruiterLayout />}>
          <Route index element={<RecruiterPage />} />
          <Route path="entreprise" element={<RecruiterCompanyPage />} />
          <Route path="postes/:id/candidatures" element={<RecruiterApplicationsPage />} />
          <Route path="postes" element={<RecruiterOffersPage />} />
          <Route path="nouvelle-offre" element={<RecruiterNewOfferPage />} />
          <Route path="postes/:id/modifier" element={<RecruiterEditOfferPage />} />
        </Route>
        {/* Attrape toute URL qui ne correspond à aucune route ci-dessus. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}