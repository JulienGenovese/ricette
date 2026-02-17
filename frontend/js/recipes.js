import { state } from "./state.js";
import { API } from "./api.js";
import { escapeHtml, showToast } from "./helpers.js";

/* ===== Add Recipe Wizard ===== */

const WIZARD_TOTAL_STEPS = 6;
const WIZARD_STEP_LABELS = ["Categoria", "Nome", "Ingredienti", "Stagione", "Nutrienti", "Riepilogo"];

export function selectChip(btn, field) {
    const container = btn.parentElement;
    container.querySelectorAll(".wizard-chip").forEach((c) => c.classList.remove("selected"));
    btn.classList.add("selected");
    state.wizardData[field] = btn.dataset.value;
}

export function wizardNext() {
    if (!validateWizardStep()) return;

    if (state.wizardStep === 5) {
        renderWizardSummary();
    }

    if (state.wizardStep === WIZARD_TOTAL_STEPS) {
        submitRecipe();
        return;
    }

    saveWizardInputs();
    state.wizardStep++;
    renderWizardStep();
}

export function wizardPrev() {
    if (state.wizardStep <= 1) return;
    saveWizardInputs();
    state.wizardStep--;
    renderWizardStep();
}

function wizardGoToStep(step) {
    if (step < 1 || step > WIZARD_TOTAL_STEPS) return;
    if (step > state.wizardStep) return;
    saveWizardInputs();
    state.wizardStep = step;
    renderWizardStep();
}

function saveWizardInputs() {
    if (state.wizardStep === 2) {
        state.wizardData.name = document.getElementById("recipe-name-input").value.trim();
    } else if (state.wizardStep === 3) {
        state.wizardData.ingredients = document.getElementById("recipe-ingredients-input").value.trim();
    }
}

function validateWizardStep() {
    switch (state.wizardStep) {
        case 1: if (!state.wizardData.category) { showToast("Seleziona una categoria", "warning"); return false; } break;
        case 2:
            state.wizardData.name = document.getElementById("recipe-name-input").value.trim();
            if (!state.wizardData.name) { showToast("Inserisci il nome della ricetta", "warning"); return false; }
            break;
        case 3:
            state.wizardData.ingredients = document.getElementById("recipe-ingredients-input").value.trim();
            if (!state.wizardData.ingredients) { showToast("Inserisci gli ingredienti", "warning"); return false; }
            break;
        case 4: if (!state.wizardData.seasonality) { showToast("Seleziona la stagionalita'", "warning"); return false; } break;
        case 5: if (!state.wizardData.source1) { showToast("Seleziona la fonte principale", "warning"); return false; } break;
    }
    return true;
}

function renderWizardStep() {
    for (let i = 1; i <= WIZARD_TOTAL_STEPS; i++) {
        const el = document.getElementById(`wizard-step-${i}`);
        if (el) el.classList.toggle("hidden", i !== state.wizardStep);
    }
    document.getElementById("wizard-success").classList.add("hidden");
    document.getElementById("wizard-nav").classList.remove("hidden");

    const pct = (state.wizardStep / WIZARD_TOTAL_STEPS) * 100;
    document.getElementById("wizard-progress-bar").style.width = `${pct}%`;
    document.getElementById("wizard-step-label").textContent = `Step ${state.wizardStep} di ${WIZARD_TOTAL_STEPS}`;

    renderWizardBreadcrumb();

    document.getElementById("wizard-prev").classList.toggle("hidden", state.wizardStep === 1);
    const nextBtn = document.getElementById("wizard-next");
    nextBtn.textContent = state.wizardStep === WIZARD_TOTAL_STEPS ? "Salva" : "Avanti";

    if (state.wizardStep === 2) {
        document.getElementById("recipe-name-input").value = state.wizardData.name;
    } else if (state.wizardStep === 3) {
        document.getElementById("recipe-ingredients-input").value = state.wizardData.ingredients;
    }
}

export function renderWizardBreadcrumb() {
    const bc = document.getElementById("wizard-breadcrumb");
    bc.innerHTML = "";
    for (let i = 1; i <= WIZARD_TOTAL_STEPS; i++) {
        const step = document.createElement("div");
        step.className = "wizard-breadcrumb-step";
        if (i < state.wizardStep) step.classList.add("completed");
        if (i === state.wizardStep) step.classList.add("active");
        step.title = WIZARD_STEP_LABELS[i - 1];
        step.onclick = () => wizardGoToStep(i);
        bc.appendChild(step);
    }
}

