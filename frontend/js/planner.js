import { DAYS_ORDER, MEALS_ORDER } from "./constants.js";
import { state } from "./state.js";
import { API } from "./api.js";
import {
    escapeHtml, formatQty, showLoading, showError, hideError,
    showToast, updateExcludedCount, launchConfetti, downloadBlob,
} from "./helpers.js";

/* ===== Helpers ===== */

function getVisibleDays() {
    if (!state.lastPlanData) return DAYS_ORDER;
    return DAYS_ORDER.filter(d => state.lastPlanData.plan[d]);
}

function recalcShoppingList() {
    if (!state.lastPlanData) return;
    const plan = state.lastPlanData.plan;
    const map = new Map();

    for (const dayData of Object.values(plan)) {
        if (!dayData.meals) continue;
        for (const mealData of Object.values(dayData.meals)) {
            if (!mealData.recipes) continue;
            for (const recipe of mealData.recipes) {
                if (!recipe.ingredients) continue;
                for (const ing of recipe.ingredients) {
                    const key = `${ing.name}||${ing.unit || ""}`;
                    if (map.has(key)) {
                        map.get(key).quantity = (map.get(key).quantity || 0) + (ing.quantity || 0);
                    } else {
                        map.set(key, { name: ing.name, quantity: ing.quantity || 0, unit: ing.unit || "" });
                    }
                }
            }
        }
    }

    state.lastPlanData.shopping_list = [...map.values()];
}

/* ===== Plan Generation ===== */

export async function generatePlan() {
    showLoading(true);
    hideError();

    const season = document.getElementById("season-select").value || null;

    try {
        state.lastPlanData = await API.generate(state.excludedRecipes, season);
        rescaleAndRender();
        updateExcludedCount();

        document.getElementById("plan-section").classList.remove("hidden");
        document.getElementById("export-controls").classList.remove("hidden");
        document.getElementById("empty-state").classList.add("hidden");
        document.getElementById("shopping-section").classList.remove("hidden");

        renderShoppingList();
        launchConfetti();
    } catch (e) {
        showError(e.message);
    } finally {
        showLoading(false);
    }
}

export async function removeRecipe(day, meal, name) {
    const cards = document.querySelectorAll(".recipe-card");
    cards.forEach((card) => {
        if (card.querySelector(".recipe-name")?.textContent === name) {
            card.classList.add("fade-out");
        }
    });

    await new Promise((r) => setTimeout(r, 300));

    showLoading(true);
    hideError();

    try {
        const result = await API.replace(
            state.lastPlanData.plan, day, meal, name, state.excludedRecipes
        );

        if (result.success) {
            state.excludedRecipes.add(name);
            state.lastPlanData = {
                plan: result.plan,
                shopping_list: result.shopping_list,
                excluded_recipes: result.excluded_recipes,
            };
            rescaleAndRender();
            updateExcludedCount();
            renderShoppingList();
        } else {
            showToast(result.message || "Impossibile aggiornare questa ricetta mantenendo i limiti nutrizionali", "warning");
        }
    } catch (e) {
        showError(e.message);
    } finally {
        showLoading(false);
    }
}

export function removeDay(day) {
    if (!state.lastPlanData || !state.lastPlanData.plan[day]) return;

    const grid = document.getElementById("plan-grid");
    const col = grid.querySelector(`.day-column[data-day="${day}"]`);
    if (col) {
        col.classList.add("fade-out-day");
        setTimeout(() => {
            delete state.lastPlanData.plan[day];
            recalcShoppingList();

            const visibleDays = getVisibleDays();
            if (visibleDays.length === 0) {
                document.getElementById("plan-section").classList.add("hidden");
                document.getElementById("export-controls").classList.add("hidden");
                document.getElementById("empty-state").classList.remove("hidden");
                document.getElementById("shopping-section").classList.add("hidden");
            } else {
                if (state.mobileDayIndex >= visibleDays.length) {
                    state.mobileDayIndex = visibleDays.length - 1;
                }
                rescaleAndRender();
                renderShoppingList();
            }
            showToast(`${day} rimosso dal piano`, "info");
        }, 300);
    }
}

