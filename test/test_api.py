"""Test per gli endpoint API: DELETE, PUT, search, all-details, season filter."""
from unittest.mock import patch

import pytest

from api.app import app


class TestGetAllDetails:
    def test_returns_all(self, client):
        resp = client.get("/api/recipes/all-details")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["recipes"]) == 3

    def test_detail_fields(self, client):
        resp = client.get("/api/recipes/all-details")
        recipes = resp.json()["recipes"]
        pasta = next(r for r in recipes if r["name"] == "Pasta pomodoro")
        assert pasta["dish_type"] == "PRIMI"
        assert "pomodoro" in pasta["ingredients"]
        assert pasta["seasonality"] == "Estate"


class TestSearchRecipes:
    def test_search_found(self, client):
        resp = client.get("/api/recipes/search", params={"q": "pasta"})
        assert resp.status_code == 200
        assert len(resp.json()["recipes"]) == 1

    def test_search_empty_query(self, client):
        resp = client.get("/api/recipes/search", params={"q": ""})
        assert resp.status_code == 422

    def test_search_no_match(self, client):
        resp = client.get("/api/recipes/search", params={"q": "sushi"})
        assert resp.status_code == 200
        assert len(resp.json()["recipes"]) == 0


class TestDeleteRecipe:
    def test_delete_existing(self, client):
        service = app.state.recipe_service
        with patch("api.recipe_crud.remove_from_excel"), \
             patch.object(service, "load"):
            resp = client.delete("/api/recipes/Pasta pomodoro")
            assert resp.status_code == 200
            assert resp.json()["success"] is True

    def test_delete_not_found(self, client):
        resp = client.delete("/api/recipes/Ricetta Inesistente")
        assert resp.status_code == 404


class TestUpdateRecipe:
    def test_update_not_found(self, client):
        resp = client.put(
            "/api/recipes/Ricetta Inesistente",
            json={"name": "Nuova"},
        )
        assert resp.status_code == 404

    def test_update_empty_body(self, client):
        resp = client.put("/api/recipes/Pasta pomodoro", json={})
        assert resp.status_code == 400

    def test_update_existing(self, client):
        service = app.state.recipe_service
        with patch.object(service, "update_recipe", return_value=True):
            resp = client.put(
                "/api/recipes/Pasta pomodoro",
                json={"name": "Pasta al pesto"},
            )
            assert resp.status_code == 200
            assert resp.json()["success"] is True


class TestGenerateWithSeason:
    def test_season_passed_to_service(self, client):
        service = app.state.recipe_service
        with patch.object(service, "generate_plan", return_value={
            "plan": {},
            "shopping_list": [],
            "excluded_recipes": [],
        }) as mock_gen:
            resp = client.post("/api/generate", json={
                "num_people": 2,
                "excluded_recipes": [],
                "season": "Estate",
            })
            assert resp.status_code == 200
            mock_gen.assert_called_once_with(2, [], "Estate", recipe_files=None)
