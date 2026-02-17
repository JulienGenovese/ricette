"""Test per gli endpoint utente (/api/user/*)."""

from unittest.mock import patch


class TestUserSync:
    def test_sync_creates_user(self, client, mock_verify_token, auth_headers):
        user_service = client.app.state.user_service
        with patch.object(
            user_service,
            "create_or_update_user",
            return_value={
                "display_name": "Test User",
                "gdpr_consent": True,
                "preferences": {"preferred_recipes": [], "default_num_people": 2},
            },
        ) as mock_create:
            resp = client.post("/api/user/sync", headers=auth_headers)
            assert resp.status_code == 200
            data = resp.json()
            assert data["uid"] == "test-uid-123"
            assert data["gdpr_consent"] is True
            mock_create.assert_called_once_with(
                uid="test-uid-123",
                email="test@example.com",
                name="Test User",
                provider="google.com",
            )


class TestGdprConsent:
    def test_accept_gdpr(self, client, mock_verify_token, auth_headers):
        user_service = client.app.state.user_service
        with patch.object(user_service, "accept_gdpr") as mock_gdpr:
            resp = client.post("/api/user/gdpr-consent", headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["success"] is True
            mock_gdpr.assert_called_once_with("test-uid-123")


class TestUserPlans:
    def test_save_plan(self, client, mock_verify_token, auth_headers):
        user_service = client.app.state.user_service
        with patch.object(
            user_service, "save_plan", return_value="plan-id-abc"
        ) as mock_save:
            resp = client.post(
                "/api/user/plans",
                json={
                    "label": "Piano test",
                    "num_people": 2,
                    "plan": {"Lun": {}},
                    "shopping_list": [],
                    "excluded_recipes": [],
                },
                headers=auth_headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["id"] == "plan-id-abc"
            assert data["success"] is True
            mock_save.assert_called_once()

    def test_list_plans(self, client, mock_verify_token, auth_headers):
        user_service = client.app.state.user_service
        with patch.object(
            user_service,
            "get_plans",
            return_value=[{"id": "p1", "label": "Piano 1"}],
        ):
            resp = client.get("/api/user/plans", headers=auth_headers)
            assert resp.status_code == 200
            assert len(resp.json()["plans"]) == 1

    def test_delete_plan_found(self, client, mock_verify_token, auth_headers):
        user_service = client.app.state.user_service
        with patch.object(user_service, "delete_plan", return_value=True):
            resp = client.delete("/api/user/plans/plan-id-abc", headers=auth_headers)
            assert resp.status_code == 200

    def test_delete_plan_not_found(self, client, mock_verify_token, auth_headers):
        user_service = client.app.state.user_service
        with patch.object(user_service, "delete_plan", return_value=False):
            resp = client.delete("/api/user/plans/nonexistent", headers=auth_headers)
            assert resp.status_code == 404


class TestUserRecipes:
    def test_add_recipe(self, client, mock_verify_token, auth_headers):
        user_service = client.app.state.user_service
        with patch.object(
            user_service, "add_user_recipe", return_value="recipe-id-xyz"
        ):
            resp = client.post(
                "/api/user/recipes",
                json={
                    "category": "PRIMI",
                    "name": "Pasta test",
                    "ingredients": "pasta 100g",
                    "seasonality": "Estate",
                    "source1": "glucidica",
                    "source2": "",
                },
                headers=auth_headers,
            )
            assert resp.status_code == 200
            assert resp.json()["id"] == "recipe-id-xyz"

    def test_list_recipes(self, client, mock_verify_token, auth_headers):
        user_service = client.app.state.user_service
        with patch.object(
            user_service,
            "get_user_recipes",
            return_value=[{"id": "r1", "name": "Test"}],
        ):
            resp = client.get("/api/user/recipes", headers=auth_headers)
            assert resp.status_code == 200
            assert len(resp.json()["recipes"]) == 1

    def test_delete_recipe_found(self, client, mock_verify_token, auth_headers):
        user_service = client.app.state.user_service
        with patch.object(user_service, "delete_user_recipe", return_value=True):
            resp = client.delete(
                "/api/user/recipes/recipe-id-xyz", headers=auth_headers
            )
            assert resp.status_code == 200

    def test_delete_recipe_not_found(self, client, mock_verify_token, auth_headers):
        user_service = client.app.state.user_service
        with patch.object(user_service, "delete_user_recipe", return_value=False):
            resp = client.delete(
                "/api/user/recipes/nonexistent", headers=auth_headers
            )
            assert resp.status_code == 404


class TestGdprDataExport:
    def test_export_data(self, client, mock_verify_token, auth_headers):
        user_service = client.app.state.user_service
        with patch.object(
            user_service,
            "export_user_data",
            return_value={
                "profile": {"email": "test@example.com"},
                "plans": [],
                "recipes": [],
            },
        ):
            resp = client.get("/api/user/data-export", headers=auth_headers)
            assert resp.status_code == 200
            data = resp.json()
            assert "profile" in data
            assert "plans" in data
            assert "recipes" in data


class TestAccountDeletion:
    def test_delete_account(self, client, mock_verify_token, auth_headers):
        user_service = client.app.state.user_service
        with patch.object(user_service, "delete_user_data"):
            resp = client.delete("/api/user/account", headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["success"] is True

    def test_delete_account_unauthenticated(self, client):
        resp = client.delete("/api/user/account")
        assert resp.status_code == 401
