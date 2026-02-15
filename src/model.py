from dataclasses import dataclass
from enum import Enum


@dataclass(frozen=True)
class Recipe:
    name: str
    ingredients: str
    seasonality: str
    source1: str
    source2: str

    def sources(self) -> list[str]:
        return [s.strip().lower() for s in [self.source1, self.source2] if isinstance(s, str)]


class DishType(Enum):
    PRIMO = "PRIMI"
    SECONDO = "SECONDI"
    PIATTO_UNICO = "PIATTI UNICI"
    CONTORNO = "CONTORNI"


@dataclass(frozen=True)
class CategorizedRecipe:
    recipe: Recipe
    dish_type: DishType


class UnitNormalizer:
    UNIT_ALIASES = {
        "g": "g",
        "kg": "kg",
        "ml": "ml",
        "l": "l",
        "cucchiao": "cucchiaio",
        "cucchiai": "cucchiaio",
        "bicchiere": "bicchiere",
        "bicchieri": "bicchiere",
        "pz": "pz",
        "pezzo": "pz",
        "pezzi": "pz",
        "spicchio": "spicchio",
        "spicchi": "spicchio",
        "fetta": "fetta",
        "fette": "fetta",
    }

    def normalize(self, unit: str | None) -> str | None:
        if not unit:
            return None
        return self.UNIT_ALIASES.get(unit, None)

    def is_known(self, unit: str | None) -> bool:
        if not unit:
            return False
        return unit in self.UNIT_ALIASES


@dataclass(frozen=True)
class Ingredient:
    name: str
    quantity: int | None
    unit: str | None = None


class NutritionClassifier:
    FIBER = "fibra"
    PROTEIN = "proteica"
    CARB = "glucidica"

    @classmethod
    def classify(cls, recipe: Recipe) -> dict[str, bool]:
        cats = recipe.sources()
        return {
            "fiber": cls.FIBER in cats,
            "protein": cls.PROTEIN in cats,
            "carb": cls.CARB in cats,
        }
