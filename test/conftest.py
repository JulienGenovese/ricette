"""Shared pytest fixtures for Firebase mocking."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.app import app
from api.service import RecipeService
from src.model import CategorizedRecipe, DishType, Recipe


def _make_test_recipes():
    recipes = [
        CategorizedRecipe(
            recipe=Recipe(
                "Pasta pomodoro", "pomodoro 200g, pasta 100g", "Estate", "glucidica", "fibra"
            ),
            dish_type=DishType.PRIMO,
        ),
        CategorizedRecipe(
            recipe=Recipe(
                "Pollo arrosto",
                "pollo 300g, patate 200g",
                "Tutto l'anno",
                "proteica",
                "fibra",
            ),
            dish_type=DishType.SECONDO,
        ),
        CategorizedRecipe(
            recipe=Recipe(
                "Insalata mista", "lattuga 150g, pomodoro 100g", "Primavera", "fibra", ""
            ),
            dish_type=DishType.CONTORNO,
        ),
    ]
    profiles = {
        recipes[0].recipe: {"protein": False, "carb": True, "fiber": True},
        recipes[1].recipe: {"protein": True, "carb": False, "fiber": True},
        recipes[2].recipe: {"protein": False, "carb": False, "fiber": True},
    }
    return recipes, profiles


def _setup_service(service, recipes, profiles):
    """Populate a RecipeService with test data."""
    service._all_recipes = recipes
    service._profiles = profiles
    service._dish_type_map = {cr.recipe: cr.dish_type.value for cr in recipes}
    service._weights = {cr.recipe.name: 1.0 for cr in recipes}


TEST_USER_CLAIMS = {
    "uid": "test-uid-123",
    "email": "test@example.com",
    "name": "Test User",
    "email_verified": True,
    "firebase": {"sign_in_provider": "google.com"},
}


@pytest.fixture
def mock_firestore_db():
    """Create a MagicMock Firestore client."""
    return MagicMock()


@pytest.fixture
def client(mock_firestore_db):
    """TestClient that patches load() and Firebase initialization."""
    recipes, profiles = _make_test_recipes()

    def fake_load(self):
        _setup_service(self, recipes, profiles)

    with (
        patch.object(RecipeService, "load", fake_load),
        patch("api.app.init_firebase"),
        patch("api.app.get_firestore_client", return_value=mock_firestore_db),
    ):
        with TestClient(app) as c:
            yield c


@pytest.fixture
def auth_headers():
    """Headers with a fake Bearer token."""
    return {"Authorization": "Bearer fake-test-token"}


@pytest.fixture
def mock_verify_token():
    """Patch token verification to return a test user."""
    with patch(
        "firebase_admin.auth.verify_id_token", return_value=TEST_USER_CLAIMS
    ):
        yield TEST_USER_CLAIMS
