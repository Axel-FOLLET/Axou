// Route table: one URL, one page component.
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
      {/* Route without path: Layout wraps every page listed below it. */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/offres" element={<JobBoardPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/account" element={<AccountPage />} />
        {/* Target of the link emailed when the address was already registered without an account. */}
        <Route path="/verification" element={<VerifyPage />} />
        {/* Target of the link sent to the new address when the email address is changed. */}
        <Route path="/confirmation-email" element={<EmailChangePage />} />
        <Route path="/admin" element={<AdminPage />} />
        {/* Candidate area: the account details and the applications as tabs of a single layout. */}
        <Route path="/espace-candidat" element={<CandidateLayout />}>
          <Route index element={<ApplicationsPage />} />
          <Route path="informations" element={<CandidateAccountPage />} />
        </Route>
        {/* Recruiter area: RecruiterLayout wraps its sub-pages. */}
        <Route path="/recruteur" element={<RecruiterLayout />}>
          <Route index element={<RecruiterPage />} />
          <Route path="entreprise" element={<RecruiterCompanyPage />} />
          <Route path="postes/:id/candidatures" element={<RecruiterApplicationsPage />} />
          <Route path="postes" element={<RecruiterOffersPage />} />
          <Route path="nouvelle-offre" element={<RecruiterNewOfferPage />} />
          <Route path="postes/:id/modifier" element={<RecruiterEditOfferPage />} />
        </Route>
        {/* Catches any URL that matches none of the routes above. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}