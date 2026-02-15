"""Test per il modulo src/list_generator.py."""
from src.model import UnitNormalizer, Ingredient
from src.list_generator import (
    IngredientParser,
    IngredientAggregator,
    IngredientSimilarityMerger,
    ShoppingListGenerator,
)


class TestIngredientParser:
    def setup_method(self):
        self.parser = IngredientParser(UnitNormalizer())

    def test_parse_empty_string(self):
        assert self.parser.parse("") == []

    def test_parse_none_like(self):
        assert self.parser.parse(None) == []

    def test_parse_simple_ingredient(self):
        result = self.parser.parse("100g pasta")
        assert len(result) == 1
        assert result[0].name == "pasta"
        assert result[0].quantity == 100
        assert result[0].unit == "g"

    def test_parse_multiple_ingredients(self):
        result = self.parser.parse("100g pasta, 500g pomodoro")
        assert len(result) == 2
        assert result[0].quantity == 100
        assert result[1].quantity == 500

    def test_parse_ingredient_without_quantity(self):
        result = self.parser.parse("sale")
        assert len(result) == 1
        assert result[0].name == "sale"
        assert result[0].quantity is None
        assert result[0].unit is None

    def test_parse_fraction(self):
        result = self.parser.parse("1/2 limone")
        assert len(result) == 1
        assert result[0].quantity == 0  # round(0.5)

    def test_parse_known_unit(self):
        result = self.parser.parse("2 pezzi aglio")
        assert len(result) == 1
        assert result[0].quantity == 2
        assert result[0].unit == "pz"

    def test_clean_name_removes_di_prefix(self):
        assert self.parser._clean_name("di pomodoro") == "pomodoro"
        assert self.parser._clean_name("pasta") == "pasta"


class TestIngredientAggregator:
    def test_aggregate_same_name(self):
        agg = IngredientAggregator()
        ingredients = [
            Ingredient("pasta", 100, "g"),
            Ingredient("pasta", 200, "g"),
        ]
        quantities, units = agg.aggregate(ingredients)
        assert quantities["pasta"] == 300
        assert units["pasta"] == "g"

    def test_aggregate_none_quantity_defaults_to_1(self):
        agg = IngredientAggregator()
        ingredients = [
            Ingredient("sale", None),
            Ingredient("sale", None),
        ]
        quantities, units = agg.aggregate(ingredients)
        assert quantities["sale"] == 2
        assert "sale" not in units

    def test_aggregate_different_names(self):
        agg = IngredientAggregator()
        ingredients = [
            Ingredient("pasta", 100, "g"),
            Ingredient("riso", 200, "g"),
        ]
        quantities, units = agg.aggregate(ingredients)
        assert quantities["pasta"] == 100
        assert quantities["riso"] == 200
        assert units["pasta"] == "g"
        assert units["riso"] == "g"


class TestIngredientSimilarityMerger:
    def test_merge_identical(self):
        merger = IngredientSimilarityMerger()
        items = {"pasta": 100, "riso": 200}
        merged, aggs, merged_units = merger.merge(items)
        assert merged == items
        assert aggs == {}

    def test_merge_similar_names(self):
        merger = IngredientSimilarityMerger(threshold=0.7)
        items = {"pomodoro": 100, "pomodori": 200}
        units = {"pomodoro": "g", "pomodori": "g"}
        merged, aggs, merged_units = merger.merge(items, units)
        assert len(merged) == 1
        total = sum(merged.values())
        assert total == 300
        # "pomodori" comes first alphabetically so it's the merge key
        key = list(merged.keys())[0]
        assert merged_units[key] == "g"
