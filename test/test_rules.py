from src.rules import MealNutritionRules, DayNutritionRules, DishCombinationRules
from src.model import Recipe, DishType


def make_recipe(name, protein=False, carb=False, fiber=False):
    r = Recipe(name=name, ingredients="", seasonality="", source1=None, source2=None)
    # monkeypatching classify result via a dict keyed by recipe; tests will call rules directly
    r._profile = {"protein": protein, "carb": carb, "fiber": fiber}
    return r


class DummyProfiles(dict):
    def get(self, key, default=None):
        # key is Recipe
        return super().get(key, default)


def test_meal_nutrition_rules_accepts_correct_combination():
    rules = MealNutritionRules()
    r1 = make_recipe("A", protein=True, fiber=True)
    profiles = DummyProfiles({r1: r1._profile})

    assert rules.is_valid([r1], profiles)


def test_meal_nutrition_rules_rejects_missing_fiber():
    rules = MealNutritionRules()
    r1 = make_recipe("A", protein=True, fiber=False)
    profiles = DummyProfiles({r1: r1._profile})

    assert not rules.is_valid([r1], profiles)


def test_meal_nutrition_rules_rejects_both_protein_and_carb():
    rules = MealNutritionRules()
    r1 = make_recipe("A", protein=True, carb=True, fiber=True)
    profiles = DummyProfiles({r1: r1._profile})

    assert not rules.is_valid([r1], profiles)


def test_meal_nutrition_allows_both_if_allowed():
    rules = MealNutritionRules()
    r1 = make_recipe("A", protein=True, carb=True, fiber=True)
    profiles = DummyProfiles({r1: r1._profile})

    assert rules.is_valid([r1], profiles, allow_both=True)


def test_day_rule_requires_protein_and_carb():
    day = DayNutritionRules()
    r1 = make_recipe("A", protein=True)
    r2 = make_recipe("B", carb=True)
    profiles = DummyProfiles({r1: r1._profile, r2: r2._profile})

    assert day.is_valid([profiles.get(r1), profiles.get(r2)])


def test_dish_combination_piatti_unici_alone():
    rules = DishCombinationRules()
    assert rules.is_valid([DishType.PRIMO])
    assert rules.is_valid([DishType.PIATTO_UNICO])
    assert not rules.is_valid([DishType.PIATTO_UNICO, DishType.PRIMO])
