/**
 * Entry point per QuickChef SPA.
 *
 * Importa tutti i moduli e collega le funzioni a window
 * per gli handler onclick inline nell'HTML.
 */

import { state } from "./state.js";
import { initTheme, startSlideshow } from "./theme.js";
import { navigateTo } from "./navigation.js";
import { renderWizardBreadcrumb, selectChip, wizardNext, wizardPrev, resetWizard,
         filterManageRecipes, openEditModal, openDeleteModal, confirmDelete,
         confirmEdit, closeModal, loadPreferenceRecipes, prefNext, prefPrev,
         skipPreferences } from "./recipes.js";
import { generatePlan, rescaleAndRender, resetExclusions, toggleCompactView,
         mobileSwipePrev, mobileSwipeNext, toggleShoppingList, toggleSavedPlans,
         savePlanToStorage, exportFile, toggleDropdown, closeDropdowns,
         renderSavedPlans, renderShoppingList, setupMobileSwipe } from "./planner.js";
import { toggleTheme } from "./theme.js";

// Attach to window for inline onclick handlers
Object.assign(window, {
    navigateTo, toggleTheme, generatePlan, rescaleAndRender,
    resetExclusions, toggleCompactView, mobileSwipePrev, mobileSwipeNext,
    toggleShoppingList, toggleSavedPlans, savePlanToStorage, exportFile,
    toggleDropdown, closeDropdowns, selectChip, wizardNext, wizardPrev,
    resetWizard, filterManageRecipes, openEditModal, openDeleteModal,
    confirmDelete, confirmEdit, closeModal, skipPreferences, prefNext, prefPrev,
    renderShoppingList,
});

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    startSlideshow(document.getElementById("landing"));
    renderWizardBreadcrumb();
    renderSavedPlans();

    window.addEventListener("resize", () => {
        if (state.lastPlanData) setupMobileSwipe();
    });
});
