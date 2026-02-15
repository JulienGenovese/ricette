"""Test per il service layer: delete, update, search, season filter."""
from unittest.mock import patch

import pytest

from src.model import Recipe, CategorizedRecipe, DishType


@pytest.fixture
def service():
    """Crea un RecipeService con dati finti senza toccare Excel."""
    from api.service import RecipeService

    svc = RecipeService()

    recipes = [
        CategorizedRecipe(
            recipe=Recipe("Pasta pomodoro", "pomodoro 200g, pasta 100g", "Estate", "glucidica", "fibra"),
            dish_type=DishType.PRIMO,
        ),
        CategorizedRecipe(
            recipe=Recipe("Pollo arrosto", "pollo 300g, patate 200g", "Tutto l'anno", "proteica", "fibra"),
            dish_type=DishType.SECONDO,
        ),
        CategorizedRecipe(
            recipe=Recipe("Insalata mista", "lattuga 150g, pomodoro 100g", "Primavera", "fibra", ""),
            dish_type=DishType.CONTORNO,
        ),
        CategorizedRecipe(
            recipe=Recipe("Risotto funghi", "riso 200g, funghi 150g", "Autunno", "glucidica", "fibra"),
            dish_type=DishType.PRIMO,
        ),
    ]

    svc._all_recipes = recipes
    svc._profiles = {
        recipes[0].recipe: {"protein": False, "carb": True, "fiber": True},
        recipes[1].recipe: {"protein": True, "carb": False, "fiber": True},
        recipes[2].recipe: {"protein": False, "carb": False, "fiber": True},
        recipes[3].recipe: {"protein": False, "carb": True, "fiber": True},
    }
    svc._dish_type_map = {cr.recipe: cr.dish_type.value for cr in recipes}
    svc._weights = {cr.recipe.name: 1.0 for cr in recipes}

    return svc


class TestGetAllDetails:
    def test_returns_all_recipes(self, service):
        details = service.get_all_details()
        assert len(details) == 4
        names = {d["name"] for d in details}
        assert "Pasta pomodoro" in names
        assert "Pollo arrosto" in names

    def test_detail_fields(self, service):
        details = service.get_all_details()
        pasta = next(d for d in details if d["name"] == "Pasta pomodoro")
        assert pasta["dish_type"] == "PRIMI"
        assert "pomodoro" in pasta["ingredients"]
        assert pasta["seasonality"] == "Estate"


class TestSearchRecipes:
    def test_search_by_name(self, service):
        results = service.search_recipes("pasta")
        assert len(results) == 1
        assert results[0]["name"] == "Pasta pomodoro"

    def test_search_by_ingredient(self, service):
        results = service.search_recipes("pomodoro")
        assert len(results) == 2  # Pasta pomodoro + Insalata mista

    def test_search_case_insensitive(self, service):
        results = service.search_recipes("POLLO")
        assert len(results) == 1
        assert results[0]["name"] == "Pollo arrosto"

    def test_search_no_results(self, service):
        results = service.search_recipes("sushi")
        assert len(results) == 0


class TestDeleteRecipe:
    def test_delete_existing(self, service):
        with patch("api.recipe_crud.remove_from_excel"), \
             patch.object(service, "load"):
            result = service.delete_recipe("Pasta pomodoro")
            assert result is True

    def test_delete_not_found(self, service):
        result = service.delete_recipe("Ricetta Inesistente")
        assert result is False


class TestUpdateRecipe:
    def test_update_not_found(self, service):
        result = service.update_recipe("Ricetta Inesistente", {"name": "Nuova"})
        assert result is False


class TestMatchesSeason:
    def test_matches_same_season(self, service):
        from api.plan_generator import matches_season
        cr = service._all_recipes[0]  # Estate
        assert matches_season(cr, "Estate") is True

    def test_rejects_different_season(self, service):
        from api.plan_generator import matches_season
        cr = service._all_recipes[0]  # Estate
        assert matches_season(cr, "Inverno") is False

    def test_year_round_always_matches(self, service):
        from api.plan_generator import matches_season
        cr = service._all_recipes[1]  # Tutto l'anno
        assert matches_season(cr, "Inverno") is True
        assert matches_season(cr, "Estate") is True

    def test_empty_seasonality_matches(self):
        from api.plan_generator import matches_season
        cr = CategorizedRecipe(
            recipe=Recipe("Test", "ing", "", "fibra", ""),
            dish_type=DishType.PRIMO,
        )
        assert matches_season(cr, "Inverno") is True

    def test_all_keyword_matches_any_season(self):
        """Recipes with seasonality 'All' should match any season."""
        from api.plan_generator import matches_season
        cr = CategorizedRecipe(
            recipe=Recipe("Test All", "ing", "All", "fibra", ""),
            dish_type=DishType.PRIMO,
        )
        assert matches_season(cr, "Inverno") is True
        assert matches_season(cr, "Estate") is True
