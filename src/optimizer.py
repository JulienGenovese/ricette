import random
try:
    from loguru import logger
except Exception:
    import logging

    _log = logging.getLogger("optimizer")
    handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
    handler.setFormatter(formatter)
    _log.addHandler(handler)
    _log.setLevel(logging.INFO)

    class _Fallback:
        def info(self, *a, **k):
            _log.info(a[0] if a else "")

        def debug(self, *a, **k):
            _log.debug(a[0] if a else "")

        def success(self, *a, **k):
            _log.info(a[0] if a else "")

        def warning(self, *a, **k):
            _log.warning(a[0] if a else "")

        def error(self, *a, **k):
            _log.error(a[0] if a else "")

    logger = _Fallback()

from datetime import datetime
import os

from src.excel import PlanExcelWriter, RecipeRepository, ShoppingListWriter
from src.model import NutritionClassifier, Recipe, CategorizedRecipe, DishType, UnitNormalizer
from src.rules import DayNutritionRules, DishCombinationRules, MealNutritionRules
from src.list_generator import (
    IngredientParser,
    IngredientAggregator,
    IngredientSimilarityMerger,
    ShoppingListGenerator,
)


class MealBuilder:
    MAX_RECIPES = 2
    MAX_ATTEMPTS = 10

    def __init__(
        self,
        nutrition_rules: MealNutritionRules,
        combination_rules: DishCombinationRules,
        profiles: dict[Recipe, dict],
    ):
        self.nutrition_rules = nutrition_rules
        self.combination_rules = combination_rules
        self.profiles = profiles

    def build(
        self,
        available: list[CategorizedRecipe],
        must_have: str | None = None,
        allow_both: bool = False,
    ) -> list[CategorizedRecipe]:

        logger.info(
            "Costruzione pasto | ricette disponibili: {} | nutriente obbligatorio: {}",
            len(available),
            must_have,
        )

        for attempt in range(1, self.MAX_ATTEMPTS + 1):
            logger.debug("Tentativo pasto {}/{}", attempt, self.MAX_ATTEMPTS)

            meal: list[CategorizedRecipe] = []
            shuffled = available[:]
            random.shuffle(shuffled)

            for cr in shuffled:
                if len(meal) >= self.MAX_RECIPES:
                    break

                tentative = meal + [cr]

                if not self.combination_rules.is_valid(
                    [x.dish_type for x in tentative]
                ):
                    logger.debug(
                        "Scartata combinazione piatti: {}",
                        [x.dish_type.name for x in tentative],
                    )
                    continue

                recipes = [x.recipe for x in tentative]

                if not self.nutrition_rules.is_valid(recipes, self.profiles, allow_both=allow_both):
                    logger.debug(
                        "Scartato per regole nutrizionali: {}",
                        [r.name for r in recipes],
                    )
                    continue

                # if allow_both is requested for a single-meal day, ensure meal covers both protein and carb
                if allow_both:
                    if not (any(self.profiles[r]["protein"] for r in recipes) and any(self.profiles[r]["carb"] for r in recipes)):
                        logger.debug(
                            "Scartato: non contiene entrambi i nutrienti richiesti in {}",
                            [r.name for r in recipes],
                        )
                        continue

                if must_have:
                    if not any(self.profiles[r][must_have] for r in recipes):
                        logger.debug(
                            "Scartato: manca nutriente obbligatorio '{}' in {}",
                            must_have,
                            [r.name for r in recipes],
                        )
                        continue

                logger.success(
                    "Pasto valido costruito: {}",
                    [r.recipe.name for r in tentative],
                )
                return tentative

            # Fallback for allow_both: deterministic search for a pair that yields protein+fiber + carb or carb+fiber + protein
            if allow_both:
                prot_fiber = [c for c in available if self.profiles[c.recipe].get("protein") and self.profiles[c.recipe].get("fiber")]
                carb = [c for c in available if self.profiles[c.recipe].get("carb")]

                for p in prot_fiber:
                    for c in carb:
                        if p == c:
                            continue
                        if not self.combination_rules.is_valid([p.dish_type, c.dish_type]):
                            continue
                        recipes = [p.recipe, c.recipe]
                        if self.nutrition_rules.is_valid(recipes, self.profiles, allow_both=True):
                            logger.success(
                                "Pasto valido costruito (fallback): {}",
                                [p.recipe.name, c.recipe.name],
                            )
                            return [p, c]

                carb_fiber = [c for c in available if self.profiles[c.recipe].get("carb") and self.profiles[c.recipe].get("fiber")]
                prot = [c for c in available if self.profiles[c.recipe].get("protein")]

                for cf in carb_fiber:
                    for p in prot:
                        if cf == p:
                            continue
                        if not self.combination_rules.is_valid([cf.dish_type, p.dish_type]):
                            continue
                        recipes = [cf.recipe, p.recipe]
                        if self.nutrition_rules.is_valid(recipes, self.profiles, allow_both=True):
                            logger.success(
                                "Pasto valido costruito (fallback): {}",
                                [cf.recipe.name, p.recipe.name],
                            )
                            return [cf, p]

            logger.warning(
                "Tentativo {} fallito: nessuna combinazione valida trovata",
                attempt,
            )

        logger.error("Impossibile costruire un pasto valido")
        raise RuntimeError("Impossibile costruire un pasto valido")


