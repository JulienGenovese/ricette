"""Generazione del piano settimanale e sostituzione ricette."""

import random
from datetime import datetime

from loguru import logger

from src.config import RECIPES_DIR, NUTRIENT_LABELS, MEALS_ORDER
from src.list_generator import (
    IngredientAggregator,
    IngredientParser,
    IngredientSimilarityMerger,
    ShoppingListGenerator,
)
from src.model import CategorizedRecipe, Recipe
from src.classifier import _enrich_plan
from src.optimizer import MealBuilder, WeeklyMealPlanner
from src.rules import (
    DayContext,
    DayNutritionRule,
    DayRuleEngine,
    MealContext,
    MealRuleEngine,
    NutritionRule,
    PiattoUnicoRule,
)


SEASON_MAP = {
    1: "Inverno", 2: "Inverno", 3: "Primavera",
    4: "Primavera", 5: "Primavera", 6: "Estate",
    7: "Estate", 8: "Estate", 9: "Autunno",
    10: "Autunno", 11: "Autunno", 12: "Inverno",
}


def _current_season() -> str:
    return SEASON_MAP[datetime.now().month]


def matches_season(cr: CategorizedRecipe, season: str) -> bool:
    """Check if a recipe matches the given season or is year-round."""
    s = cr.recipe.seasonality
    if not isinstance(s, str):
        return True
    s_lower = s.strip().lower()
    return s_lower in ("tutto l'anno", "all", "", season.lower())


def build_result(
    plan_recipes: dict,
    profiles: dict,
    dish_type_map: dict,
    parser: IngredientParser,
    num_people: int,
    excluded_set: set[str],
) -> dict:
    """Costruisce la risposta JSON dal piano interno di Recipe objects.

    plan_recipes: {day: {meal: [Recipe, ...]}}
    """
    enriched, used_recipes = _enrich_plan(plan_recipes, profiles)

    aggregator = IngredientAggregator()
    merger = IngredientSimilarityMerger()
    sgen = ShoppingListGenerator(parser, aggregator, merger)
    merged, _, units = sgen.generate(used_recipes)

    scaled_shopping = {
        name: qty * num_people if qty else qty
        for name, qty in merged.items()
    }

    result_plan = {}
    for day, meals in enriched.items():
        result_plan[day] = {"meals": {}}
        for meal_name, data in meals.items():
            recipes_out = []
            for recipe in data["recipes"]:
                parsed = parser.parse(recipe.ingredients)
                ingredients_out = [
                    {
                        "name": ing.name,
                        "quantity": ing.quantity * num_people if ing.quantity else None,
                        "unit": ing.unit,
                    }
                    for ing in parsed
                ]

                profile = profiles.get(recipe, {})
                nutrients = [
                    label for key, label in NUTRIENT_LABELS.items()
                    if profile.get(key, False)
                ]

                recipes_out.append({
                    "name": recipe.name,
                    "ingredients": ingredients_out,
                    "dish_type": dish_type_map.get(recipe, ""),
                    "nutrients": nutrients,
                })

            result_plan[day]["meals"][meal_name] = {"recipes": recipes_out}

    shopping_out = [
        {
            "name": name,
            "quantity": qty if qty else None,
            "unit": units.get(name),
        }
        for name, qty in sorted(scaled_shopping.items())
    ]

    return {
        "plan": result_plan,
        "shopping_list": shopping_out,
        "excluded_recipes": list(excluded_set),
    }


def generate_plan(
    all_recipes: list[CategorizedRecipe],
    profiles: dict,
    weights: dict[str, float],
    dish_type_map: dict,
    parser: IngredientParser,
    excluded: list[str],
    num_people: int,
    season: str | None = None,
    max_retries: int = 3,
) -> dict:
    """Genera un piano settimanale completo con lista della spesa."""
    active_season = season if season else _current_season()

    excluded_set = set(excluded)
    available = [
        cr for cr in all_recipes
        if cr.recipe.name not in excluded_set
        and matches_season(cr, active_season)
    ]

    meal_rules = MealRuleEngine([NutritionRule(), PiattoUnicoRule()])
    day_rules = DayRuleEngine([DayNutritionRule()])
    builder = MealBuilder(meal_rules, profiles, weights)
    planner = WeeklyMealPlanner(available, profiles, builder, day_rules)

    for attempt in range(max_retries):
        try:
            plan = planner.generate()
            break
        except RuntimeError:
            if attempt == max_retries - 1:
                raise
            logger.warning("Tentativo {} fallito, riprovo...", attempt + 1)

    return build_result(plan, profiles, dish_type_map, parser, num_people, excluded_set)


