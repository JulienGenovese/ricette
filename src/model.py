from dataclasses import dataclass
from typing import Dict, List, Optional
from enum import Enum

@dataclass(frozen=True)
class Recipe:
    name: str
    ingredients: str
    seasonality: str
    source1: str
    source2: str

    def sources(self) -> List[str]:
        return [s.strip().lower() for s in [self.source1, self.source2] if isinstance(s, str)]


@dataclass(frozen=True)
class CategorizedRecipe:
    recipe: Recipe
    dish_type: 'DishType'


class DishType(Enum):
    PRIMO = "PRIMI"
    SECONDO = "SECONDI"
    PIATTO_UNICO = "PIATTI UNICI"
    CONTORNO = "CONTORNI"


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

    def normalize(self, unit: Optional[str]) -> Optional[str]:
        if not unit:
            return None
        return self.UNIT_ALIASES.get(unit, unit)


@dataclass(frozen=True)
class Ingredient:
    name: str
    quantity: Optional[float]
    unit: Optional[str]


class NutritionClassifier:
    FIBER = "fibra"
    PROTEIN = "proteica"
    CARB = "glucidica"

    @classmethod
    def classify(cls, recipe: Recipe) -> Dict[str, bool]:
        cats = recipe.sources()
        return {
            "fiber": cls.FIBER in cats,
            "protein": cls.PROTEIN in cats,
            "carb": cls.CARB in cats,
        }
from dataclasses import dataclass
from typing import Dict, List, Optional
from enum import Enum

@dataclass(frozen=True)
class CategorizedRecipe:
    recipe: Recipe
    dish_type: DishType

@dataclass(frozen=True)
class Recipe:
    name: str
    ingredients: str
    seasonality: str
    source1: str
    source2: str

    def sources(self) -> List[str]:
        return [s.strip().lower() for s in [self.source1, self.source2] if isinstance(s, str)]


class DishType(Enum):
    PRIMO = "PRIMI"
    SECONDO = "SECONDI"
    PIATTO_UNICO = "PIATTI UNICI"
    CONTORNO = "CONTORNI"

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

    def normalize(self, unit: Optional[str]) -> Optional[str]:
        if not unit:
            return None
        return self.UNIT_ALIASES.get(unit, unit)


@dataclass(frozen=True)
class Ingredient:
    name: str
    quantity: Optional[float]
    unit: Optional[str]


class NutritionClassifier:
    FIBER = "fibra"
    PROTEIN = "proteica"
    CARB = "glucidica"

    @classmethod
    def classify(cls, recipe: Recipe) -> Dict[str, bool]:
        cats = recipe.sources()
        return {
            "fiber": cls.FIBER in cats,
            "protein": cls.PROTEIN in cats,
            "carb": cls.CARB in cats,
        }