function renderWizardSummary() {
    const categoryLabels = { "PRIMI": "Primi", "SECONDI": "Secondi", "PIATTI UNICI": "Piatti Unici", "CONTORNI": "Contorni" };
    const summary = document.getElementById("wizard-summary");
    summary.innerHTML = `
        <div class="summary-row"><span class="summary-label">Categoria</span><span class="summary-value">${escapeHtml(categoryLabels[state.wizardData.category] || state.wizardData.category)}</span></div>
        <div class="summary-row"><span class="summary-label">Nome</span><span class="summary-value">${escapeHtml(state.wizardData.name)}</span></div>
        <div class="summary-row"><span class="summary-label">Ingredienti</span><span class="summary-value">${escapeHtml(state.wizardData.ingredients)}</span></div>
        <div class="summary-row"><span class="summary-label">Stagionalita'</span><span class="summary-value">${escapeHtml(state.wizardData.seasonality)}</span></div>
        <div class="summary-row"><span class="summary-label">Fonte principale</span><span class="summary-value">${escapeHtml(state.wizardData.source1)}</span></div>
        <div class="summary-row"><span class="summary-label">Fonte secondaria</span><span class="summary-value">${escapeHtml(state.wizardData.source2 || "Nessuna")}</span></div>
    `;
}

async function submitRecipe() {
    const nextBtn = document.getElementById("wizard-next");
    nextBtn.disabled = true;
    nextBtn.textContent = "Salvataggio...";

    const recipeData = {
        category: state.wizardData.category,
        name: state.wizardData.name,
        ingredients: state.wizardData.ingredients,
        seasonality: state.wizardData.seasonality,
        source1: state.wizardData.source1,
        source2: state.wizardData.source2,
    };

    try {
        let message;
        if (state.currentUser) {
            const data = await API.addUserRecipe(recipeData);
            message = `Ricetta "${recipeData.name}" salvata nel tuo profilo!`;
        } else {
            const res = await fetch("/api/recipes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(recipeData),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Errore durante il salvataggio");
            }

            const data = await res.json();
            message = data.message;
        }

        for (let i = 1; i <= WIZARD_TOTAL_STEPS; i++) {
            document.getElementById(`wizard-step-${i}`).classList.add("hidden");
        }
        document.getElementById("wizard-nav").classList.add("hidden");
        document.getElementById("wizard-success").classList.remove("hidden");
        document.getElementById("wizard-success-msg").textContent = message;
        showToast("Ricetta salvata con successo!", "success");
        state.allRecipesCache = null;
    } catch (e) {
        showToast(e.message, "error");
    } finally {
        nextBtn.disabled = false;
        nextBtn.textContent = "Salva";
    }
}

export function resetWizard() {
    state.wizardStep = 1;
    state.wizardData.category = "";
    state.wizardData.name = "";
    state.wizardData.ingredients = "";
    state.wizardData.seasonality = "";
    state.wizardData.source1 = "";
    state.wizardData.source2 = "";

    document.querySelectorAll(".wizard-chip").forEach((c) => c.classList.remove("selected"));
    document.getElementById("recipe-name-input").value = "";
    document.getElementById("recipe-ingredients-input").value = "";

    renderWizardStep();
}

/* ===== Manage Recipes ===== */

export async function loadManageRecipes() {
    const grid = document.getElementById("manage-grid");
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;"><div class="spinner"></div></div>';

    try {
        state.allRecipesCache = await API.allDetails();
        renderManageGrid(state.allRecipesCache);
    } catch (e) {
        grid.innerHTML = `<p style="color: rgba(255,255,255,0.6); grid-column: 1/-1;">Errore caricamento ricette.</p>`;
    }
}

export function filterManageRecipes() {
    const query = document.getElementById("manage-search-input").value.toLowerCase();
    if (!state.allRecipesCache) return;

    if (!query) {
        renderManageGrid(state.allRecipesCache);
        return;
    }

    const filtered = state.allRecipesCache.filter((r) =>
        r.name.toLowerCase().includes(query) ||
        (r.ingredients && r.ingredients.toLowerCase().includes(query))
    );
    renderManageGrid(filtered);
}

