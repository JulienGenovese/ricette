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
         mobileSwipePrev, mobileSwipeNext, toggleShoppingList,
         savePlanToStorage, exportFile, toggleDropdown, closeDropdowns,
         renderShoppingList, setupMobileSwipe,
         removeDay, removeMeal, openRecipeDetailModal, closeRecipeDetailModal,
         loadRecipeFiles, toggleRecipeFilesDropdown,
         openGlobalScalePopover } from "./planner.js";
import { toggleTheme } from "./theme.js";
import { shouldShowTutorial, startTutorial, skipTutorial, nextStep as tutorialNext, prevStep as tutorialPrev } from "./tutorial.js";
import { initTips, showTips, hideTips, dismissTips, nextTip, prevTip } from "./tips.js";
import { initAuth, loginWithEmail, registerWithEmail, loginWithGoogle,
         logoutUser, showAuthTab, acceptGdpr, declineGdpr,
         exportUserData, confirmDeleteAccount, deleteAccountConfirmed,
         toggleUserDropdown } from "./auth.js";

// Attach to window for inline onclick handlers
Object.assign(window, {
    navigateTo, toggleTheme, generatePlan, rescaleAndRender,
    resetExclusions, toggleCompactView, mobileSwipePrev, mobileSwipeNext,
    toggleShoppingList, savePlanToStorage, exportFile,
    toggleDropdown, closeDropdowns, selectChip, wizardNext, wizardPrev,
    resetWizard, filterManageRecipes, openEditModal, openDeleteModal,
    confirmDelete, confirmEdit, closeModal, skipPreferences, prefNext, prefPrev,
    renderShoppingList, removeDay, removeMeal,
    openRecipeDetailModal, closeRecipeDetailModal,
    toggleRecipeFilesDropdown,
    openGlobalScalePopover,
    startTutorial, skipTutorial, tutorialNext, tutorialPrev,
    showTips, hideTips, dismissTips, nextTip, prevTip,
    loginWithEmail, registerWithEmail, loginWithGoogle,
    logoutUser, showAuthTab, acceptGdpr, declineGdpr,
    exportUserData, confirmDeleteAccount, deleteAccountConfirmed,
    toggleUserDropdown,
});

document.addEventListener("DOMContentLoaded", () => {
    initAuth();
    initTheme();
    startSlideshow(document.getElementById("landing"));
    renderWizardBreadcrumb();
    loadRecipeFiles();

    window.addEventListener("resize", () => {
        if (state.lastPlanData) setupMobileSwipe();
    });

    // Tutorial can be started manually via the "?" button in the navbar
});
