// --- Description des tables ---
// Une entrée par table de l'API. columns = ce qui s'affiche, editableFields = ce que
// l'API accepte en écriture (source : docs/contrat_api.md). Tout le reste de la page
// se construit depuis cet objet, sans code propre à une table.
export const tables = {
  companies: {
    title: "Entreprises",
    addLabel: "Ajouter une entreprise",
    editTitle: (row) => `Modifier ${row.name}`,
    editableFields: ["name", "siren", "description", "location", "website"],
    columns: [{ key: "id", label: "Identifiant" }, { key: "name", label: "Nom" }, { key: "siren", label: "SIREN" }, { key: "description", label: "Description" }, { key: "location", label: "Lieu" }, { key: "website", label: "Site web" }],
  },
  categories: {
    title: "Catégories",
    addLabel: "Ajouter une catégorie",
    editTitle: (row) => `Modifier ${row.name}`,
    editableFields: ["name"],
    columns: [{ key: "id", label: "Identifiant" }, { key: "name", label: "Nom" }],
  },
  people: {
    title: "Personnes",
    addLabel: "Ajouter une personne",
    editTitle: (row) => `Modifier ${row.first_name} ${row.last_name}`,
    editableFields: ["first_name", "last_name", "email", "phone", "role", "company_id"],
    columns: [{ key: "id", label: "Identifiant" }, { key: "first_name", label: "Prénom" }, { key: "last_name", label: "Nom" }, { key: "email", label: "Adresse e-mail" }, { key: "phone", label: "Téléphone" }, { key: "role", label: "Rôle" }, { key: "company_id", label: "Identifiant de l'entreprise" }],
  },
  ads: {
    title: "Annonces",
    addLabel: "Ajouter une annonce",
    editTitle: (row) => `Modifier ${row.title}`,
    editableFields: ["title", "short_description", "description", "salary", "location", "working_time", "contract_type", "company_id", "category_id", "contact_id"],
    // status et created_at sont affichés mais absents de editableFields : l'API les refuse en écriture.
    columns: [{ key: "id", label: "Identifiant" }, { key: "title", label: "Titre" }, { key: "short_description", label: "Description courte" }, { key: "description", label: "Description" }, { key: "salary", label: "Salaire" }, { key: "location", label: "Lieu" }, { key: "working_time", label: "Temps de travail" }, { key: "contract_type", label: "Type de contrat" }, { key: "status", label: "Statut" }, { key: "created_at", label: "Date de création" }, { key: "company_id", label: "Identifiant de l'entreprise" }, { key: "category_id", label: "Identifiant de la catégorie" }, { key: "contact_id", label: "Identifiant du contact" }],
  },
  applications: {
    title: "Candidatures",
    addLabel: "Ajouter une candidature",
    editTitle: (row) => `Modifier la candidature ${row.id}`,
    editableFields: ["ad_id", "person_id", "message"],
    columns: [{ key: "id", label: "Identifiant" }, { key: "ad_id", label: "Identifiant de l'annonce" }, { key: "person_id", label: "Identifiant de la personne" }, { key: "message", label: "Message" }, { key: "status", label: "Statut" }, { key: "created_at", label: "Date de création" }],
  },
};
