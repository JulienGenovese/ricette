import { DAYS_ORDER, MEALS_ORDER, SHOPPING_CATEGORIES, SHOPPING_CATEGORY_DEFAULT } from "./constants.js";
import { state } from "./state.js";
import { API } from "./api.js";
import {
    escapeHtml, formatQty, roundScaledQty, showLoading, showError, hideError,
    showToast, updateExcludedCount, launchConfetti, downloadBlob,
} from "./helpers.js";

/* ===== Scale Helpers ===== */

let activeScalePopover = null;

function getEffectiveScale(day, meal) {
    const mealKey = `${day}-${meal}`;
    const mealScale = state.mealScales[mealKey] ?? 1.0;
    return state.globalScale * mealScale;
}

function getScaledQty(baseQty, numPeople, day, meal) {
    if (!baseQty) return null;
    return baseQty * numPeople * getEffectiveScale(day, meal);
}

function closeScalePopover() {
    if (activeScalePopover) {
        activeScalePopover.remove();
        activeScalePopover = null;
    }
}

function createScalePopover({ currentPercent, onChange, onReset, title }) {
    const popover = document.createElement("div");
    popover.className = "scale-popover";

    const header = document.createElement("div");
    header.className = "scale-popover-title";
    header.textContent = title;

    const closeBtn = document.createElement("button");
    closeBtn.className = "scale-popover-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = (e) => { e.stopPropagation(); closeScalePopover(); };
    header.appendChild(closeBtn);
    popover.appendChild(header);

    const valueLabel = document.createElement("div");
    valueLabel.className = "scale-popover-value";
    function updateValueLabel(pct) {
        const sign = pct > 0 ? "+" : "";
        valueLabel.textContent = `${sign}${pct}%`;
        valueLabel.classList.toggle("negative", pct < 0);
        valueLabel.classList.toggle("positive", pct > 0);
    }
    updateValueLabel(currentPercent);
    popover.appendChild(valueLabel);

    const controls = document.createElement("div");
    controls.className = "scale-popover-controls";

    const minusBtn = document.createElement("button");
    minusBtn.textContent = "\u2212";
    minusBtn.title = "-5%";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "scale-popover-slider";
    slider.min = -50;
    slider.max = 100;
    slider.step = 5;
    slider.value = currentPercent;

    const plusBtn = document.createElement("button");
    plusBtn.textContent = "+";
    plusBtn.title = "+5%";

    function setVal(v) {
        v = Math.max(-50, Math.min(100, v));
        slider.value = v;
        updateValueLabel(v);
        onChange(v);
    }

    slider.oninput = () => setVal(parseInt(slider.value));
    minusBtn.onclick = (e) => { e.stopPropagation(); setVal(parseInt(slider.value) - 5); };
    plusBtn.onclick = (e) => { e.stopPropagation(); setVal(parseInt(slider.value) + 5); };

    controls.appendChild(minusBtn);
    controls.appendChild(slider);
    controls.appendChild(plusBtn);
    popover.appendChild(controls);

    const resetBtn = document.createElement("button");
    resetBtn.className = "scale-popover-reset";
    resetBtn.textContent = "Ripristina";
    resetBtn.onclick = (e) => { e.stopPropagation(); onReset(); };
    popover.appendChild(resetBtn);

    popover.addEventListener("click", (e) => e.stopPropagation());

    return popover;
}

function positionPopover(popover, anchor) {
    const rect = anchor.getBoundingClientRect();
    popover.style.position = "fixed";
    popover.style.zIndex = "300";
    popover.style.top = `${rect.bottom + 8}px`;
    popover.style.left = `${rect.left}px`;
    requestAnimationFrame(() => {
        const popRect = popover.getBoundingClientRect();
        if (popRect.right > window.innerWidth - 8) {
            popover.style.left = `${window.innerWidth - popRect.width - 8}px`;
        }
        if (popRect.bottom > window.innerHeight - 8) {
            popover.style.top = `${rect.top - popRect.height - 8}px`;
        }
    });
}