class WeeklyMealPlanner:
    DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
    MEALS = ["Pranzo", "Cena"]

    def __init__(
        self,
        recipes: list[CategorizedRecipe],
        profiles: dict,
        builder: MealBuilder,
        day_rules: DayNutritionRules,
    ):
        self.recipes = recipes
        self.builder = builder
        self.day_rules = day_rules
        self.profiles = profiles

    def generate(self) -> dict:
        logger.info("Avvio generazione piano settimanale")

        used = set()
        plan = {}

        for day in self.DAYS:
            logger.info("Pianificazione giorno: {}", day)

            plan[day] = {}
            day_profiles = []
            used_nutrients = {"protein": False, "carb": False}

            for idx, meal_name in enumerate(self.MEALS):
                if day == "Sab" and meal_name == "Cena":
                    logger.info("Salto {} {}", day, meal_name)
                    continue

                prefer = "protein" if idx == 0 else "carb"
                must_have = prefer if not used_nutrients[prefer] else None
                # if this is Saturday lunch (only meal of the day), allow meal to contain both protein and carb
                allow_both = True if day == "Sab" and meal_name == "Pranzo" else False
                if allow_both:
                    # don't force a single nutrient when we need both in the same meal
                    must_have = None

                logger.info(
                    "Costruzione {} | nutriente preferito: {} | obbligatorio: {}",
                    meal_name,
                    prefer,
                    must_have,
                )

                available = [r for r in self.recipes if r.recipe not in used]

                meal = self.builder.build(available, must_have, allow_both=allow_both)

                # Validate meal with nutrition rules (builder already checks during build, but double-check)
                recipes_list = [x.recipe for x in meal]
                if not self.builder.nutrition_rules.is_valid(recipes_list, self.profiles, allow_both=allow_both):
                    logger.error("Pasto {} del giorno {} non valido dopo costruzione", meal_name, day)
                    raise RuntimeError(f"Pasto {meal_name} del giorno {day} non valido")

                plan[day][meal_name] = recipes_list
                used.update(x.recipe for x in meal)

                for r in recipes_list:
                    p = self.profiles[r]
                    day_profiles.append(p)
                    if p["protein"]:
                        used_nutrients["protein"] = True
                    if p["carb"]:
                        used_nutrients["carb"] = True

            if not self.day_rules.is_valid(day_profiles):
                logger.error("Giorno {} non valido nutrizionalmente", day)
                raise RuntimeError(f"Giorno {day} non valido")

            logger.success("Giorno {} pianificato correttamente", day)

        logger.success("Piano settimanale generato con successo")
        return plan


