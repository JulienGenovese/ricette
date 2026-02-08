from difflib import SequenceMatcher
import re
from typing import List, Optional

from src.model import Ingredient, UnitNormalizer
from typing import Dict, Tuple

class IngredientParser:
    def __init__(self, unit_normalizer: UnitNormalizer):
        self.unit_normalizer = unit_normalizer

    def parse(self, raw: str) -> List[Ingredient]:
        if not raw:
            return []

        raw = raw.lower()
        raw = re.sub(r'(\d+)([a-z])', r'\1 \2', raw)

        return [
            self._parse_single(part.strip())
            for part in raw.split(",")
            if part.strip()
        ]

    def _parse_single(self, text: str) -> Ingredient:
        match = re.match(r'([\d./]+)?\s*([a-z°]+)?\s*(.*)', text)
        if not match:
            return Ingredient(text, None, None)

        qty_str, unit, name = match.groups()
        # If no quantity was found, treat the whole text as the ingredient name
        if not qty_str:
            return Ingredient(self._clean_name(text), None, None)

        quantity = self._parse_quantity(qty_str)
        unit = self.unit_normalizer.normalize(unit)
        name = self._clean_name(name or text)

        return Ingredient(name, quantity, unit)

    def _parse_quantity(self, qty: Optional[str]) -> Optional[float]:
        if not qty:
            return None
        if "/" in qty:
            a, b = qty.split("/")
            return float(a) / float(b)
        return float(qty)

    def _clean_name(self, name: str) -> str:
        name = name.strip()
        return name[3:] if name.startswith("di ") else name


class IngredientAggregator:
    def aggregate(
        self, ingredients: List[Ingredient]
    ) -> Dict[str, Tuple[float, Optional[str]]]:

        result: Dict[str, Tuple[float, Optional[str]]] = {}

        for ing in ingredients:
            qty, unit = result.get(ing.name, (0, ing.unit))

            normalizer = UnitNormalizer()
            norm_existing = normalizer.normalize(unit)
            norm_new = normalizer.normalize(ing.unit)

            if norm_existing and norm_new and norm_existing != norm_new:
                raise ValueError(
                    f"Unità incoerenti per '{ing.name}': {norm_existing} vs {norm_new}"
                )

            chosen_unit = norm_existing or norm_new
            result[ing.name] = (
                qty + (ing.quantity or 1),
                chosen_unit
            )

        return result


class IngredientSimilarityMerger:
    def __init__(self, threshold: float = 0.85):
        self.threshold = threshold

    def merge(
        self, items: Dict[str, Tuple[float, Optional[str]]]
    ) -> tuple[Dict[str, Tuple[float, Optional[str]]], Dict[str, List[str]]]:

        merged = {}
        aggregations = {}
        used = set()

        for name in sorted(items):
            if name in used:
                continue

            qty, unit = items[name]
            variants = [name]
            used.add(name)

            for other in items:
                if other in used:
                    continue
                if self._similar(name, other):
                    o_qty, o_unit = items[other]
                    if unit == o_unit:
                        qty += o_qty
                        variants.append(other)
                        used.add(other)

            merged[name] = (qty, unit)
            if len(variants) > 1:
                aggregations[name] = variants

        return merged, aggregations

    def _similar(self, a: str, b: str) -> bool:
        return SequenceMatcher(None, a, b).ratio() > self.threshold
    
class ShoppingListGenerator:
    def __init__(
        self,
        parser: IngredientParser,
        aggregator: IngredientAggregator,
        merger: IngredientSimilarityMerger,
    ):
        self.parser = parser
        self.aggregator = aggregator
        self.merger = merger

    def generate(self, recipes) -> tuple:
        ingredients = []
        for recipe in recipes:
            ingredients.extend(self.parser.parse(recipe.ingredients))

        aggregated = self.aggregator.aggregate(ingredients)
        return self.merger.merge(aggregated)
from difflib import SequenceMatcher
import re
from typing import List, Optional

from src.model import Ingredient, UnitNormalizer
from typing import Dict, Tuple

class IngredientParser:
    def __init__(self, unit_normalizer: UnitNormalizer):
        self.unit_normalizer = unit_normalizer

    def parse(self, raw: str) -> List[Ingredient]:
        if not raw:
            return []

        raw = raw.lower()
        raw = re.sub(r'(\d+)([a-z])', r'\1 \2', raw)

        return [
            self._parse_single(part.strip())
            for part in raw.split(",")
            if part.strip()
        ]

    def _parse_single(self, text: str) -> Ingredient:
        match = re.match(r'([\d./]+)?\s*([a-z°]+)?\s*(.*)', text)
        if not match:
            return Ingredient(text, None, None)

        qty_str, unit, name = match.groups()
        # If no quantity was found, treat the whole text as the ingredient name
        if not qty_str:
            return Ingredient(self._clean_name(text), None, None)

        quantity = self._parse_quantity(qty_str)
        unit = self.unit_normalizer.normalize(unit)
        name = self._clean_name(name or text)

        return Ingredient(name, quantity, unit)

    def _parse_quantity(self, qty: Optional[str]) -> Optional[float]:
        if not qty:
            return None
        if "/" in qty:
            a, b = qty.split("/")
            return float(a) / float(b)
        return float(qty)

    def _clean_name(self, name: str) -> str:
        name = name.strip()
        return name[3:] if name.startswith("di ") else name


class IngredientAggregator:
    def aggregate(
        self, ingredients: List[Ingredient]
    ) -> Dict[str, Tuple[float, Optional[str]]]:

        result: Dict[str, Tuple[float, Optional[str]]] = {}

        for ing in ingredients:
            qty, unit = result.get(ing.name, (0, ing.unit))

            normalizer = UnitNormalizer()
            norm_existing = normalizer.normalize(unit)
            norm_new = normalizer.normalize(ing.unit)

            if norm_existing and norm_new and norm_existing != norm_new:
                raise ValueError(
                    f"Unità incoerenti per '{ing.name}': {norm_existing} vs {norm_new}"
                )

            chosen_unit = norm_existing or norm_new
            result[ing.name] = (
                qty + (ing.quantity or 1),
                chosen_unit
            )

        return result


class IngredientSimilarityMerger:
    def __init__(self, threshold: float = 0.85):
        self.threshold = threshold

    def merge(
        self, items: Dict[str, Tuple[float, Optional[str]]]
    ) -> tuple[Dict[str, Tuple[float, Optional[str]]], Dict[str, List[str]]]:

        merged = {}
        aggregations = {}
        used = set()

        for name in sorted(items):
            if name in used:
                continue

            qty, unit = items[name]
            variants = [name]
            used.add(name)

            for other in items:
                if other in used:
                    continue
                if self._similar(name, other):
                    o_qty, o_unit = items[other]
                    if unit == o_unit:
                        qty += o_qty
                        variants.append(other)
                        used.add(other)

            merged[name] = (qty, unit)
            if len(variants) > 1:
                aggregations[name] = variants

        return merged, aggregations

    def _similar(self, a: str, b: str) -> bool:
        return SequenceMatcher(None, a, b).ratio() > self.threshold
    
class ShoppingListGenerator:
    def __init__(
        self,
        parser: IngredientParser,
        aggregator: IngredientAggregator,
        merger: IngredientSimilarityMerger,
    ):
        self.parser = parser
        self.aggregator = aggregator
        self.merger = merger

    def generate(self, recipes) -> tuple:
        ingredients = []
        for recipe in recipes:
            ingredients.extend(self.parser.parse(recipe.ingredients))

        aggregated = self.aggregator.aggregate(ingredients)
        return self.merger.merge(aggregated)
