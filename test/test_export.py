"""Test per il modulo api/export.py."""
from api.export import scale_quantity, _format_ingredient, _iter_plan_rows


def test_scale_quantity_with_value():
    assert scale_quantity(100, 2) == 200
    assert scale_quantity(50, 3) == 150


def test_scale_quantity_with_none():
    assert scale_quantity(None, 2) is None


def test_scale_quantity_with_zero():
    assert scale_quantity(0, 5) == 0


def test_format_ingredient_with_quantity():
    ing = {"name": "pasta", "quantity": 80, "unit": "g"}
    assert _format_ingredient(ing, 2) == "160g pasta"


def test_format_ingredient_with_quantity_no_unit():
    ing = {"name": "uova", "quantity": 2}
    assert _format_ingredient(ing, 2) == "4 uova"


def test_format_ingredient_without_quantity():
    ing = {"name": "sale", "quantity": None}
    assert _format_ingredient(ing, 2) == "sale"


def test_format_ingredient_zero_quantity():
    ing = {"name": "olio", "quantity": 0}
    assert _format_ingredient(ing, 3) == "olio"


def test_iter_plan_rows_basic():
    plan = {
        "Lun": {"meals": {"Pranzo": {"recipes": [{"name": "A"}]}}},
        "Mar": {"meals": {"Pranzo": {"recipes": [{"name": "B"}]}, "Cena": {"recipes": [{"name": "C"}]}}},
    }
    rows = list(_iter_plan_rows(plan))
    assert len(rows) == 3
    assert rows[0] == ("Lun", "Pranzo", {"recipes": [{"name": "A"}]})
    assert rows[1] == ("Mar", "Pranzo", {"recipes": [{"name": "B"}]})
    assert rows[2] == ("Mar", "Cena", {"recipes": [{"name": "C"}]})


def test_iter_plan_rows_respects_day_order():
    plan = {
        "Dom": {"meals": {"Pranzo": {"recipes": []}}},
        "Lun": {"meals": {"Pranzo": {"recipes": []}}},
    }
    rows = list(_iter_plan_rows(plan))
    assert rows[0][0] == "Lun"
    assert rows[1][0] == "Dom"


def test_iter_plan_rows_skips_missing_days():
    plan = {
        "Lun": {"meals": {"Pranzo": {"recipes": []}}},
    }
    rows = list(_iter_plan_rows(plan))
    assert len(rows) == 1


def test_iter_plan_rows_skips_missing_meals():
    plan = {
        "Lun": {"meals": {"Cena": {"recipes": []}}},
    }
    rows = list(_iter_plan_rows(plan))
    assert len(rows) == 1
    assert rows[0][1] == "Cena"
