from __future__ import annotations

import re
from difflib import SequenceMatcher

from src.model import Ingredient, UnitNormalizer

# Regex compilate una sola volta
_RE_SPLIT_NUM_ALPHA = re.compile(r'(\d+)([a-z])')
_RE_PARSE_INGREDIENT = re.compile(r'([\d./]+)?\s*([a-z°]+)?\s*(.*)')


class IngredientParser:
    def __init__(self, unit_normalizer: UnitNormalizer):
        self.unit_normalizer = unit_normalizer

    def parse(self, raw: str) -> list[Ingredient]:
        if not raw:
            return []

        raw = raw.lower()
        raw = _RE_SPLIT_NUM_ALPHA.sub(r'\1 \2', raw)

        return [
            self._parse_single(part.strip())
            for part in raw.split(",")
            if part.strip()
        ]

    def _parse_single(self, text: str) -> Ingredient:
        match = _RE_PARSE_INGREDIENT.match(text)
        if not match:
            return Ingredient(text, None)

        qty_str, unit, name = match.groups()
        if not qty_str:
            return Ingredient(self._clean_name(text), None)

        quantity = self._parse_quantity(qty_str)

        if self.unit_normalizer.is_known(unit):
            normalized_unit = self.unit_normalizer.normalize(unit)
            name = self._clean_name(name or text)
        else:
            normalized_unit = None
            full_name = ((unit or "") + " " + (name or "")).strip()
            name = self._clean_name(full_name or text)

        return Ingredient(name, quantity, normalized_unit)

    def _parse_quantity(self, qty: str | None) -> int | None:
        if not qty:
            return None
        if "/" in qty:
            a, b = qty.split("/")
            return round(float(a) / float(b))
        return int(float(qty))

    def _clean_name(self, name: str) -> str:
        name = name.strip()
        return name[3:] if name.startswith("di ") else name


class IngredientAggregator:
    def aggregate(self, ingredients: list[Ingredient]) -> tuple[dict[str, int], dict[str, str | None]]:
        quantities: dict[str, int] = {}
        units: dict[str, str | None] = {}
        for ing in ingredients:
            quantities[ing.name] = quantities.get(ing.name, 0) + (ing.quantity or 1)
            if ing.unit and ing.name not in units:
                units[ing.name] = ing.unit
        return quantities, units


class IngredientSimilarityMerger:
    def __init__(self, threshold: float = 0.85):
        self.threshold = threshold

    def merge(
        self, items: dict[str, int], units: dict[str, str | None] | None = None
    ) -> tuple[dict[str, int], dict[str, list[str]], dict[str, str | None]]:

        merged: dict[str, int] = {}
        aggregations: dict[str, list[str]] = {}
        merged_units: dict[str, str | None] = {}
        used: set[str] = set()
        units = units or {}

        for name in sorted(items):
            if name in used:
                continue

            qty = items[name]
            variants = [name]
            unit = units.get(name)
            used.add(name)

            for other in items:
                if other in used:
                    continue
                if self._similar(name, other):
                    qty += items[other]
                    variants.append(other)
                    if not unit:
                        unit = units.get(other)
                    used.add(other)

            merged[name] = qty
            if unit:
                merged_units[name] = unit
            if len(variants) > 1:
                aggregations[name] = variants

        return merged, aggregations, merged_units

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

    def generate(self, recipes) -> tuple[dict[str, int], dict[str, list[str]], dict[str, str | None]]:
        ingredients = []
        for recipe in recipes:
            ingredients.extend(self.parser.parse(recipe.ingredients))

        aggregated, units = self.aggregator.aggregate(ingredients)
        return self.merger.merge(aggregated, units)