def main():
    logger.info("Caricamento ricette da Excel")

    repo = RecipeRepository("dati/ricette/Cucina ottimizzata.xlsx")
    recipes = repo.load_recipes()

    # If load_recipes returned a dict by category, flatten it into a list of CategorizedRecipe
    if isinstance(recipes, dict):
        flat: list[CategorizedRecipe] = []
        for cat, recs in recipes.items():
            try:
                dish_type = DishType(cat)
            except Exception:
                # skip unknown categories
                continue
            for r in recs:
                flat.append(CategorizedRecipe(recipe=r, dish_type=dish_type))
        recipes = flat

    logger.success("Ricette caricate: {}", len(recipes))

    classifier = NutritionClassifier()

    profiles = {
        cr.recipe: classifier.classify(cr.recipe)
        for cr in recipes
    }

    builder = MealBuilder(
        MealNutritionRules(),
        DishCombinationRules(),
        profiles,
    )

    planner = WeeklyMealPlanner(
        recipes,
        profiles,
        builder,
        DayNutritionRules(),
    )

    plan = planner.generate()

    # map internal nutrient keys to Italian labels
    nutrient_map = {"protein": "proteine", "carb": "carboidrati", "fiber": "fibre"}

    # enrich plan entries to include nutrients (Italian labels)
    used_recipes = []
    enriched_plan = {}
    for day, meals in plan.items():
        enriched_plan[day] = {}
        for meal, recipes in meals.items():
            # recipes may already be dicts or lists
            if isinstance(recipes, dict):
                recs = recipes.get("recipes", recipes.get("recipes", []))
            else:
                recs = recipes

            # compute nutrients present for these recipes
            nutrients_present = []
            for key, label in nutrient_map.items():
                if any(profiles.get(r, {}).get(key, False) for r in recs):
                    nutrients_present.append(label)

            nutrients_str = ", ".join(nutrients_present)

            enriched_plan[day][meal] = {"recipes": recs, "nutrients": nutrients_str}
            used_recipes.extend(recs)

    # ensure output dir
    out_dir = "dati/piani_settimanali"
    os.makedirs(out_dir, exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")

    plan_filename = f"{out_dir}/{date_str}-piano_settimanale.xlsx"
    # validate enriched_plan
    m_rules = MealNutritionRules()
    d_rules = DayNutritionRules()

    for day, meals in enriched_plan.items():
        day_profiles = []
        single_meal_day = len(meals) == 1
        for meal, data in meals.items():
            recs = data.get("recipes", [])
            allow_both_check = single_meal_day
            if not m_rules.is_valid(recs, profiles, allow_both=allow_both_check):
                logger.error("Pasto non valido {} {}: violazione regole nutrizionali", day, meal)
                raise RuntimeError(f"Pasto non valido {day} {meal}")
            # collect day profiles
            for r in recs:
                day_profiles.append(profiles.get(r, {}))

        if not d_rules.is_valid(day_profiles):
            logger.error("Giorno non valido {}: manca proteina o carboidrato", day)
            raise RuntimeError(f"Giorno {day} non valido")

    PlanExcelWriter(plan_filename).write(enriched_plan)
    logger.success("Excel piano settimanale scritto con successo: {}", plan_filename)

    # generate shopping list
    parser = IngredientParser(UnitNormalizer())
    aggregator = IngredientAggregator()
    merger = IngredientSimilarityMerger()
    sgen = ShoppingListGenerator(parser, aggregator, merger)

    merged, aggregations = sgen.generate(used_recipes)

    shopping_filename = f"{out_dir}/{date_str}-lista_della_spesa.xlsx"
    ShoppingListWriter(shopping_filename).write(merged, aggregations)
    logger.success("Excel lista della spesa scritto con successo: {}", shopping_filename)

if __name__ == "__main__": 
    main()