function renderManageGrid(recipes) {
    const grid = document.getElementById("manage-grid");
    grid.innerHTML = "";

    if (recipes.length === 0) {
        grid.innerHTML = '<p style="color: rgba(255,255,255,0.6); grid-column: 1/-1; text-align: center; padding: 2rem;">Nessuna ricetta trovata.</p>';
        return;
    }

    for (const recipe of recipes) {
        const card = document.createElement("div");
        card.className = "manage-card";
        card.dataset.type = recipe.dish_type;

        const ingredientsText = typeof recipe.ingredients === "string" ? recipe.ingredients : "";

        card.innerHTML = `
            <div class="manage-card-header">
                <div class="manage-card-name">${escapeHtml(recipe.name)}</div>
                <div class="manage-card-type">${escapeHtml(recipe.dish_type)}</div>
            </div>
            <div class="manage-card-ingredients">${escapeHtml(ingredientsText)}</div>
            <div class="manage-card-meta">
                ${recipe.seasonality ? `<span class="manage-card-season">${escapeHtml(recipe.seasonality)}</span>` : ""}
                ${(recipe.nutrients || []).map((n) => `<span class="badge badge-${n}">${escapeHtml(n)}</span>`).join("")}
            </div>
            <div class="manage-card-actions">
                <button class="btn-edit" onclick="openEditModal('${escapeHtml(recipe.name).replace(/'/g, "\\'")}')">Modifica</button>
                <button class="btn-delete" onclick="openDeleteModal('${escapeHtml(recipe.name).replace(/'/g, "\\'")}')">Elimina</button>
            </div>
        `;

        grid.appendChild(card);
    }
}

/* ===== Modals ===== */

export function openDeleteModal(recipeName) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-title">Elimina ricetta</div>
                <div class="modal-body">Sei sicuro di voler eliminare <strong>${escapeHtml(recipeName)}</strong>? Questa azione non puo' essere annullata.</div>
                <div class="modal-actions">
                    <button class="btn-ghost" onclick="closeModal()">Annulla</button>
                    <button class="btn-primary" id="modal-confirm-delete" onclick="confirmDelete('${recipeName.replace(/'/g, "\\'")}')">Elimina</button>
                </div>
            </div>
        </div>
    `;
}

export async function confirmDelete(recipeName) {
    const btn = document.getElementById("modal-confirm-delete");
    btn.disabled = true;
    btn.textContent = "Eliminazione...";

    try {
        await API.deleteRecipe(recipeName);
        showToast(`"${recipeName}" eliminata`, "success");
        state.allRecipesCache = null;
        closeModal();
        loadManageRecipes();
    } catch (e) {
        showToast(e.message, "error");
        btn.disabled = false;
        btn.textContent = "Elimina";
    }
}

export function openEditModal(recipeName) {
    const recipe = state.allRecipesCache?.find((r) => r.name === recipeName);
    if (!recipe) return;

    const root = document.getElementById("modal-root");
    root.innerHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-title">Modifica ricetta</div>
                <div class="modal-field">
                    <label>Nome</label>
                    <input type="text" id="edit-name" value="${escapeHtml(recipe.name)}">
                </div>
                <div class="modal-field">
                    <label>Ingredienti</label>
                    <textarea id="edit-ingredients" rows="3">${escapeHtml(typeof recipe.ingredients === "string" ? recipe.ingredients : "")}</textarea>
                </div>
                <div class="modal-field">
                    <label>Stagionalita'</label>
                    <select id="edit-seasonality">
                        <option value="Tutto l'anno" ${recipe.seasonality === "Tutto l'anno" ? "selected" : ""}>Tutto l'anno</option>
                        <option value="Primavera" ${recipe.seasonality === "Primavera" ? "selected" : ""}>Primavera</option>
                        <option value="Estate" ${recipe.seasonality === "Estate" ? "selected" : ""}>Estate</option>
                        <option value="Autunno" ${recipe.seasonality === "Autunno" ? "selected" : ""}>Autunno</option>
                        <option value="Inverno" ${recipe.seasonality === "Inverno" ? "selected" : ""}>Inverno</option>
                    </select>
                </div>
                <div class="modal-field">
                    <label>Categoria</label>
                    <select id="edit-category">
                        <option value="PRIMI" ${recipe.dish_type === "PRIMI" ? "selected" : ""}>Primi</option>
                        <option value="SECONDI" ${recipe.dish_type === "SECONDI" ? "selected" : ""}>Secondi</option>
                        <option value="PIATTI UNICI" ${recipe.dish_type === "PIATTI UNICI" ? "selected" : ""}>Piatti Unici</option>
                        <option value="CONTORNI" ${recipe.dish_type === "CONTORNI" ? "selected" : ""}>Contorni</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button class="btn-ghost" onclick="closeModal()">Annulla</button>
                    <button class="btn-primary" id="modal-confirm-edit" onclick="confirmEdit('${recipeName.replace(/'/g, "\\'")}')">Salva</button>
                </div>
            </div>
        </div>
    `;
}