export function removeMeal(day, meal) {
    if (!state.lastPlanData || !state.lastPlanData.plan[day]) return;
    const dayData = state.lastPlanData.plan[day];
    if (!dayData.meals || !dayData.meals[meal]) return;

    const grid = document.getElementById("plan-grid");
    const col = grid.querySelector(`.day-column[data-day="${day}"]`);
    if (col) {
        const blocks = col.querySelectorAll(".meal-block");
        for (const block of blocks) {
            if (block.querySelector(".meal-label-text")?.textContent === meal) {
                block.classList.add("fade-out-meal");
                break;
            }
        }
    }

    setTimeout(() => {
        dayData.meals[meal].recipes = [];
        recalcShoppingList();
        rescaleAndRender();
        renderShoppingList();
        showToast(`${meal} di ${day} rimosso`, "info");
    }, 300);
}

export function resetExclusions() {
    state.excludedRecipes.clear();
    updateExcludedCount();
}

/* ===== Local Scaling ===== */

export function getNumPeople() {
    return parseInt(document.getElementById("num-people").value) || 2;
}

export function rescaleAndRender() {
    if (!state.lastPlanData) return;
    renderPlan(state.lastPlanData.plan, getNumPeople());
}

/* ===== Compact/Expanded View ===== */

export function toggleCompactView() {
    state.compactView = !state.compactView;
    const grid = document.getElementById("plan-grid");
    const btn = document.getElementById("btn-view-toggle");
    grid.classList.toggle("compact", state.compactView);
    btn.classList.toggle("active", state.compactView);
    btn.textContent = state.compactView ? "Espanso" : "Compatto";
}

/* ===== Mobile Swipe ===== */

export function setupMobileSwipe() {
    const grid = document.getElementById("plan-grid");
    if (window.innerWidth <= 768) {
        grid.classList.add("mobile-swipe");
        updateMobileDayNav();
    } else {
        grid.classList.remove("mobile-swipe");
    }
}

export function mobileSwipePrev() {
    if (state.mobileDayIndex > 0) {
        state.mobileDayIndex--;
        scrollToMobileDay();
    }
}

export function mobileSwipeNext() {
    const visibleDays = getVisibleDays();
    if (state.mobileDayIndex < visibleDays.length - 1) {
        state.mobileDayIndex++;
        scrollToMobileDay();
    }
}

function scrollToMobileDay() {
    const grid = document.getElementById("plan-grid");
    const columns = grid.querySelectorAll(".day-column");
    if (columns[state.mobileDayIndex]) {
        columns[state.mobileDayIndex].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    }
    updateMobileDayNav();
}

function updateMobileDayNav() {
    const visibleDays = getVisibleDays();
    document.getElementById("mobile-day-label").textContent = visibleDays[state.mobileDayIndex] || "";
    document.getElementById("mobile-prev-btn").disabled = state.mobileDayIndex === 0;
    document.getElementById("mobile-next-btn").disabled = state.mobileDayIndex >= visibleDays.length - 1;
}

/* ===== Meal Swap (Drag & Drop) ===== */

function swapMeals(fromDay, fromMeal, toDay, toMeal) {
    if (fromDay === toDay && fromMeal === toMeal) return;
    const plan = state.lastPlanData.plan;
    const temp = plan[fromDay].meals[fromMeal];
    plan[fromDay].meals[fromMeal] = plan[toDay].meals[toMeal];
    plan[toDay].meals[toMeal] = temp;
    rescaleAndRender();
    showToast("Pasti scambiati!", "success");
}

function setupMealDrag(block, day, meal) {
    if (window.innerWidth <= 768) return;

    block.draggable = true;
    block.dataset.day = day;
    block.dataset.meal = meal;

    block.addEventListener("dragstart", (e) => {
        block.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", JSON.stringify({ day, meal }));
    });

    block.addEventListener("dragend", () => {
        block.classList.remove("dragging");
        document.querySelectorAll(".meal-block.drag-over").forEach(
            (el) => el.classList.remove("drag-over")
        );
    });

    block.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    });

    block.addEventListener("dragenter", (e) => {
        e.preventDefault();
        block.classList.add("drag-over");
    });

    block.addEventListener("dragleave", (e) => {
        if (!block.contains(e.relatedTarget)) {
            block.classList.remove("drag-over");
        }
    });

    block.addEventListener("drop", (e) => {
        e.preventDefault();
        block.classList.remove("drag-over");
        try {
            const from = JSON.parse(e.dataTransfer.getData("text/plain"));
            swapMeals(from.day, from.meal, day, meal);
        } catch { /* ignore invalid drag data */ }
    });
}

/* ===== Rendering ===== */

