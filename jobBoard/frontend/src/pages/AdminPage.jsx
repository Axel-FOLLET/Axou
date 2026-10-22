// Page d'administration : un seul écran CRUD pour les cinq tables de l'API.
import { AuthContext } from "../AuthContext";
import { useContext, useState, useEffect, Fragment } from "react";
import { Link } from "react-router";
import { apiFetch } from "../api.js";
import { tables } from "../adminTables.js";
import { useLang } from "../lang.js";

// Textes longs : zone de texte dans le panneau, une seule ligne coupée dans le tableau.
const LONG_FIELDS = ["description", "short_description", "message"];
// Chiffres seuls : clavier numérique sur téléphone.
const NUMERIC_FIELDS = ["siren", "salary", "company_id", "category_id", "contact_id", "ad_id", "person_id"];

export default function AdminPage() {
  const { user } = useContext(AuthContext);
  const { t, lang } = useLang();
  // Table affichée et pagination : tout changement relance l'appel réseau ci-dessous.
  const [selectedTable, setSelectedTable] = useState("companies");
  const [rows, setRows] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [perPage, setPerPage] = useState(10);
  // Sens du tri fait par l'API (paramètre order) : "asc" = plus anciens d'abord, "desc" = plus récents d'abord.
  const [order, setOrder] = useState("asc");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  // refresh : incrémenté à la main pour forcer un rechargement après une suppression ou un ajout.
  const [refresh, setRefresh] = useState(0);
  // editingRow = la ligne en cours de modification (null si aucune) ; isCreating = formulaire d'ajout.
  const [editingRow, setEditingRow] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [editError, setEditError] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Un seul appel réseau, relancé dès qu'une des dépendances listées en bas change.
  useEffect(() => {
    // Page réservée : on ne demande rien à l'API si la personne n'est pas administratrice.
    if (!user || user.role !== 'admin') {
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const { ok, status, data, total } = await apiFetch(
          `/api/admin/${selectedTable}?page=${currentPage}&per_page=${perPage}&order=${order}`
        );
        if (!ok) {
          throw new Error(`Erreur HTTP ! statut : ${status}`);
        }
        setRows(data);
        // Nombre de pages déduit de l'en-tête X-Total-Count renvoyé par l'API.
        setTotalPages(Math.ceil(Number(total) / perPage));
      } catch (err) {
        // Message pour l'écran ; le détail technique reste dans la console.
        // "load" : texte choisi à l'affichage, dans la langue courante.
        setError("load");
        console.error("Erreur lors de la récupération des données :", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedTable, user, currentPage, perPage, order, refresh]);

  // Panneau ouvert : la touche Échap le ferme, sauf pendant un envoi.
  const formOpen = isCreating || editingRow !== null;
  useEffect(() => {
    if (!formOpen) return;
    function handleKey(e) {
      if (e.key === "Escape" && !editSaving) {
        setEditingRow(null);
        setIsCreating(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [formOpen, editSaving]);

  // --- Suppression ---
  async function handleDelete(id) {
    // Confirmation avant tout appel : la suppression est définitive côté API.
    if (!window.confirm(t("Supprimer cette ligne ?", "Delete this row?"))) { return; }
    setError(null);
    try {
      const { status, error: apiError } = await apiFetch(`/api/admin/${selectedTable}/${id}`, { method: 'DELETE' });
      // 204 : succès sans contenu, il n'y a rien à lire dans la réponse.
      if (status === 204) {
        // Dernière ligne d'une page au-delà de la première : on recule pour ne pas afficher une page vide.
        if (rows.length === 1 && currentPage > 1) {
          setCurrentPage((prev) => prev - 1);
        }
        setRefresh((prev) => prev + 1);
        return;
      }
      // Un message français par code de l'API ; 409 = ligne encore utilisée ailleurs.
      const messages = {
        // 0 : serveur injoignable, signalé par apiFetch au lieu d'une exception.
        0: t("Le serveur est injoignable. La suppression n'a pas pu être confirmée.", "The server cannot be reached. The deletion could not be confirmed."),
        401: t("Votre session a expiré. Merci de vous reconnecter.", "Your session has expired. Please log in again."),
        403: t("Cette action est réservée à l'administration.", "This action is restricted to administrators."),
        404: t("Cette ligne n'existe plus.", "This row no longer exists."),
        409: t("Impossible de supprimer : cette ligne est utilisée ailleurs.", "Cannot delete: this row is used elsewhere."),
      };
      setError(messages[status] || t("La suppression a échoué. Merci de réessayer.", "The deletion failed. Please try again."));
      console.error("Suppression refusée :", status, apiError);
    } catch (err) {
      setError(t("Le serveur est injoignable. La suppression n'a pas pu être confirmée.", "The server cannot be reached. The deletion could not be confirmed."));
      console.error("Erreur lors de la suppression :", err);
    }
  }

  // --- Ajout et modification : le même formulaire sert aux deux ---
  async function handleUpdate(e) {
    e.preventDefault();
    // Envoi déjà en cours, ou aucune ligne ni création en cours : on ignore.
    if (editSaving || (!isCreating && !editingRow)) return;
    setEditError(null);

    // SIREN contrôlé avant l'envoi, et seulement s'il change : neuf chiffres exactement.
    if (selectedTable === "companies") {
      const siren = String(editValues.siren ?? "").trim();
      const previousSiren = String(editingRow?.siren ?? "").trim();
      if (isCreating || siren !== previousSiren) {
        if (!siren) {
          setEditError(t("Le SIREN est obligatoire.", "The SIREN is required."));
          return;
        }
        if (!/^[0-9]{9}$/.test(siren)) {
          setEditError(t("Le SIREN doit contenir exactement neuf chiffres.", "The SIREN must contain exactly nine digits."));
          return;
        }
      }
    }

    // changes = ce qui partira réellement à l'API.
    const changes = {};
    // Ces champs sont des nombres pour l'API, alors qu'un <input> renvoie toujours du texte.
    const numericFields = ["salary", "company_id", "category_id", "contact_id", "ad_id", "person_id"];
    for (const field of tables[selectedTable].editableFields) {
      // Création : un champ laissé vide n'est pas envoyé.
      if (isCreating && String(editValues[field] ?? "").trim() === "") {
        continue;
      }

      // Modification : un champ inchangé n'est pas envoyé, le PATCH reste partiel.
      if (
        !isCreating &&
        String(editValues[field] ?? "") === String(editingRow[field] ?? "")
      ) {
        continue;
      }

      let value = editValues[field];
      // SIREN envoyé en texte pour conserver un éventuel zéro initial.
      if (field === "siren") value = String(value).trim();
      if (numericFields.includes(field)) {
        // Salaire et contact facultatifs : vide devient null.
        if (String(value).trim() === "" && ["salary", "contact_id"].includes(field)) {
          value = null;
        } else {
          // Les autres champs numériques doivent être des entiers.
          if (String(value).trim() === "" || !Number.isInteger(Number(value))) {
            setEditError(t("Valeur refusée pour ce champ.", "Value rejected for this field."));
            return;
          }
          value = Number(value);
        }
      }
      changes[field] = value;
    }

    // Rien n'a changé : on le dit sans appeler l'API.
    if (!isCreating && Object.keys(changes).length === 0) {
      setEditError(t("Aucune modification à enregistrer.", "No changes to save."));
      return;
    }

    setEditSaving(true);
    try {
      // Même formulaire, deux routes : POST pour créer, PATCH pour modifier.
      const { ok, status, data, error: apiError } = await apiFetch(
        isCreating
          ? `/api/admin/${selectedTable}`
          : `/api/admin/${selectedTable}/${editingRow.id}`,
        {
          method: isCreating ? "POST" : "PATCH",
          body: changes,
        }
      );
      // Succès : un ajout recharge la page, une modification remplace la ligne sur place.
      if (ok) {
        const savedRow = data;
        if (isCreating) {
          setIsCreating(false);
          setRefresh((prev) => prev + 1);
        } else {
          setRows((prev) => prev.map(
            (row) => row.id === savedRow.id ? savedRow : row
          ));
          setEditingRow(null);
        }
        return;
      }

      // « Missing field: <nom> » renvoyé par l'API, traduit champ par champ.
      if (status === 400 && apiError.startsWith("Missing field: ")) {
        const field = apiError.slice("Missing field: ".length);
        const requiredMessages = {
          name: t("Le nom est obligatoire.", "The name is required."),
          siren: t("Le SIREN est obligatoire.", "The SIREN is required."),
          first_name: t("Le prénom est obligatoire.", "The first name is required."),
          last_name: t("Le nom est obligatoire.", "The last name is required."),
          email: t("L'adresse e-mail est obligatoire.", "The email address is required."),
          title: t("Le titre est obligatoire.", "The title is required."),
          short_description: t("La description courte est obligatoire.", "The short description is required."),
          company_id: t("L'entreprise est obligatoire.", "The company is required."),
          category_id: t("La catégorie est obligatoire.", "The category is required."),
          ad_id: t("L'annonce est obligatoire.", "The job offer is required."),
          person_id: t("La personne est obligatoire.", "The person is required."),
          message: t("Le message est obligatoire.", "The message is required."),
        };
        setEditError(requiredMessages[field] || t("Un champ obligatoire manque.", "A required field is missing."));
        console.error("Champ obligatoire manquant :", data);
        return;
      }
      // Autres refus : d'abord le message de l'API, puis le code HTTP, puis un message générique.
      const messages = {
        "No fields to update": t("Aucune modification à enregistrer.", "No changes to save."),
        "Already exists": t("Cette valeur est déjà utilisée.", "This value is already in use."),
        "Unknown reference": t("L'entreprise, la catégorie ou la personne indiquée n'existe pas.", "The specified company, category or person does not exist."),
        "Invalid value": t("Valeur refusée pour ce champ.", "Value rejected for this field."),
      };
      const statusMessages = {
        // 0 : serveur injoignable, signalé par apiFetch au lieu d'une exception.
        0: t("L'enregistrement n'a pas pu être confirmé. Merci de réessayer.", "Saving could not be confirmed. Please try again."),
        401: t("Votre session a expiré. Merci de vous reconnecter.", "Your session has expired. Please log in again."),
        403: t("Cette action est réservée à l'administration.", "This action is restricted to administrators."),
        404: t("Cette ligne n'existe plus.", "This row no longer exists."),
      };
      setEditError(messages[apiError] || statusMessages[status] || t("L'enregistrement a échoué. Merci de réessayer.", "Saving failed. Please try again."));
      console.error("Modification refusée :", status, apiError);
    } catch (err) {
      setEditError(t("L'enregistrement n'a pas pu être confirmé. Merci de réessayer.", "Saving could not be confirmed. Please try again."));
      console.error("Erreur lors de la modification :", err);
    } finally {
      setEditSaving(false);
    }
  }

  // --- Formulaire ---
  function handleCreate() {
    // « Ajouter » ouvre le même formulaire, tous les champs vides.
    const emptyValues = {};

    for (const field of tables[selectedTable].editableFields) {
      emptyValues[field] = "";
    }

    setEditingRow(null);
    setEditValues(emptyValues);
    setEditError(null);
    setIsCreating(true);
  }

  // Fermer le panneau d'ajout ou de modification, sauf pendant un envoi.
  function closeForm() {
    if (editSaving) return;
    setEditingRow(null);
    setIsCreating(false);
  }

  // Un seul formulaire pour l'ajout et la modification, construit depuis editableFields.
  // Il s'ouvre dans un panneau à droite : le tableau reste visible derrière, les boutons restent en bas du panneau.
  function renderForm() {
    return (
      <div className="admin-drawer-backdrop" onClick={closeForm}>
        {/* stopPropagation : un clic dans le panneau ne doit pas le fermer, seul un clic sur le fond le fait. */}
        <aside
          className="admin-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-drawer-title"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleUpdate}>
            <h2 id="admin-drawer-title">
              {isCreating
                ? tables[selectedTable].addLabel[lang]
                : tables[selectedTable].editTitle(editingRow, lang)}
            </h2>

            <div className="admin-drawer-fields">
              {/* Un champ par entrée de editableFields ; le libellé vient de columns. Les textes longs ont une zone de texte. */}
              {tables[selectedTable].editableFields.map((field, index) => {
                const column = tables[selectedTable].columns.find(
                  (column) => column.key === field
                );
                const isLong = LONG_FIELDS.includes(field);
                const props = {
                  autoFocus: index === 0,
                  disabled: editSaving,
                  value: editValues[field] ?? "",
                  onChange: (e) =>
                    setEditValues((prev) => ({
                      ...prev,
                      [field]: e.target.value,
                    })),
                };

                return (
                  <label key={field}>
                    {column.label[lang]}
                    {isLong ? (
                      <textarea {...props} />
                    ) : (
                      <input
                        type="text"
                        inputMode={NUMERIC_FIELDS.includes(field) ? "numeric" : undefined}
                        {...props}
                      />
                    )}
                  </label>
                );
              })}
            </div>

            <div className="admin-drawer-actions">
              {editError && <p role="alert">{editError}</p>}
              <button type="submit" disabled={editSaving}>
                {editSaving ? t("Enregistrement…", "Saving…") : t("Enregistrer", "Save")}
              </button>
              <button type="button" className="button-secondary" disabled={editSaving} onClick={closeForm}>
                {t("Annuler", "Cancel")}
              </button>
            </div>
          </form>
        </aside>
      </div>
    );
  }

  // Garde-fou d'affichage : sans rôle admin, la page ne montre aucune donnée.
  if (!user || user.role !== 'admin') {
    return (
      <div className="page">
        <p>{t("Cette page est réservée à l'administration.", "This page is restricted to administrators.")}</p>
        {user === null && <Link to="/login">{t("Se connecter", "Log in")}</Link>}
      </div>
    )};

  return (
    <div className="page admin-page">
      <h1>{t("Administration", "Admin")}</h1>
      {/* tab-bar (tabs.css) : le choix des tables reste collé sous l'en-tête pendant le défilement. */}
      <div className="tab-bar">
        <div className="admin-tabs">
          {/* Un bouton par table ; changer de table remet la pagination et ferme le formulaire. */}
          {Object.keys(tables).map((table) => (
            <button key={table} type="button" aria-pressed={selectedTable === table} disabled={editSaving} onClick={() => {
              setSelectedTable(table);
              setCurrentPage(1);
              setEditingRow(null);
              setEditError(null);
              setIsCreating(false);
            }}>
              {tables[table].title[lang]}
            </button>
          ))}
        </div>
      </div>
      <h2>{tables[selectedTable].title[lang]}</h2>

      

      <div className="admin-pagination">
      <label>{t("Lignes par page :", "Rows per page:")}
        <select value={perPage} onChange={(e) => {
          setPerPage(Number(e.target.value));
          setCurrentPage(1);
        }}>
          <option value={10}>{t("10 par page", "10 per page")}</option>
          <option value={25}>{t("25 par page", "25 per page")}</option>
          <option value={50}>{t("50 par page", "50 per page")}</option>
        </select>
      </label>
      {/* Flèche du tri : tout le tableau est retrié par l'API, on repart donc de la page 1. */}
      <button type="button" className="button-secondary" onClick={() => {
        setOrder(order === "asc" ? "desc" : "asc");
        setCurrentPage(1);
      }}>
        {order === "asc" ? t("Plus anciens d'abord ↑", "Oldest first ↑") : t("Plus récents d'abord ↓", "Newest first ↓")}
      </button>
      </div>
      <div className="admin-add">
        <button
          type="button"
          disabled={editSaving}
          onClick={handleCreate}
        >
          {tables[selectedTable].addLabel[lang]}
        </button>
      </div>
      {/* Ajout ou modification : un seul panneau latéral, au-dessus de la page. */}
      {formOpen && renderForm()}
      {/* Quatre affichages possibles : chargement, erreur, tableau vide, puis les données. */}
      {loading ? (
        <p>{t("Chargement…", "Loading…")}</p>
      ) : error ? (
        <p>{error === "load" ? t("Nous n'arrivons pas à charger ces données pour le moment. Merci de réessayer dans quelques instants.", "We cannot load this data at the moment. Please try again in a few moments.") : error}</p>
      ) : rows.length === 0 ? (
        <p>{t("Aucune donnée disponible pour l'instant.", "No data available yet.")}</p>
      ) : (
        <>
        <div className="table-scroll" role="region" aria-label={tables[selectedTable].title[lang]} tabIndex={0}>
        <table>
          <thead>
            <tr>
              {/* Un en-tête par colonne ; celui des boutons n'est lu que par les lecteurs d'écran. */}
              {tables[selectedTable].columns.map((column) => (
                <th key={column.key}>{column.label[lang]}</th>
              ))}
              <th className="col-actions"><span className="visually-hidden">{t("Actions", "Actions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr>
                  {/* Textes longs coupés sur une ligne ; le texte entier s'affiche au survol et dans le panneau. */}
                  {tables[selectedTable].columns.map((column) => (
                    LONG_FIELDS.includes(column.key)
                      ? <td key={column.key} className="cell-clip" title={row[column.key] ?? ""}>{row[column.key]}</td>
                      : <td key={column.key}>{row[column.key]}</td>
                  ))}
                  {/* Actions groupées dans une seule cellule, la modification d'abord ; colonne collée à droite (admin.css). */}
                  <td className="col-actions">
                    <div className="row-actions">
                      <button type="button" className="button-secondary" disabled={editSaving} onClick={() => {
                        setEditingRow(row);
                        setEditValues({ ...row });
                        setEditError(null);
                        setIsCreating(false);
                      }}>{t("Modifier", "Edit")}</button>
                      <button className="button-danger" type="button" onClick={() => handleDelete(row.id)}>{t("Supprimer", "Delete")}</button>
                    </div>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>
        {/* Pagination centrée sous le tableau, masquée tant que le nombre de pages est inconnu. */}
        {totalPages > 0 && (
          <div className="pagination-buttons">
            <button className="button-secondary" type="button" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
              {t("Précédent", "Previous")}
            </button>
            <span>{t(`Page ${currentPage} sur ${totalPages}`, `Page ${currentPage} of ${totalPages}`)}</span>
            <button className="button-secondary" type="button" onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
              {t("Suivant", "Next")}
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}
