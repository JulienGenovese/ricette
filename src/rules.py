from typing import List, Dict
from src.model import DishType


class MealNutritionRules:
    """Validates a meal according to:
    - normally: each meal must contain fibra (fiber) and exactly one of proteina (protein) or carboidrato (carb)
    - optionally (allow_both=True): accept fiber and at least one of protein or carb (used for single-meal days)
    """

    def is_valid(self, recipes: List, profiles: Dict, allow_both: bool = False) -> bool:
        if not recipes:
            return False

        has_fiber = any(profiles.get(r, {}).get("fiber", False) for r in recipes)
        has_protein = any(profiles.get(r, {}).get("protein", False) for r in recipes)
        has_carb = any(profiles.get(r, {}).get("carb", False) for r in recipes)

        if not has_fiber:
            return False

        if allow_both:
            return has_protein or has_carb

        # must have exactly one of protein or carb (not both)
        return (has_protein and not has_carb) or (has_carb and not has_protein)


class DishCombinationRules:
    """Validates dish-type combinations:
    - If a PIATTO_UNICO is present, it must be the only dish in the meal
    - otherwise any combination is allowed
    """

    def is_valid(self, dish_types: List[DishType]) -> bool:
        if not dish_types:
            return False

        has_piatto_unico = any(dt == DishType.PIATTO_UNICO for dt in dish_types)
        if has_piatto_unico and len(dish_types) > 1:
            return False

        return True


class DayNutritionRules:
    """Validates a day's meals according to:
    - each day must contain at least one protein and at least one carb among all meals
    """

    def is_valid(self, day_profiles: List[Dict]) -> bool:
        if not day_profiles:
            return False

        has_protein = any(p.get("protein", False) for p in day_profiles)
        has_carb = any(p.get("carb", False) for p in day_profiles)

        return has_protein and has_carb