function openScalePopover(anchorEl, day, meal) {
    closeScalePopover();
    const mealKey = `${day}-${meal}`;
    const currentScale = state.mealScales[mealKey] ?? 1.0;
    const currentPercent = Math.round((currentScale - 1) * 100);

    const popover = createScalePopover({
        currentPercent,
        title: `${day} \u2014 ${meal}`,
        onChange: (pct) => {
            state.mealScales[mealKey] = 1 + pct / 100;
            recalcShoppingList();
            rescaleAndRender();
            renderShoppingList();
        },
        onReset: () => {
            delete state.mealScales[mealKey];
            recalcShoppingList();
            rescaleAndRender();
            renderShoppingList();
            closeScalePopover();
        },
    });

    positionPopover(popover, anchorEl);
    document.body.appendChild(popover);
    activeScalePopover = popover;
}

export function openGlobalScalePopover() {
    closeScalePopover();
    const currentPercent = Math.round((state.globalScale - 1) * 100);
    const anchorEl = document.getElementById("btn-scale-global");

    const popover = createScalePopover({
        currentPercent,
        title: "Scala Globale",
        onChange: (pct) => {
            state.globalScale = 1 + pct / 100;
            updateGlobalScaleLabel();
            recalcShoppingList();
            rescaleAndRender();
            renderShoppingList();
        },
        onReset: () => {
            state.globalScale = 1.0;
            updateGlobalScaleLabel();
            recalcShoppingList();
            rescaleAndRender();
            renderShoppingList();
            closeScalePopover();
        },
    });

    positionPopover(popover, anchorEl);
    document.body.appendChild(popover);
    activeScalePopover = popover;
}

function updateGlobalScaleLabel() {
    const label = document.getElementById("global-scale-label");
    const btn = document.getElementById("btn-scale-global");
    if (!label) return;
    const pct = Math.round((state.globalScale - 1) * 100);
    label.textContent = pct === 0 ? "" : `${pct > 0 ? "+" : ""}${pct}%`;
    if (btn) btn.classList.toggle("active", pct !== 0);
}

/* ===== Helpers ===== */

function getVisibleDays() {
    if (!state.lastPlanData) return DAYS_ORDER;
    return DAYS_ORDER.filter(d => state.lastPlanData.plan[d]);
}