function renderPlan(plan, numPeople) {
    const grid = document.getElementById("plan-grid");
    grid.innerHTML = "";

    const visibleDays = getVisibleDays();
    grid.style.setProperty("--day-count", visibleDays.length);

    for (const day of DAYS_ORDER) {
        const dayData = plan[day];
        if (!dayData) continue;

        const col = document.createElement("div");
        col.className = "day-column glass";
        col.dataset.day = day;

        const header = document.createElement("div");
        header.className = "day-header";

        const headerLabel = document.createElement("span");
        headerLabel.textContent = day;
        header.appendChild(headerLabel);

        const removeDayBtn = document.createElement("button");
        removeDayBtn.className = "btn-remove-day";
        removeDayBtn.innerHTML = "&times;";
        removeDayBtn.title = `Rimuovi ${day}`;
        removeDayBtn.onclick = (e) => {
            e.stopPropagation();
            removeDay(day);
        };
        header.appendChild(removeDayBtn);

        col.appendChild(header);

        for (const meal of MEALS_ORDER) {
            const mealData = dayData.meals ? dayData.meals[meal] : null;
            const hasRecipes = mealData && mealData.recipes && mealData.recipes.length > 0;

            const block = document.createElement("div");
            block.className = "meal-block";

            const label = document.createElement("div");
            label.className = "meal-label";

            const labelText = document.createElement("span");
            labelText.className = "meal-label-text";
            labelText.textContent = meal;
            label.appendChild(labelText);

            if (hasRecipes) {
                const removeMealBtn = document.createElement("button");
                removeMealBtn.className = "btn-remove-meal";
                removeMealBtn.innerHTML = "&times;";
                removeMealBtn.title = `Rimuovi ${meal}`;
                removeMealBtn.onclick = (e) => {
                    e.stopPropagation();
                    removeMeal(day, meal);
                };
                label.appendChild(removeMealBtn);
            }

            block.appendChild(label);

            if (mealData && mealData.recipes && mealData.recipes.length > 0) {
                for (const recipe of mealData.recipes) {
                    block.appendChild(createRecipeCard(recipe, numPeople, day, meal));
                }
            } else {
                const empty = document.createElement("div");
                empty.className = "empty-meal";
                empty.textContent = day === "Sab" && meal === "Cena" ? "Libero" : "\u2014";
                block.appendChild(empty);
            }

            setupMealDrag(block, day, meal);
            col.appendChild(block);
        }

        grid.appendChild(col);
    }

    if (state.compactView) grid.classList.add("compact");
    setupMobileSwipe();
}

function createRecipeCard(recipe, numPeople, day, meal) {
    const card = document.createElement("div");
    card.className = "recipe-card fade-in";

    if (recipe.nutrients && recipe.nutrients.length > 0) {
        card.dataset.nutrient = recipe.nutrients[0];
    }

    const name = document.createElement("div");
    name.className = "recipe-name";
    name.textContent = recipe.name;
    card.appendChild(name);

    if (recipe.ingredients && recipe.ingredients.length > 0) {
        const ingDiv = document.createElement("div");
        ingDiv.className = "recipe-ingredients";
        const parts = recipe.ingredients.map((ing) => {
            const scaledQty = ing.quantity ? ing.quantity * numPeople : null;
            if (scaledQty) {
                const unit = ing.unit || "";
                return `${formatQty(scaledQty)}${unit} ${ing.name}`;
            }
            return ing.name;
        });
        ingDiv.textContent = parts.join(", ");
        card.appendChild(ingDiv);
    }

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

    const btn = document.createElement("button");
    btn.className = "btn-remove";
    btn.textContent = "\u00D7";
    btn.title = `Rimuovi "${recipe.name}"`;
    btn.onclick = (e) => {
        e.stopPropagation();
        removeRecipe(day, meal, recipe.name);
    };
    card.appendChild(btn);

    return card;
}

/* ===== Shopping List ===== */

export function renderShoppingList() {
    if (!state.lastPlanData || !state.lastPlanData.shopping_list) return;

    const numPeople = getNumPeople();
    const list = document.getElementById("shopping-list");
    list.innerHTML = "";

    const items = [...state.lastPlanData.shopping_list].sort((a, b) => a.name.localeCompare(b.name));
    document.getElementById("shopping-count").textContent = `(${items.length})`;

    for (const item of items) {
        const div = document.createElement("div");
        div.className = "shopping-item";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.onchange = () => div.classList.toggle("checked", cb.checked);

        const text = document.createElement("span");
        text.className = "shopping-item-text";
        const scaledQty = item.quantity ? item.quantity * numPeople : null;
        if (scaledQty) {
            const unit = item.unit || "";
            text.innerHTML = `<span class="shopping-item-qty">${formatQty(scaledQty)}${unit}</span> ${escapeHtml(item.name)}`;
        } else {
            text.textContent = item.name;
        }

        div.appendChild(cb);
        div.appendChild(text);
        list.appendChild(div);
    }
}

