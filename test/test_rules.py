from src.rules import (
    MealContext, DayContext,
    NutritionRule, PiattoUnicoRule, DayNutritionRule,
    MealRuleEngine, DayRuleEngine,
)
from src.model import Recipe, DishType


def make_recipe(name, protein=False, carb=False, fiber=False):
    r = Recipe(name=name, ingredients="", seasonality="", source1=None, source2=None)
    profile = {"protein": protein, "carb": carb, "fiber": fiber}
    return r, profile


def _meal_ctx(recipes, profiles, dish_types=None, allow_both=False):
    if dish_types is None:
        dish_types = [DishType.PRIMO] * len(recipes)
    return MealContext(
        recipes=recipes,
        profiles=profiles,
        dish_types=dish_types,
        allow_both=allow_both,
    )


def test_nutrition_rule_accepts_correct_combination():
    rule = NutritionRule()
    r1, p1 = make_recipe("A", protein=True, fiber=True)
    profiles = {r1: p1}

    assert rule.is_valid(_meal_ctx([r1], profiles))


def test_nutrition_rule_rejects_missing_fiber():
    rule = NutritionRule()
    r1, p1 = make_recipe("A", protein=True, fiber=False)
    profiles = {r1: p1}

    assert not rule.is_valid(_meal_ctx([r1], profiles))


def test_nutrition_rule_rejects_both_protein_and_carb():
    rule = NutritionRule()
    r1, p1 = make_recipe("A", protein=True, carb=True, fiber=True)
    profiles = {r1: p1}

    assert not rule.is_valid(_meal_ctx([r1], profiles))


def test_nutrition_rule_allows_both_if_allowed():
    rule = NutritionRule()
    r1, p1 = make_recipe("A", protein=True, carb=True, fiber=True)
    profiles = {r1: p1}

    assert rule.is_valid(_meal_ctx([r1], profiles, allow_both=True))


def test_day_rule_requires_protein_and_carb():
    rule = DayNutritionRule()
    _, p1 = make_recipe("A", protein=True)
    _, p2 = make_recipe("B", carb=True)

    ctx = DayContext(meal_profiles=[p1, p2])
    assert rule.is_valid(ctx)


def test_piatto_unico_alone():
    rule = PiattoUnicoRule()

    ctx_ok = _meal_ctx([], {}, dish_types=[DishType.PIATTO_UNICO])
    assert rule.is_valid(ctx_ok)

    ctx_ok2 = _meal_ctx([], {}, dish_types=[DishType.PRIMO])
    assert rule.is_valid(ctx_ok2)

    ctx_bad = _meal_ctx([], {}, dish_types=[DishType.PIATTO_UNICO, DishType.PRIMO])
    assert not rule.is_valid(ctx_bad)


def test_meal_rule_engine_validates_all():
    engine = MealRuleEngine([NutritionRule(), PiattoUnicoRule()])

    r1, p1 = make_recipe("A", protein=True, fiber=True)
    profiles = {r1: p1}

    ctx = _meal_ctx([r1], profiles, dish_types=[DishType.PRIMO])
    assert engine.validate(ctx)

    ctx_bad = _meal_ctx([r1], profiles, dish_types=[DishType.PIATTO_UNICO, DishType.PRIMO])
    assert not engine.validate(ctx_bad)


def test_day_rule_engine_validates_all():
    engine = DayRuleEngine([DayNutritionRule()])

    ctx = DayContext(meal_profiles=[{"protein": True, "carb": False}, {"protein": False, "carb": True}])
    assert engine.validate(ctx)

    ctx_bad = DayContext(meal_profiles=[{"protein": True, "carb": False}])
    assert not engine.validate(ctx_bad)
