import { DAYS_ORDER, MEALS_ORDER, SHOPPING_CATEGORIES, SHOPPING_CATEGORY_DEFAULT } from "./constants.js";
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

/* ===== Recipe Files Selection ===== */

export async function loadRecipeFiles() {
    const files = await API.recipeFiles();
    const dropdown = document.getElementById("recipe-files-dropdown");
    if (!dropdown || files.length === 0) return;

    dropdown.innerHTML = "";
    for (const file of files) {
        const label = document.createElement("label");
        label.className = "recipe-files-option";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = file;
        cb.checked = true;
        cb.onchange = updateRecipeFilesLabel;
        const span = document.createElement("span");
        span.textContent = file.replace(/\.xlsx$/i, "");
        label.appendChild(cb);
        label.appendChild(span);
        dropdown.appendChild(label);
    }
    updateRecipeFilesLabel();
}

function updateRecipeFilesLabel() {
    const checkboxes = document.querySelectorAll("#recipe-files-dropdown input[type=checkbox]");
    const checked = [...checkboxes].filter(cb => cb.checked);
    const labelEl = document.getElementById("recipe-files-label");

    if (checked.length === 0 || checked.length === checkboxes.length) {
        labelEl.textContent = "Tutti";
    } else if (checked.length === 1) {
        labelEl.textContent = checked[0].value.replace(/\.xlsx$/i, "");
    } else {
        labelEl.textContent = `${checked.length} selezionati`;
    }
}

export function getSelectedRecipeFiles() {
    const checkboxes = document.querySelectorAll("#recipe-files-dropdown input[type=checkbox]");
    const checked = [...checkboxes].filter(cb => cb.checked);
    if (checked.length === 0 || checked.length === checkboxes.length) return null;
    return checked.map(cb => cb.value);
}

export function toggleRecipeFilesDropdown() {
    const dropdown = document.getElementById("recipe-files-dropdown");
    dropdown.classList.toggle("open");
}

/* ===== Plan Generation ===== */