export async function confirmEdit(originalName) {
    const btn = document.getElementById("modal-confirm-edit");
    btn.disabled = true;
    btn.textContent = "Salvataggio...";

    const updates = {
        name: document.getElementById("edit-name").value.trim(),
        ingredients: document.getElementById("edit-ingredients").value.trim(),
        seasonality: document.getElementById("edit-seasonality").value,
        category: document.getElementById("edit-category").value,
    };

    try {
        await API.updateRecipe(originalName, updates);
        showToast("Ricetta aggiornata!", "success");
        state.allRecipesCache = null;
        closeModal();
        loadManageRecipes();
    } catch (e) {
        showToast(e.message, "error");
        btn.disabled = false;
        btn.textContent = "Salva";
    }
}

export function closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById("modal-root").innerHTML = "";
}

/* ===== Preferences ===== */

const PREF_STEPS = [
    { type: "PRIMI", label: "Primi", question: "Quali primi ti piacciono?" },
    { type: "SECONDI", label: "Secondi", question: "Quali secondi ti piacciono?" },
    { type: "PIATTI UNICI", label: "Piatti Unici", question: "Quali piatti unici ti piacciono?" },
    { type: "CONTORNI", label: "Contorni", question: "Quali contorni ti piacciono?" },
];

export async function loadPreferenceRecipes() {
    const grid = document.getElementById("preferences-grid");
    grid.innerHTML = '<div class="preferences-loading"><div class="spinner"></div></div>';

    try {
        const recipes = await API.featuredRecipes(4);

        state.prefRecipes = {};
        for (const r of recipes) {
            if (!state.prefRecipes[r.dish_type]) state.prefRecipes[r.dish_type] = [];
            state.prefRecipes[r.dish_type].push(r);
        }

        state.prefStep = 0;
        renderPrefStep();
    } catch (e) {
        grid.innerHTML = '<p style="color: rgba(255,255,255,0.6);">Impossibile caricare le ricette.</p>';
    }
}

function renderPrefStep() {
    const step = PREF_STEPS[state.prefStep];
    const grid = document.getElementById("preferences-grid");
    const title = document.getElementById("preferences-title");
    const stepLabel = document.getElementById("pref-step-label");
    const progressBar = document.getElementById("pref-progress-bar");
    const prevBtn = document.getElementById("pref-prev");

    title.textContent = step.question;
    stepLabel.textContent = `${state.prefStep + 1} di ${PREF_STEPS.length} \u2014 ${step.label}`;
    progressBar.style.width = `${((state.prefStep + 1) / PREF_STEPS.length) * 100}%`;
    prevBtn.classList.toggle("hidden", state.prefStep === 0);

    const nextBtn = document.getElementById("pref-next");
    nextBtn.textContent = state.prefStep === PREF_STEPS.length - 1 ? "Continua" : "Avanti";

    grid.innerHTML = "";
    const items = state.prefRecipes[step.type] || [];

    for (const recipe of items) {
        const card = document.createElement("div");
        card.className = "pref-card";
        card.dataset.name = recipe.name;
        card.onclick = () => card.classList.toggle("selected");

        const name = document.createElement("div");
        name.className = "pref-card-name";
        name.textContent = recipe.name;
        card.appendChild(name);

        if (recipe.nutrients && recipe.nutrients.length > 0) {
            const badges = document.createElement("div");
            badges.className = "nutrient-badges";
            for (const nutrient of recipe.nutrients) {
                const badge = document.createElement("span");
                badge.className = `badge badge-${nutrient}`;
                badge.textContent = nutrient;
                badges.appendChild(badge);
            }
            card.appendChild(badges);
        }

        grid.appendChild(card);
    }
}

export function prefNext() {
    const selected = document.querySelectorAll(".pref-card.selected");
    for (const c of selected) {
        state.prefSelected.push(c.dataset.name);
    }

    if (state.prefStep < PREF_STEPS.length - 1) {
        state.prefStep++;
        renderPrefStep();
    } else {
        finishPreferences();
    }
}

export function prefPrev() {
    if (state.prefStep > 0) {
        const currentType = PREF_STEPS[state.prefStep].type;
        const currentNames = (state.prefRecipes[currentType] || []).map(r => r.name);
        state.prefSelected = state.prefSelected.filter(n => !currentNames.includes(n));

        state.prefStep--;

        const prevType = PREF_STEPS[state.prefStep].type;
        const prevNames = (state.prefRecipes[prevType] || []).map(r => r.name);
        state.prefSelected = state.prefSelected.filter(n => !prevNames.includes(n));

        renderPrefStep();
    }
}

async function finishPreferences() {
    if (state.prefSelected.length > 0) {
        await API.sendPreferences(state.prefSelected);
    }
    state.prefSelected = [];
    // Use window.navigateTo to avoid circular import
    window.navigateTo("menu");
}

export function skipPreferences() {
    state.prefSelected = [];
    window.navigateTo("menu");
}
