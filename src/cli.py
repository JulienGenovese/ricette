"""Entry point CLI: carica ricette, genera il piano settimanale e la lista della spesa."""

import os
from datetime import datetime

from loguru import logger

from src.config import RECIPES_DIR, PLANS_DIR
from src.excel import PlanExcelWriter, RecipeRepository, ShoppingListWriter
from src.model import UnitNormalizer
from src.optimizer import MealBuilder, WeeklyMealPlanner
from src.classifier import classify_recipes, _enrich_plan
from src.rules import (
    NutritionRule, PiattoUnicoRule, DayNutritionRule,
    MealRuleEngine, DayRuleEngine,
)
from src.list_generator import (
    IngredientParser,
    IngredientAggregator,
    IngredientSimilarityMerger,
    ShoppingListGenerator,
)


def main():
    """Entry point: carica ricette, genera il piano settimanale e la lista della spesa."""
    logger.info("Caricamento ricette da Excel")

    repo = RecipeRepository(RECIPES_DIR)
    raw, _user_names = repo.load_recipes()
    recipes, profiles = classify_recipes(raw)

    logger.success("Ricette caricate: {}", len(recipes))

    meal_rules = MealRuleEngine([NutritionRule(), PiattoUnicoRule()])
    day_rules = DayRuleEngine([DayNutritionRule()])

    builder = MealBuilder(meal_rules, profiles)
    planner = WeeklyMealPlanner(recipes, profiles, builder, day_rules)
    plan = planner.generate()

    enriched_plan, used_recipes = _enrich_plan(plan, profiles)

    os.makedirs(PLANS_DIR, exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")

    plan_filename = f"{PLANS_DIR}/{date_str}-piano_settimanale.xlsx"
    PlanExcelWriter(plan_filename).write(enriched_plan)
    logger.success("Excel piano settimanale scritto con successo: {}", plan_filename)

    parser = IngredientParser(UnitNormalizer())
    aggregator = IngredientAggregator()
    merger = IngredientSimilarityMerger()
    sgen = ShoppingListGenerator(parser, aggregator, merger)

    merged, aggregations, units = sgen.generate(used_recipes)

    shopping_filename = f"{PLANS_DIR}/{date_str}-lista_della_spesa.xlsx"
    ShoppingListWriter(shopping_filename).write(merged, aggregations, units)
    logger.success("Excel lista della spesa scritto con successo: {}", shopping_filename)


if __name__ == "__main__":
    main()
