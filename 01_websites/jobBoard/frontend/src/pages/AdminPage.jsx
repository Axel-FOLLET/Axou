// Administration page: a single CRUD screen for the five API tables.
import { AuthContext } from "../AuthContext";
import { useContext, useState, useEffect, Fragment } from "react";
import { Link } from "react-router";
import { apiFetch } from "../api.js";
import { tables } from "../adminTables.js";
import { useLang } from "../lang.js";

// Long texts: text area in the panel, a single truncated line in the table.
const LONG_FIELDS = ["description", "short_description", "message"];
// Digits only: numeric keyboard on phones.
const NUMERIC_FIELDS = ["siren", "salary", "company_id", "category_id", "contact_id", "ad_id", "person_id"];

export default function AdminPage() {
  const { user } = useContext(AuthContext);
  const { t, lang } = useLang();
  // Displayed table and pagination: any change restarts the network call below.
  const [selectedTable, setSelectedTable] = useState("companies");
  const [rows, setRows] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [perPage, setPerPage] = useState(10);
  // Sort direction done by the API (order parameter): "asc" = oldest first, "desc" = most recent first.
  const [order, setOrder] = useState("asc");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  // refresh: incremented by hand to force a reload after a deletion or an addition.
  const [refresh, setRefresh] = useState(0);
  // editingRow = the row being edited (null if none); isCreating = add form.
  const [editingRow, setEditingRow] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [editError, setEditError] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // A single network call, restarted as soon as one of the dependencies listed at the bottom changes.
  useEffect(() => {
    // Reserved page: nothing is requested from the API if the person is not an administrator.
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
          throw new Error(`HTTP error! status: ${status}`);
        }
        setRows(data);
        // Number of pages derived from the X-Total-Count header returned by the API.
        setTotalPages(Math.ceil(Number(total) / perPage));
      } catch (err) {
        // Message for the screen; the technical detail stays in the console.
        // "load": text chosen at display time, in the current language.
        setError("load");
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedTable, user, currentPage, perPage, order, refresh]);

  // Panel open: the Escape key closes it, except during a save.
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

  // --- Deletion ---
  async function handleDelete(id) {
    // Confirmation before any call: deletion is definitive on the API side.
    if (!window.confirm(t("Supprimer cette ligne ?", "Delete this row?"))) { return; }
    setError(null);
    try {
      const { status, error: apiError } = await apiFetch(`/api/admin/${selectedTable}/${id}`, { method: 'DELETE' });
      // 204: success with no content, there is nothing to read in the response.
      if (status === 204) {
        // Last row of a page beyond the first: go back so as not to show an empty page.
        if (rows.length === 1 && currentPage > 1) {
          setCurrentPage((prev) => prev - 1);
        }
        setRefresh((prev) => prev + 1);
        return;
      }
      // One message per API code; 409 = row still used elsewhere.
      const messages = {
        // 0: server unreachable, reported by apiFetch instead of an exception.
        0: t("Le serveur est injoignable. La suppression n'a pas pu être confirmée.", "The server cannot be reached. The deletion could not be confirmed."),
        401: t("Votre session a expiré. Merci de vous reconnecter.", "Your session has expired. Please log in again."),
        403: t("Cette action est réservée à l'administration.", "This action is restricted to administrators."),
        404: t("Cette ligne n'existe plus.", "This row no longer exists."),
        409: t("Impossible de supprimer : cette ligne est utilisée ailleurs.", "Cannot delete: this row is used elsewhere."),
      };
      setError(messages[status] || t("La suppression a échoué. Merci de réessayer.", "The deletion failed. Please try again."));
      console.error("Deletion refused:", status, apiError);
    } catch (err) {
      setError(t("Le serveur est injoignable. La suppression n'a pas pu être confirmée.", "The server cannot be reached. The deletion could not be confirmed."));
      console.error("Error while deleting:", err);
    }
  }

  // --- Add and edit: the same form serves both ---
  async function handleUpdate(e) {
    e.preventDefault();
    // Sending already in progress, or no row or creation in progress: ignore.
    if (editSaving || (!isCreating && !editingRow)) return;
    setEditError(null);

    // SIREN checked before sending, and only if it changes: exactly nine digits.
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

    // changes = what will really be sent to the API.
    const changes = {};
    // These fields are numbers for the API, whereas an <input> always returns text.
    const numericFields = ["salary", "company_id", "category_id", "contact_id", "ad_id", "person_id"];
    for (const field of tables[selectedTable].editableFields) {
      // Creation: a field left empty is not sent.
      if (isCreating && String(editValues[field] ?? "").trim() === "") {
        continue;
      }

      // Edit: an unchanged field is not sent, the PATCH stays partial.
      if (
        !isCreating &&
        String(editValues[field] ?? "") === String(editingRow[field] ?? "")
      ) {
        continue;
      }

      let value = editValues[field];
      // SIREN sent as text to keep a possible leading zero.
      if (field === "siren") value = String(value).trim();
      if (numericFields.includes(field)) {
        // Salary and contact are optional: empty becomes null.
        if (String(value).trim() === "" && ["salary", "contact_id"].includes(field)) {
          value = null;
        } else {
          // The other numeric fields must be integers.
          if (String(value).trim() === "" || !Number.isInteger(Number(value))) {
            setEditError(t("Valeur refusée pour ce champ.", "Value rejected for this field."));
            return;
          }
          value = Number(value);
        }
      }
      changes[field] = value;
    }

    // Nothing changed: say so without calling the API.
    if (!isCreating && Object.keys(changes).length === 0) {
      setEditError(t("Aucune modification à enregistrer.", "No changes to save."));
      return;
    }

    setEditSaving(true);
    try {
      // Same form, two routes: POST to create, PATCH to edit.
      const { ok, status, data, error: apiError } = await apiFetch(
        isCreating
          ? `/api/admin/${selectedTable}`
          : `/api/admin/${selectedTable}/${editingRow.id}`,
        {
          method: isCreating ? "POST" : "PATCH",
          body: changes,
        }
      );
      // Success: an addition reloads the page, an edit replaces the row in place.
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

      // "Missing field: <name>" returned by the API, translated field by field.
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
        console.error("Missing required field:", data);
        return;
      }
      // Other refusals: first the API message, then the HTTP code, then a generic message.
      const messages = {
        "No fields to update": t("Aucune modification à enregistrer.", "No changes to save."),
        "Already exists": t("Cette valeur est déjà utilisée.", "This value is already in use."),
        "Unknown reference": t("L'entreprise, la catégorie ou la personne indiquée n'existe pas.", "The specified company, category or person does not exist."),
        "Invalid value": t("Valeur refusée pour ce champ.", "Value rejected for this field."),
      };
      const statusMessages = {
        // 0: server unreachable, reported by apiFetch instead of an exception.
        0: t("L'enregistrement n'a pas pu être confirmé. Merci de réessayer.", "Saving could not be confirmed. Please try again."),
        401: t("Votre session a expiré. Merci de vous reconnecter.", "Your session has expired. Please log in again."),
        403: t("Cette action est réservée à l'administration.", "This action is restricted to administrators."),
        404: t("Cette ligne n'existe plus.", "This row no longer exists."),
      };
      setEditError(messages[apiError] || statusMessages[status] || t("L'enregistrement a échoué. Merci de réessayer.", "Saving failed. Please try again."));
      console.error("Update refused:", status, apiError);
    } catch (err) {
      setEditError(t("L'enregistrement n'a pas pu être confirmé. Merci de réessayer.", "Saving could not be confirmed. Please try again."));
      console.error("Error while updating:", err);
    } finally {
      setEditSaving(false);
    }
  }

  // --- Form ---
  function handleCreate() {
    // "Add" opens the same form, all fields empty.
    const emptyValues = {};

    for (const field of tables[selectedTable].editableFields) {
      emptyValues[field] = "";
    }

    setEditingRow(null);
    setEditValues(emptyValues);
    setEditError(null);
    setIsCreating(true);
  }

  // Close the add or edit panel, except during a save.
  function closeForm() {
    if (editSaving) return;
    setEditingRow(null);
    setIsCreating(false);
  }

  // A single form for adding and editing, built from editableFields.
  // It opens in a panel on the right: the table stays visible behind it, the buttons stay at the bottom of the panel.
  function renderForm() {
    return (
      <div className="admin-drawer-backdrop" onClick={closeForm}>
        {/* stopPropagation: a click inside the panel must not close it, only a click on the backdrop does. */}
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
              {/* One field per entry of editableFields; the label comes from columns. Long texts get a text area. */}
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

  // Display guard: without the admin role, the page shows no data.
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
      {/* tab-bar (tabs.css): the table choice stays stuck under the header while scrolling. */}
      <div className="tab-bar">
        <div className="admin-tabs">
          {/* One button per table; changing table resets the pagination and closes the form. */}
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
      {/* Sort arrow: the whole table is re-sorted by the API, so start again from page 1. */}
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
      {/* Add or edit: a single side panel, above the page. */}
      {formOpen && renderForm()}
      {/* Four possible displays: loading, error, empty table, then the data. */}
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
              {/* One header per column; the one of the buttons is read only by screen readers. */}
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
                  {/* Long texts truncated to one line; the whole text shows on hover and in the panel. */}
                  {tables[selectedTable].columns.map((column) => (
                    LONG_FIELDS.includes(column.key)
                      ? <td key={column.key} className="cell-clip" title={row[column.key] ?? ""}>{row[column.key]}</td>
                      : <td key={column.key}>{row[column.key]}</td>
                  ))}
                  {/* Actions grouped in a single cell, edit first; column stuck to the right (admin.css). */}
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
        {/* Pagination centered under the table, hidden while the number of pages is unknown. */}
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