def replace_recipe(
    all_recipes: list[CategorizedRecipe],
    profiles: dict,
    weights: dict[str, float],
    dish_type_map: dict,
    parser: IngredientParser,
    plan_data: dict,
    day: str,
    meal: str,
    recipe_name: str,
    excluded: list[str],
    recipe_by_name_fn,
) -> dict:
    """Sostituisce una singola ricetta nel piano mantenendo le regole."""
    excluded_set = set(excluded)
    excluded_set.add(recipe_name)

    # Ricostruire il piano interno: {day: {meal: [Recipe, ...]}}
    internal_plan: dict[str, dict[str, list[Recipe]]] = {}
    used_recipes: set[str] = set()

    for d, day_data in plan_data.items():
        internal_plan[d] = {}
        meals = day_data.get("meals", {})
        for m, meal_data in meals.items():
            recipes = []
            for r in meal_data.get("recipes", []):
                cr = recipe_by_name_fn(r["name"])
                if cr:
                    recipes.append(cr.recipe)
                    if not (d == day and m == meal and r["name"] == recipe_name):
                        used_recipes.add(r["name"])
            internal_plan[d][m] = recipes

    # Ricette nel pasto target
    target_meal_recipes = internal_plan.get(day, {}).get(meal, [])
    companion_recipes = [r for r in target_meal_recipes if r.name != recipe_name]
    companion_crs = [recipe_by_name_fn(r.name) for r in companion_recipes]
    companion_crs = [cr for cr in companion_crs if cr is not None]

    # Contesto del pasto
    allow_both = (day == "Sab" and meal == "Pranzo")

    # Determinare must_have nutriente basandosi sulla posizione del pasto nel giorno
    meal_idx = MEALS_ORDER.index(meal) if meal in MEALS_ORDER else 0

    # Ricette disponibili per la sostituzione
    available = [
        cr for cr in all_recipes
        if cr.recipe.name not in used_recipes
        and cr.recipe.name not in excluded_set
    ]

    # Preparare regole
    meal_rules = MealRuleEngine([NutritionRule(), PiattoUnicoRule()])
    day_rules = DayRuleEngine([DayNutritionRule()])

    available.sort(
        key=lambda cr: random.random() ** (1.0 / max(weights.get(cr.recipe.name, 1.0), 0.01)),
        reverse=True,
    )

    for candidate in available:
        # Costruire il pasto candidato
        new_meal = companion_crs + [candidate]
        new_recipes = [cr.recipe for cr in new_meal]
        new_dish_types = [cr.dish_type for cr in new_meal]

        # Validare regole del pasto
        ctx = MealContext(
            recipes=new_recipes,
            profiles=profiles,
            dish_types=new_dish_types,
            allow_both=allow_both,
        )
        if not meal_rules.validate(ctx):
            continue

        # Per allow_both, verificare che ci siano entrambi i nutrienti
        if allow_both:
            has_protein = any(profiles[r]["protein"] for r in new_recipes)
            has_carb = any(profiles[r]["carb"] for r in new_recipes)
            if not (has_protein and has_carb):
                continue

        # Validare regole del giorno
        day_meals = internal_plan.get(day, {})
        day_profiles = []
        for m_name, m_recipes in day_meals.items():
            if m_name == meal:
                # Usa il nuovo pasto
                for r in new_recipes:
                    day_profiles.append(profiles[r])
            else:
                for r in m_recipes:
                    day_profiles.append(profiles[r])

        if not day_rules.validate(DayContext(meal_profiles=day_profiles)):
            continue

        # Sostituzione valida trovata
        internal_plan[day][meal] = new_recipes
        result = build_result(internal_plan, profiles, dish_type_map, parser, 1, excluded_set)
        result["success"] = True
        return result

    return {
        "success": False,
        "message": "Impossibile aggiornare questa ricetta mantenendo i limiti nutrizionali",
    }
