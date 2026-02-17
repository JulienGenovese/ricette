import { state } from "./state.js";

/** Build headers including auth token if available */
function authHeaders(extra = {}) {
    const headers = { "Content-Type": "application/json", ...extra };
    if (state.authToken) {
        headers["Authorization"] = `Bearer ${state.authToken}`;
    }
    return headers;
}

export const API = {
    // ===== Existing endpoints =====

    async featuredRecipes(n = 15) {
        const res = await fetch(`/api/featured-recipes?n=${n}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.recipes || [];
    },

    async sendPreferences(recipeNames) {
        const res = await fetch("/api/preferences", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ recipes: recipeNames }),
        });
        return res.ok;
    },

    async recipeFiles() {
        const res = await fetch("/api/recipe-files");
        if (!res.ok) return [];
        const data = await res.json();
        return data.files || [];
    },

    async generate(excluded, season, recipeFiles = null) {
        const body = { num_people: 1, excluded_recipes: [...excluded] };
        if (season) body.season = season;
        if (recipeFiles && recipeFiles.length > 0) body.recipe_files = recipeFiles;
        const res = await fetch("/api/generate", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Errore durante la generazione");
        }
        return res.json();
    },

    async replace(plan, day, meal, recipeName, excluded) {
        const res = await fetch("/api/replace-recipe", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                plan,
                day,
                meal,
                recipe_name: recipeName,
                excluded_recipes: [...excluded],
            }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Errore durante la sostituzione");
        }
        return res.json();
    },

    async exportFile(type, format, data, numPeople) {
        const res = await fetch(`/api/export/${type}/${format}`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ data, num_people: numPeople }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Errore durante l'export");
        }
        return res.blob();
    },

    async allDetails() {
        const res = await fetch("/api/recipes/all-details");
        if (!res.ok) return [];
        const data = await res.json();
        return data.recipes || [];
    },

    async deleteRecipe(name) {
        const res = await fetch(`/api/recipes/${encodeURIComponent(name)}`, {
            method: "DELETE",
            headers: authHeaders(),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Errore durante l'eliminazione");
        }
        return res.json();
    },

    async updateRecipe(name, updates) {
        const res = await fetch(`/api/recipes/${encodeURIComponent(name)}`, {
            method: "PUT",
            headers: authHeaders(),
            body: JSON.stringify(updates),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Errore durante l'aggiornamento");
        }
        return res.json();
    },

    // ===== Auth / User endpoints =====

    async syncUser() {
        const res = await fetch("/api/user/sync", {
            method: "POST",
            headers: authHeaders(),
            body: "{}",
        });
        if (!res.ok) throw new Error("Sync fallito");
        return res.json();
    },

    async acceptGdpr() {
        const res = await fetch("/api/user/gdpr-consent", {
            method: "POST",
            headers: authHeaders(),
            body: "{}",
        });
        if (!res.ok) throw new Error("Errore consenso GDPR");
        return res.json();
    },

    async getUserPreferences() {
        const res = await fetch("/api/user/preferences", {
            headers: authHeaders(),
        });
        if (!res.ok) return null;
        return res.json();
    },

    async saveUserPreferences(prefs) {
        const res = await fetch("/api/user/preferences", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(prefs),
        });
        return res.ok;
    },

    async savePlanToCloud(planData) {
        const res = await fetch("/api/user/plans", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(planData),
        });
        if (!res.ok) throw new Error("Errore salvataggio piano");
        return res.json();
    },

    async getUserPlans() {
        const res = await fetch("/api/user/plans", {
            headers: authHeaders(),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.plans || [];
    },

    async deleteUserPlan(planId) {
        const res = await fetch(`/api/user/plans/${planId}`, {
            method: "DELETE",
            headers: authHeaders(),
        });
        if (!res.ok) throw new Error("Errore eliminazione piano");
        return res.json();
    },

    async getUserRecipes() {
        const res = await fetch("/api/user/recipes", {
            headers: authHeaders(),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.recipes || [];
    },

    async addUserRecipe(recipe) {
        const res = await fetch("/api/user/recipes", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(recipe),
        });
        if (!res.ok) throw new Error("Errore aggiunta ricetta");
        return res.json();
    },

    async updateUserRecipe(recipeId, updates) {
        const res = await fetch(`/api/user/recipes/${recipeId}`, {
            method: "PUT",
            headers: authHeaders(),
            body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Errore aggiornamento ricetta");
        return res.json();
    },

    async deleteUserRecipe(recipeId) {
        const res = await fetch(`/api/user/recipes/${recipeId}`, {
            method: "DELETE",
            headers: authHeaders(),
        });
        if (!res.ok) throw new Error("Errore eliminazione ricetta");
        return res.json();
    },

    async exportUserData() {
        const res = await fetch("/api/user/data-export", {
            headers: authHeaders(),
        });
        if (!res.ok) throw new Error("Errore export dati");
        return res.json();
    },

    async deleteAccount() {
        const res = await fetch("/api/user/account", {
            method: "DELETE",
            headers: authHeaders(),
        });
        if (!res.ok) throw new Error("Errore eliminazione account");
        return res.json();
    },
};
