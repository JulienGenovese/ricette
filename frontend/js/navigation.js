import { startSlideshow, stopSlideshow } from "./theme.js";
import { loadManageRecipes, loadPreferenceRecipes } from "./recipes.js";
import { renderSavedPlans } from "./planner.js";

const PAGES = ["landing", "preferences", "menu", "planner", "add-recipe", "manage-recipes"];

export function navigateTo(pageId) {
    if (pageId === "landing") {
        document.body.classList.add("on-landing");
    } else {
        document.body.classList.remove("on-landing");
    }

    for (const id of PAGES) {
        const el = document.getElementById(id);
        if (!el) continue;

        if (id === "landing") {
            if (pageId !== "landing") {
                el.classList.add("fade-out");
                setTimeout(() => el.classList.add("hidden"), 600);
            } else {
                el.classList.remove("hidden", "fade-out");
            }
        } else {
            if (id === pageId) {
                el.classList.remove("hidden");
            } else {
                el.classList.add("hidden");
            }
        }
    }

    document.querySelectorAll(".navbar-link").forEach((link) => {
        link.classList.toggle("active", link.dataset.page === pageId);
    });

    stopSlideshow();
    const target = document.getElementById(pageId);
    if (target) {
        setTimeout(() => startSlideshow(target), pageId === "landing" ? 0 : 650);
    }

    if (pageId === "preferences") {
        loadPreferenceRecipes();
    }

    if (pageId === "manage-recipes") {
        loadManageRecipes();
    }

    if (pageId === "planner") {
        renderSavedPlans();
    }
}
