/*
 * Contact form: field validation and sending without leaving the page.
 * The texts come from the data-* attributes of the form: a single script for FR and EN.
 * Without JavaScript, the form keeps the classic submission to Formspree.
 */

import { requireHuman } from "./human-check.js";


// -------------------- EVENTS --------------------

/*
 * Tells the rest of the page what happens to the form: contact:invalid (submission refused, a field is incorrect),
 * contact:sending, contact:sent and contact:error. The postman cube listens to them (postman-cube.js).
 * These events change nothing in the form itself.
 */
function announce(form, name) {
    form.dispatchEvent(new CustomEvent("contact:" + name, { bubbles: true }));
}


// -------------------- FIELD VALIDATION --------------------

/*
 * Shows the error message under a field, creating the paragraph only once.
 * aria-invalid flags the error; aria-describedby makes the message read with the field.
 */
function showFieldError(field, message) {
    const errorId = field.id + "-error";
    let error = document.getElementById(errorId);
    if (!error) {
        error = document.createElement("p");
        error.id = errorId;
        error.className = "form__error";
        field.after(error);
        field.setAttribute("aria-describedby", errorId);
    }
    error.textContent = message;
    field.setAttribute("aria-invalid", "true");
}


/*
 * Removes the message and the error attributes of a corrected field.
 */
function clearFieldError(field) {
    document.getElementById(field.id + "-error")?.remove();
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
}


/*
 * validity is provided by the browser from required and type="email".
 * A valid, filled field receives a tick (form__input--valid).
 */
function checkField(field, form) {
    if (field.validity.valueMissing) showFieldError(field, form.dataset.invalidRequired);
    else if (field.validity.typeMismatch) showFieldError(field, form.dataset.invalidEmail);
    else clearFieldError(field);
    field.classList.toggle("form__input--valid", field.validity.valid && field.value.trim() !== "");
}


/*
 * Checks a field when the visitor leaves it, not during the first typing.
 * A field already flagged is rechecked on every keystroke: the error disappears as soon as it is corrected.
 * On submission, "invalid" is fired on each incorrect field; this event does not bubble,
 * so true listens to it during its descent (capture). preventDefault replaces the browser bubble.
 * A refused submission is announced once, after the last incorrect field (setTimeout), whatever their number.
 */
function watchFields(form) {
    let refused = false;
    form.addEventListener("focusout", event => {
        if (event.target.classList.contains("form__input")) checkField(event.target, form);
    });
    form.addEventListener("input", event => {
        if (event.target.getAttribute("aria-invalid") === "true") checkField(event.target, form);
    });
    form.addEventListener("invalid", event => {
        event.preventDefault();
        checkField(event.target, form);
        form.querySelector("[aria-invalid='true']")?.focus();
        if (refused) return;
        refused = true;
        setTimeout(() => {
            refused = false;
            announce(form, "invalid");
        });
    }, true);
}


// -------------------- SENDING --------------------

// ms after which a send that gets no answer is cancelled and reported as failed
const SEND_TIMEOUT = 15000;


/*
 * Sends the fields to Formspree and returns true if the server accepted the message.
 * async allows waiting for the response with await; a network error returns false,
 * and so does a server that does not answer within SEND_TIMEOUT (AbortSignal.timeout cancels the request).
 */
async function sendForm(form) {
    try {
        const response = await fetch(form.action, {
            method: "POST",
            body: new FormData(form),
            headers: { "Accept": "application/json" },
            signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(SEND_TIMEOUT) : undefined
        });
        return response.ok;
    } catch {
        return false;
    }
}


// ms during which the button shows the "sent" label before getting its text back
const SENT_DURATION = 2600;


/*
 * Success: the button shows the "sent" label with a tick that draws itself (contact.css), then goes back to normal.
 */
/*
 * The original text is kept on the first send: a second send during the "sent" label does not replace it.
 * The previous timer is cancelled: the button gets its text back 2.6 s after the last send.
 */
function flashSent(button, label) {
    button.dataset.label ??= button.textContent;
    clearTimeout(button.sentTimer);
    button.textContent = label;
    button.classList.add("button--sent");
    button.sentTimer = setTimeout(() => {
        button.textContent = button.dataset.label;
        button.classList.remove("button--sent");
    }, SENT_DURATION);
}


/*
 * Failure: the button shakes once. Removing then re-adding the class restarts the animation;
 * reading offsetWidth forces the browser to take the removal into account before the addition.
 */
function shakeButton(button) {
    button.classList.remove("button--shake");
    void button.offsetWidth;
    button.classList.add("button--shake");
    button.addEventListener("animationend", () => button.classList.remove("button--shake"), { once: true });
}


/*
 * Keyboard users keep their place: if the focus was lost during the send (closed window, removed element),
 * it goes back to the send button.
 */
function keepFocus(submitButton) {
    if (!document.activeElement || document.activeElement === document.body) submitButton.focus();
}


/*
 * While sending, the button is marked aria-disabled and further sends are ignored, to avoid a double send;
 * it shows a spinner. aria-disabled rather than disabled: a disabled button loses the keyboard focus.
 * The status message (role="status") is read by screen readers; its class chooses
 * the confirmation or error box.
 */
function watchSubmit(form, status, submitButton) {
    let sending = false;
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (sending) return;
        sending = true;
        // Anti-robot box not validated yet: the window is mandatory, the sending follows
        await requireHuman();
        keepFocus(submitButton);
        submitButton.setAttribute("aria-disabled", "true");
        submitButton.classList.add("button--loading");
        status.className = "form__status";
        status.textContent = form.dataset.sending;
        announce(form, "sending");
        const isSent = await sendForm(form);
        // Announced before the fields are emptied
        announce(form, isSent ? "sent" : "error");
        status.textContent = isSent ? form.dataset.success : form.dataset.error;
        status.classList.add(isSent ? "form__status--success" : "form__status--error");
        if (isSent) {
            form.reset();
            form.querySelectorAll(".form__input--valid").forEach(field => field.classList.remove("form__input--valid"));
        }
        submitButton.classList.remove("button--loading");
        submitButton.removeAttribute("aria-disabled");
        sending = false;
        keepFocus(submitButton);
        if (isSent) flashSent(submitButton, form.dataset.sent);
        else shakeButton(submitButton);
    });
}


/*
 * The link of the notice points to a paragraph of the legal notice, collapsed in the footer:
 * the <details> block opens before the browser scrolls down to it.
 */
function watchNotice(form) {
    form.querySelectorAll(".form__notice a[href^='#']").forEach(link => {
        link.addEventListener("click", () => {
            const details = document.querySelector(link.hash)?.closest("details");
            if (details) details.open = true;
        });
    });
}


/*
 * Form missing from the page: the function stops.
 */
export function initContact() {
    const form = document.getElementById("contact-form");
    const status = document.getElementById("form-status");
    const submitButton = form?.querySelector("[type='submit']");
    if (!form || !status || !submitButton) return;
    watchFields(form);
    watchSubmit(form, status, submitButton);
    watchNotice(form);
}
