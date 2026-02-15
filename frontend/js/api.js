export const API = {
    async featuredRecipes(n = 15) {
        const res = await fetch(`/api/featured-recipes?n=${n}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.recipes || [];
    },

    async sendPreferences(recipeNames) {
        const res = await fetch("/api/preferences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recipes: recipeNames }),
        });
        return res.ok;
    },

    async generate(excluded, season) {
        const body = { num_people: 1, excluded_recipes: [...excluded] };
        if (season) body.season = season;
        const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
            headers: { "Content-Type": "application/json" },
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
            headers: { "Content-Type": "application/json" },
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
        const res = await fetch(`/api/recipes/${encodeURIComponent(name)}`, { method: "DELETE" });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Errore durante l'eliminazione");
        }
        return res.json();
    },

    async updateRecipe(name, updates) {
        const res = await fetch(`/api/recipes/${encodeURIComponent(name)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Errore durante l'aggiornamento");
        }
        return res.json();
    },
};
