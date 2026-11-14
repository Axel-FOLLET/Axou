// --- Table descriptions ---
// One entry per API table. columns = what is displayed, editableFields = what the
// API accepts for writing (source: docs/contrat_api.md). The rest of the page
// is built from this object, with no code specific to a table.
// Texts displayed in two languages: { fr, en }, read by AdminPage with the current language.
export const tables = {
  companies: {
    title: { fr: "Entreprises", en: "Companies" },
    addLabel: { fr: "Ajouter une entreprise", en: "Add a company" },
    editTitle: (row, lang) => lang === "en" ? `Edit ${row.name}` : `Modifier ${row.name}`,
    editableFields: ["name", "siren", "description", "location", "website"],
    columns: [{ key: "id", label: { fr: "Identifiant", en: "ID" } }, { key: "name", label: { fr: "Nom", en: "Name" } }, { key: "siren", label: { fr: "SIREN", en: "SIREN" } }, { key: "description", label: { fr: "Description", en: "Description" } }, { key: "location", label: { fr: "Lieu", en: "Location" } }, { key: "website", label: { fr: "Site web", en: "Website" } }],
  },
  categories: {
    title: { fr: "Catégories", en: "Categories" },
    addLabel: { fr: "Ajouter une catégorie", en: "Add a category" },
    editTitle: (row, lang) => lang === "en" ? `Edit ${row.name}` : `Modifier ${row.name}`,
    editableFields: ["name"],
    columns: [{ key: "id", label: { fr: "Identifiant", en: "ID" } }, { key: "name", label: { fr: "Nom", en: "Name" } }],
  },
  people: {
    title: { fr: "Personnes", en: "People" },
    addLabel: { fr: "Ajouter une personne", en: "Add a person" },
    editTitle: (row, lang) => lang === "en" ? `Edit ${row.first_name} ${row.last_name}` : `Modifier ${row.first_name} ${row.last_name}`,
    editableFields: ["first_name", "last_name", "email", "phone", "role", "company_id"],
    columns: [{ key: "id", label: { fr: "Identifiant", en: "ID" } }, { key: "first_name", label: { fr: "Prénom", en: "First name" } }, { key: "last_name", label: { fr: "Nom", en: "Last name" } }, { key: "email", label: { fr: "Adresse e-mail", en: "Email address" } }, { key: "phone", label: { fr: "Téléphone", en: "Phone number" } }, { key: "role", label: { fr: "Rôle", en: "Role" } }, { key: "company_id", label: { fr: "Identifiant de l'entreprise", en: "Company ID" } }],
  },
  ads: {
    title: { fr: "Annonces", en: "Job offers" },
    addLabel: { fr: "Ajouter une annonce", en: "Add a job offer" },
    editTitle: (row, lang) => lang === "en" ? `Edit ${row.title}` : `Modifier ${row.title}`,
    editableFields: ["title", "short_description", "description", "salary", "location", "working_time", "contract_type", "company_id", "category_id", "contact_id"],
    // status and created_at are displayed but absent from editableFields: the API refuses them for writing.
    columns: [{ key: "id", label: { fr: "Identifiant", en: "ID" } }, { key: "title", label: { fr: "Titre", en: "Title" } }, { key: "short_description", label: { fr: "Description courte", en: "Short description" } }, { key: "description", label: { fr: "Description", en: "Description" } }, { key: "salary", label: { fr: "Salaire", en: "Salary" } }, { key: "location", label: { fr: "Lieu", en: "Location" } }, { key: "working_time", label: { fr: "Temps de travail", en: "Working time" } }, { key: "contract_type", label: { fr: "Type de contrat", en: "Contract type" } }, { key: "status", label: { fr: "Statut", en: "Status" } }, { key: "created_at", label: { fr: "Date de création", en: "Creation date" } }, { key: "company_id", label: { fr: "Identifiant de l'entreprise", en: "Company ID" } }, { key: "category_id", label: { fr: "Identifiant de la catégorie", en: "Category ID" } }, { key: "contact_id", label: { fr: "Identifiant du contact", en: "Contact ID" } }],
  },
  applications: {
    title: { fr: "Candidatures", en: "Applications" },
    addLabel: { fr: "Ajouter une candidature", en: "Add an application" },
    editTitle: (row, lang) => lang === "en" ? `Edit application ${row.id}` : `Modifier la candidature ${row.id}`,
    editableFields: ["ad_id", "person_id", "message"],
    columns: [{ key: "id", label: { fr: "Identifiant", en: "ID" } }, { key: "ad_id", label: { fr: "Identifiant de l'annonce", en: "Job offer ID" } }, { key: "person_id", label: { fr: "Identifiant de la personne", en: "Person ID" } }, { key: "message", label: { fr: "Message", en: "Message" } }, { key: "status", label: { fr: "Statut", en: "Status" } }, { key: "created_at", label: { fr: "Date de création", en: "Creation date" } }],
  },
};