function recalcShoppingList() {
    if (!state.lastPlanData) return;
    const plan = state.lastPlanData.plan;
    const map = new Map();

    for (const [day, dayData] of Object.entries(plan)) {
        if (!dayData.meals) continue;
        for (const [meal, mealData] of Object.entries(dayData.meals)) {
            if (!mealData.recipes) continue;
            const effectiveScale = getEffectiveScale(day, meal);
            for (const recipe of mealData.recipes) {
                if (!recipe.ingredients) continue;
                for (const ing of recipe.ingredients) {
                    const key = `${ing.name}||${ing.unit || ""}`;
                    const scaledQty = (ing.quantity || 0) * effectiveScale;
                    if (map.has(key)) {
                        map.get(key).quantity += scaledQty;
                    } else {
                        map.set(key, { name: ing.name, quantity: scaledQty, unit: ing.unit || "" });
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
        state.mealScales = {};
        state.globalScale = 1.0;
        updateGlobalScaleLabel();
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
            for (const m of MEALS_ORDER) delete state.mealScales[`${day}-${m}`];
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
        delete state.mealScales[`${day}-${meal}`];
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

    const fromKey = `${fromDay}-${fromMeal}`;
    const toKey = `${toDay}-${toMeal}`;
    const tempScale = state.mealScales[fromKey];
    state.mealScales[fromKey] = state.mealScales[toKey];
    state.mealScales[toKey] = tempScale;
    if (state.mealScales[fromKey] === undefined) delete state.mealScales[fromKey];
    if (state.mealScales[toKey] === undefined) delete state.mealScales[toKey];

    recalcShoppingList();
    rescaleAndRender();
    renderShoppingList();
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

export function openRecipeDetailModal(recipe, numPeople, day, meal) {
    const root = document.getElementById("modal-root");

    let ingredientsHtml = "";
    if (recipe.ingredients && recipe.ingredients.length > 0) {
        const items = recipe.ingredients.map((ing) => {
            const scaledQty = getScaledQty(ing.quantity, numPeople, day, meal);
            const unit = ing.unit || "";
            if (scaledQty) {
                const rounded = roundScaledQty(scaledQty, ing.unit);
                return `<li><span class="detail-ing-qty">${formatQty(rounded)}${unit}</span> ${escapeHtml(ing.name)}</li>`;
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
                const mealKey = `${day}-${meal}`;
                const mealScale = state.mealScales[mealKey];
                const hasScale = mealScale !== undefined && mealScale !== 1.0;

                const scaleMealBtn = document.createElement("button");
                scaleMealBtn.className = "btn-scale-meal" + (hasScale ? " active" : "");
                scaleMealBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 7l7-4 7 4"/><path d="M3 14c0-1.1.9-2 2-2s2 .9 2 2"/><path d="M17 14c0-1.1.9-2 2-2s2 .9 2 2"/><path d="M5 7l-2 7h4"/><path d="M19 7l2 7h-4"/></svg>`;
                scaleMealBtn.title = "Scala quantita'";
                scaleMealBtn.onclick = (e) => {
                    e.stopPropagation();
                    openScalePopover(scaleMealBtn, day, meal);
                };
                label.appendChild(scaleMealBtn);

                if (hasScale) {
                    const indicator = document.createElement("span");
                    indicator.className = "scale-indicator";
                    const pct = Math.round((mealScale - 1) * 100);
                    indicator.textContent = `${pct > 0 ? "+" : ""}${pct}%`;
                    label.appendChild(indicator);
                }

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
        openRecipeDetailModal(recipe, numPeople, day, meal);
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
            const scaledQty = getScaledQty(ing.quantity, numPeople, day, meal);
            if (scaledQty) {
                const unit = ing.unit || "";
                return `${formatQty(roundScaledQty(scaledQty, ing.unit))}${unit} ${ing.name}`;
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
                const rounded = roundScaledQty(scaledQty, item.unit);
                text.innerHTML = `<span class="shopping-item-qty">${formatQty(rounded)}${unit}</span> ${escapeHtml(item.name)}`;
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

    let savedToCloud = false;

    if (state.currentUser) {
        // Cloud save (Firestore) with fallback to local
        try {
            const now = new Date();
            await API.savePlanToCloud({
                label: `Piano del ${now.toLocaleDateString("it-IT")} ${now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`,
                num_people: getNumPeople(),
                plan: state.lastPlanData.plan,
                shopping_list: state.lastPlanData.shopping_list,
                excluded_recipes: state.lastPlanData.excluded_recipes || [],
                mealScales: { ...state.mealScales },
                globalScale: state.globalScale,
            });
            showToast("Piano salvato nel cloud!", "success");
            savedToCloud = true;
        } catch (e) {
            console.warn("Cloud save failed, falling back to localStorage:", e);
        }
    }

    if (!savedToCloud) {
        // Local save (localStorage)
        const plans = getSavedPlans();
        const now = new Date();
        plans.unshift({
            id: Date.now(),
            date: now.toLocaleDateString("it-IT"),
            time: now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
            numPeople: getNumPeople(),
            data: state.lastPlanData,
            mealScales: { ...state.mealScales },
            globalScale: state.globalScale,
        });

        if (plans.length > 10) plans.length = 10;
        localStorage.setItem("quickchef-saved-plans", JSON.stringify(plans));
        showToast("Piano salvato in locale!", "success");
    }

}

function loadSavedPlan(id) {
    const plans = getSavedPlans();
    const plan = plans.find((p) => p.id === id);
    if (plan) {
        state.lastPlanData = plan.data;
        state.mealScales = plan.mealScales || {};
        state.globalScale = plan.globalScale || 1.0;
        updateGlobalScaleLabel();
        document.getElementById("num-people").value = plan.numPeople || 2;
        recalcShoppingList();
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
    state.mealScales = plan.mealScales || {};
    state.globalScale = plan.globalScale || 1.0;
    updateGlobalScaleLabel();
    document.getElementById("num-people").value = plan.num_people || 2;
    recalcShoppingList();
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

/* ===== Saved Plans Page ===== */

export async function renderSavedPlansPage() {
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

    const grid = document.getElementById("saved-plans-page-grid");
    const emptyEl = document.getElementById("saved-plans-page-empty");
    if (!grid || !emptyEl) return;

    grid.innerHTML = "";

    if (plans.length === 0) {
        grid.classList.add("hidden");
        emptyEl.classList.remove("hidden");
        return;
    }

    grid.classList.remove("hidden");
    emptyEl.classList.add("hidden");

    for (const plan of plans) {
        const card = document.createElement("div");
        card.className = "saved-plans-page-card";

        const isCloud = !!state.currentUser;
        const label = isCloud
            ? (plan.label || "Piano")
            : `${plan.date} - ${plan.time}`;
        const people = isCloud ? (plan.num_people || 2) : (plan.numPeople || 2);

        // Count days and meals for info
        const planData = isCloud ? plan.plan : (plan.data ? plan.data.plan : null);
        let dayCount = 0;
        let mealCount = 0;
        if (planData) {
            for (const dayData of Object.values(planData)) {
                dayCount++;
                if (dayData.meals) {
                    for (const mealData of Object.values(dayData.meals)) {
                        if (mealData.recipes && mealData.recipes.length > 0) mealCount++;
                    }
                }
            }
        }

        card.innerHTML = `
            <div class="saved-plans-page-card-header">
                <span class="saved-plans-page-card-icon">&#128197;</span>
                <span class="saved-plans-page-card-label">${escapeHtml(label)}</span>
            </div>
            <div class="saved-plans-page-card-meta">
                <span>${people} persone</span>
                <span>${dayCount} giorni</span>
                <span>${mealCount} pasti</span>
            </div>
        `;

        const actions = document.createElement("div");
        actions.className = "saved-plans-page-card-actions";

        const loadBtn = document.createElement("button");
        loadBtn.className = "btn-primary saved-plans-page-load";
        loadBtn.textContent = "Carica";
        loadBtn.onclick = (e) => {
            e.stopPropagation();
            if (isCloud) {
                loadCloudPlan(plan);
            } else {
                loadSavedPlan(plan.id);
            }
            window.navigateTo("planner");
        };

        const delBtn = document.createElement("button");
        delBtn.className = "btn-ghost saved-plans-page-delete";
        delBtn.textContent = "Elimina";
        delBtn.onclick = async (e) => {
            e.stopPropagation();
            await deleteSavedPlan(plan.id, e);
            renderSavedPlansPage();
        };

        actions.appendChild(loadBtn);
        actions.appendChild(delBtn);
        card.appendChild(actions);

        grid.appendChild(card);
    }
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
    if (!e.target.closest(".scale-popover") && !e.target.closest(".btn-scale-meal") && !e.target.closest(".btn-scale-global")) {
        closeScalePopover();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeScalePopover();
});

/* ===== Export ===== */

function getScaledPlanData() {
    if (!state.lastPlanData) return null;
    const data = JSON.parse(JSON.stringify(state.lastPlanData));
    for (const [day, dayData] of Object.entries(data.plan)) {
        if (!dayData.meals) continue;
        for (const [meal, mealData] of Object.entries(dayData.meals)) {
            if (!mealData.recipes) continue;
            const effectiveScale = getEffectiveScale(day, meal);
            if (effectiveScale === 1.0) continue;
            for (const recipe of mealData.recipes) {
                if (!recipe.ingredients) continue;
                for (const ing of recipe.ingredients) {
                    if (ing.quantity) {
                        ing.quantity = roundScaledQty(ing.quantity * effectiveScale, ing.unit);
                    }
                }
            }
        }
    }
    return data;
}

export async function exportFile(type, format) {
    if (!state.lastPlanData) return;

    try {
        const scaledData = getScaledPlanData();
        const blob = await API.exportFile(type, format, scaledData, getNumPeople());
        const ext = format === "excel" ? "xlsx" : "pdf";
        const label = type === "plan" ? "piano_settimanale" : "lista_della_spesa";
        downloadBlob(blob, `${label}.${ext}`);
        showToast("File scaricato!", "success");
    } catch (e) {
        showError(e.message);
    }
}