export function toggleShoppingList() {
    const container = document.getElementById("shopping-list-container");
    const icon = document.getElementById("shopping-toggle-icon");
    container.classList.toggle("open");
    icon.classList.toggle("open");
}

/* ===== Saved Plans ===== */

function getSavedPlans() {
    try {
        return JSON.parse(localStorage.getItem("quickchef-saved-plans") || "[]");
    } catch {
        return [];
    }
}

export function savePlanToStorage() {
    if (!state.lastPlanData) return;

    const plans = getSavedPlans();
    const now = new Date();
    plans.unshift({
        id: Date.now(),
        date: now.toLocaleDateString("it-IT"),
        time: now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        numPeople: getNumPeople(),
        data: state.lastPlanData,
    });

    if (plans.length > 10) plans.length = 10;
    localStorage.setItem("quickchef-saved-plans", JSON.stringify(plans));
    showToast("Piano salvato!", "success");
    renderSavedPlans();
}

function loadSavedPlan(id) {
    const plans = getSavedPlans();
    const plan = plans.find((p) => p.id === id);
    if (plan) {
        state.lastPlanData = plan.data;
        document.getElementById("num-people").value = plan.numPeople || 2;
        rescaleAndRender();
        renderShoppingList();

        document.getElementById("plan-section").classList.remove("hidden");
        document.getElementById("export-controls").classList.remove("hidden");
        document.getElementById("empty-state").classList.add("hidden");
        document.getElementById("shopping-section").classList.remove("hidden");

        showToast("Piano caricato!", "info");
    }
}

function deleteSavedPlan(id, event) {
    event.stopPropagation();
    const plans = getSavedPlans().filter((p) => p.id !== id);
    localStorage.setItem("quickchef-saved-plans", JSON.stringify(plans));
    renderSavedPlans();
    showToast("Piano eliminato", "info");
}

export function renderSavedPlans() {
    const plans = getSavedPlans();
    const list = document.getElementById("saved-plans-list");
    const count = document.getElementById("saved-plans-count");
    list.innerHTML = "";
    count.textContent = plans.length > 0 ? `(${plans.length})` : "";

    if (plans.length === 0) {
        list.innerHTML = '<p style="color: rgba(255,255,255,0.5); font-size: 0.85rem; padding: 0.5rem;">Nessun piano salvato.</p>';
        return;
    }

    for (const plan of plans) {
        const card = document.createElement("div");
        card.className = "saved-plan-card";
        card.onclick = () => loadSavedPlan(plan.id);

        card.innerHTML = `
            <div class="saved-plan-date">${escapeHtml(plan.date)} - ${escapeHtml(plan.time)}</div>
            <div class="saved-plan-info">${plan.numPeople || 2} persone</div>
        `;

        const delBtn = document.createElement("button");
        delBtn.className = "saved-plan-delete";
        delBtn.innerHTML = "&times;";
        delBtn.title = "Elimina piano";
        delBtn.onclick = (e) => deleteSavedPlan(plan.id, e);
        card.appendChild(delBtn);

        list.appendChild(card);
    }
}

export function toggleSavedPlans() {
    const container = document.getElementById("saved-plans-container");
    const icon = document.getElementById("saved-plans-toggle-icon");
    container.classList.toggle("open");
    icon.classList.toggle("open");
}

/* ===== Dropdowns ===== */

export function toggleDropdown(id) {
    const menu = document.getElementById(id);
    const wasOpen = menu.classList.contains("open");
    closeDropdowns();
    if (!wasOpen) menu.classList.add("open");
}

export function closeDropdowns() {
    document.querySelectorAll(".dropdown-menu").forEach((m) => m.classList.remove("open"));
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) closeDropdowns();
});

/* ===== Export ===== */

export async function exportFile(type, format) {
    if (!state.lastPlanData) return;

    try {
        const blob = await API.exportFile(type, format, state.lastPlanData, getNumPeople());
        const ext = format === "excel" ? "xlsx" : "pdf";
        const label = type === "plan" ? "piano_settimanale" : "lista_della_spesa";
        downloadBlob(blob, `${label}.${ext}`);
        showToast("File scaricato!", "success");
    } catch (e) {
        showError(e.message);
    }
}
