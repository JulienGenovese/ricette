"""Classificazione delle ricette e arricchimento del piano con etichette nutrienti."""

from src.config import NUTRIENT_LABELS
from src.model import NutritionClassifier, Recipe, CategorizedRecipe, DishType


def classify_recipes(
    raw: dict[str, list[Recipe]],
) -> tuple[list[CategorizedRecipe], dict[Recipe, dict[str, bool]]]:
    """Classifica le ricette raw in CategorizedRecipe e profili nutrizionali.

    Usata sia da optimizer.main() che da RecipeService.load().
    """
    flat: list[CategorizedRecipe] = []
    for cat, recs in raw.items():
        try:
            dish_type = DishType(cat)
        except ValueError:
            continue
        for r in recs:
            flat.append(CategorizedRecipe(recipe=r, dish_type=dish_type))

    classifier = NutritionClassifier()
    profiles = {cr.recipe: classifier.classify(cr.recipe) for cr in flat}
    return flat, profiles


def _enrich_plan(plan: dict, profiles: dict) -> tuple[dict, list[Recipe]]:
    """Arricchisce il piano con le etichette dei nutrienti in italiano."""
    used_recipes: list[Recipe] = []
    enriched: dict = {}
    for day, meals in plan.items():
        enriched[day] = {}
        for meal, recs in meals.items():
            nutrients_present = [
                label for key, label in NUTRIENT_LABELS.items()
                if any(profiles.get(r, {}).get(key, False) for r in recs)
            ]
            enriched[day][meal] = {
                "recipes": recs,
                "nutrients": ", ".join(nutrients_present),
            }
            used_recipes.extend(recs)
    return enriched, used_recipes