export async function generatePlan() {
    showLoading(true);
    hideError();

    const season = document.getElementById("season-select").value || null;
    const recipeFiles = getSelectedRecipeFiles();

    try {
        state.lastPlanData = await API.generate(state.excludedRecipes, season, recipeFiles);
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

/* ===== Recipe Detail Modal ===== */

export function openRecipeDetailModal(recipe, numPeople) {
    const root = document.getElementById("modal-root");

    let ingredientsHtml = "";
    if (recipe.ingredients && recipe.ingredients.length > 0) {
        const items = recipe.ingredients.map((ing) => {
            const scaledQty = ing.quantity ? ing.quantity * numPeople : null;
            const unit = ing.unit || "";
            if (scaledQty) {
                return `<li><span class="detail-ing-qty">${formatQty(scaledQty)}${unit}</span> ${escapeHtml(ing.name)}</li>`;
            }
            return `<li>${escapeHtml(ing.name)}</li>`;
        });
        ingredientsHtml = `<ul class="detail-ingredients-list">${items.join("")}</ul>`;
    } else {
        ingredientsHtml = `<p class="detail-no-ingredients">Nessun ingrediente disponibile</p>`;
    }

    let nutrientBadgesHtml = "";
    if (recipe.nutrients && recipe.nutrients.length > 0) {
        nutrientBadgesHtml = `<div class="nutrient-badges detail-badges">
            ${recipe.nutrients.map((n) => `<span class="badge badge-${n}">${escapeHtml(n)}</span>`).join("")}
        </div>`;
    }

    const dishTypeHtml = recipe.dish_type
        ? `<span class="detail-dish-type">${escapeHtml(recipe.dish_type)}</span>`
        : "";

    root.innerHTML = `
        <div class="modal-overlay" onclick="closeRecipeDetailModal(event)">
            <div class="modal recipe-detail-modal" onclick="event.stopPropagation()">
                <button class="detail-close-btn" onclick="closeRecipeDetailModal()">&times;</button>
                <div class="detail-header">
                    <div class="modal-title">${escapeHtml(recipe.name)}</div>
                    <div class="detail-meta">
                        ${dishTypeHtml}
                        ${numPeople > 1 ? `<span class="detail-portions">x${numPeople} persone</span>` : ""}
                    </div>
                </div>
                ${nutrientBadgesHtml}
                <div class="detail-section">
                    <div class="detail-section-label">Ingredienti</div>
                    ${ingredientsHtml}
                </div>
            </div>
        </div>
    `;
}

export function closeRecipeDetailModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById("modal-root").innerHTML = "";
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

    // Feature 2: click card to open detail modal
    card.style.cursor = "pointer";
    card.onclick = (e) => {
        if (e.target.closest(".btn-remove") || e.target.closest(".portions-badge")) return;
        openRecipeDetailModal(recipe, numPeople);
    };

    // Feature 10: portions badge
    if (numPeople > 1) {
        const portionsBadge = document.createElement("span");
        portionsBadge.className = "portions-badge";
        portionsBadge.textContent = `x${numPeople}`;
        portionsBadge.title = `${numPeople} persone`;
        card.appendChild(portionsBadge);
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

function categorizeIngredient(name) {
    const lower = name.toLowerCase();
    for (const cat of SHOPPING_CATEGORIES) {
        if (cat.keywords.some((kw) => lower.includes(kw))) {
            return cat.label;
        }
    }
    return SHOPPING_CATEGORY_DEFAULT;
}

function persistShoppingChecked() {
    localStorage.setItem(
        "quickchef-shopping-checked",
        JSON.stringify([...state.shoppingChecked])
    );
}

function updateShoppingProgress() {
    const fill = document.querySelector(".shopping-progress-fill");
    const label = document.querySelector(".shopping-progress-label");
    if (!fill || !label || !state.lastPlanData) return;

    const totalCount = state.lastPlanData.shopping_list.length;
    let checkedCount = 0;
    for (const item of state.lastPlanData.shopping_list) {
        const key = `${item.name}||${item.unit || ""}`;
        if (state.shoppingChecked.has(key)) checkedCount++;
    }

    fill.style.width = `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%`;
    label.textContent = `${checkedCount}/${totalCount} acquistati`;
}

export function renderShoppingList() {
    if (!state.lastPlanData || !state.lastPlanData.shopping_list) return;

    const numPeople = getNumPeople();
    const list = document.getElementById("shopping-list");
    list.innerHTML = "";

    const items = [...state.lastPlanData.shopping_list].sort((a, b) =>
        a.name.localeCompare(b.name)
    );
    const totalCount = items.length;

    // Group items by category
    const groups = new Map();
    for (const item of items) {
        const category = categorizeIngredient(item.name);
        if (!groups.has(category)) groups.set(category, []);
        groups.get(category).push(item);
    }

    // Order groups: follow SHOPPING_CATEGORIES order, then "Altro" at end
    const orderedCategories = SHOPPING_CATEGORIES.map((c) => c.label).filter(
        (label) => groups.has(label)
    );
    if (groups.has(SHOPPING_CATEGORY_DEFAULT)) {
        orderedCategories.push(SHOPPING_CATEGORY_DEFAULT);
    }

    // Count already checked
    let checkedCount = 0;
    for (const item of items) {
        const key = `${item.name}||${item.unit || ""}`;
        if (state.shoppingChecked.has(key)) checkedCount++;
    }

    // Progress bar
    const progressContainer = document.createElement("div");
    progressContainer.className = "shopping-progress";
    progressContainer.innerHTML = `
        <div class="shopping-progress-bar">
            <div class="shopping-progress-fill" style="width: ${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%"></div>
        </div>
        <span class="shopping-progress-label">${checkedCount}/${totalCount} acquistati</span>
    `;
    list.appendChild(progressContainer);

    // Render groups
    for (const category of orderedCategories) {
        const groupItems = groups.get(category);

        const groupDiv = document.createElement("div");
        groupDiv.className = "shopping-group";

        const groupHeader = document.createElement("div");
        groupHeader.className = "shopping-group-header";
        groupHeader.textContent = category;
        groupDiv.appendChild(groupHeader);

        const groupList = document.createElement("div");
        groupList.className = "shopping-group-items";

        for (const item of groupItems) {
            const key = `${item.name}||${item.unit || ""}`;
            const isChecked = state.shoppingChecked.has(key);

            const div = document.createElement("div");
            div.className = "shopping-item" + (isChecked ? " checked" : "");

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = isChecked;
            cb.onchange = () => {
                div.classList.toggle("checked", cb.checked);
                if (cb.checked) {
                    state.shoppingChecked.add(key);
                } else {
                    state.shoppingChecked.delete(key);
                }
                persistShoppingChecked();
                updateShoppingProgress();
            };

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
            groupList.appendChild(div);
        }

        groupDiv.appendChild(groupList);
        list.appendChild(groupDiv);
    }

    document.getElementById("shopping-count").textContent = `(${totalCount})`;
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

export async function savePlanToStorage() {
    if (!state.lastPlanData) return;

    if (state.currentUser) {
        // Cloud save (Firestore)
        try {
            const now = new Date();
            await API.savePlanToCloud({
                label: `Piano del ${now.toLocaleDateString("it-IT")} ${now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`,
                num_people: getNumPeople(),
                plan: state.lastPlanData.plan,
                shopping_list: state.lastPlanData.shopping_list,
                excluded_recipes: state.lastPlanData.excluded_recipes || [],
            });
            showToast("Piano salvato nel cloud!", "success");
        } catch (e) {
            showToast("Errore nel salvataggio", "error");
            return;
        }
    } else {
        // Local save (localStorage)
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
    }

    renderSavedPlans();

    // Auto-open, scroll, highlight
    const container = document.getElementById("saved-plans-container");
    const icon = document.getElementById("saved-plans-toggle-icon");
    if (!container.classList.contains("open")) {
        container.classList.add("open");
        icon.classList.add("open");
    }

    setTimeout(() => {
        const section = document.getElementById("saved-plans-section");
        section.scrollIntoView({ behavior: "smooth", block: "start" });

        const firstCard = document.querySelector(".saved-plan-card");
        if (firstCard) {
            firstCard.classList.add("saved-plan-pulse");
            setTimeout(() => firstCard.classList.remove("saved-plan-pulse"), 2000);
        }
    }, 100);
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

async function deleteSavedPlan(id, event) {
    event.stopPropagation();
    if (state.currentUser) {
        try {
            await API.deleteUserPlan(id);
        } catch (e) {
            showToast("Errore nell'eliminazione", "error");
            return;
        }
    } else {
        const plans = getSavedPlans().filter((p) => p.id !== id);
        localStorage.setItem("quickchef-saved-plans", JSON.stringify(plans));
    }
    renderSavedPlans();
    showToast("Piano eliminato", "info");
}

export async function renderSavedPlans() {
    let plans;
    if (state.currentUser) {
        try {
            plans = await API.getUserPlans();
        } catch {
            plans = [];
        }
    } else {
        plans = getSavedPlans();
    }

    const list = document.getElementById("saved-plans-list");
    const count = document.getElementById("saved-plans-count");
    if (!list || !count) return;
    list.innerHTML = "";
    count.textContent = plans.length > 0 ? `(${plans.length})` : "";

    if (plans.length === 0) {
        list.innerHTML = '<p style="color: rgba(255,255,255,0.5); font-size: 0.85rem; padding: 0.5rem;">Nessun piano salvato.</p>';
        return;
    }

    for (const plan of plans) {
        const card = document.createElement("div");
        card.className = "saved-plan-card";

        if (state.currentUser) {
            // Cloud plan
            card.onclick = () => loadCloudPlan(plan);
            const label = plan.label || "Piano";
            card.innerHTML = `
                <div class="saved-plan-date">${escapeHtml(label)}</div>
                <div class="saved-plan-info">${plan.num_people || 2} persone</div>
            `;
        } else {
            // Local plan
            card.onclick = () => loadSavedPlan(plan.id);
            card.innerHTML = `
                <div class="saved-plan-date">${escapeHtml(plan.date)} - ${escapeHtml(plan.time)}</div>
                <div class="saved-plan-info">${plan.numPeople || 2} persone</div>
            `;
        }

        const delBtn = document.createElement("button");
        delBtn.className = "saved-plan-delete";
        delBtn.innerHTML = "&times;";
        delBtn.title = "Elimina piano";
        delBtn.onclick = (e) => deleteSavedPlan(plan.id, e);
        card.appendChild(delBtn);

        list.appendChild(card);
    }
}

function loadCloudPlan(plan) {
    state.lastPlanData = {
        plan: plan.plan,
        shopping_list: plan.shopping_list,
        excluded_recipes: plan.excluded_recipes || [],
    };
    document.getElementById("num-people").value = plan.num_people || 2;
    rescaleAndRender();
    renderShoppingList();

    document.getElementById("plan-section").classList.remove("hidden");
    document.getElementById("export-controls").classList.remove("hidden");
    document.getElementById("empty-state").classList.add("hidden");
    document.getElementById("shopping-section").classList.remove("hidden");

    showToast("Piano caricato!", "info");
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
    if (!e.target.closest(".recipe-files-select")) {
        const dd = document.getElementById("recipe-files-dropdown");
        if (dd) dd.classList.remove("open");
    }
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
