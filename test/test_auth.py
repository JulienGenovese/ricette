"""Test per il middleware di autenticazione Firebase."""

from unittest.mock import patch

from firebase_admin import auth as firebase_auth


class TestAuthMiddleware:
    """Test get_current_user and get_optional_user via protected endpoints."""

    def test_missing_token_returns_401(self, client):
        """Endpoint that requires auth should return 401 without token."""
        resp = client.post("/api/user/sync")
        assert resp.status_code == 401
        assert "mancante" in resp.json()["detail"].lower()

    def test_invalid_token_returns_401(self, client):
        """Invalid token should return 401."""
        with patch(
            "firebase_admin.auth.verify_id_token",
            side_effect=firebase_auth.InvalidIdTokenError("bad"),
        ):
            resp = client.post(
                "/api/user/sync",
                headers={"Authorization": "Bearer invalid-token"},
            )
            assert resp.status_code == 401

    def test_valid_token_passes(self, client, mock_verify_token, auth_headers):
        """Valid token should let the request through."""
        # Mock Firestore to return a user doc
        user_service = client.app.state.user_service
        with patch.object(
            user_service,
            "create_or_update_user",
            return_value={
                "display_name": "Test User",
                "gdpr_consent": False,
                "preferences": {},
            },
        ):
            resp = client.post("/api/user/sync", headers=auth_headers)
            assert resp.status_code == 200
            data = resp.json()
            assert data["uid"] == "test-uid-123"
            assert data["email"] == "test@example.com"

    def test_optional_auth_no_token_succeeds(self, client):
        """Endpoints with optional auth should work without token."""
        resp = client.post(
            "/api/preferences",
            json={"recipes": ["Pasta pomodoro"]},
        )
        assert resp.status_code == 200

    def test_optional_auth_with_token(self, client, mock_verify_token, auth_headers):
        """Endpoints with optional auth should use token when provided."""
        user_service = client.app.state.user_service
        with patch.object(user_service, "save_preferences") as mock_save:
            resp = client.post(
                "/api/preferences",
                json={"recipes": ["Pasta pomodoro"]},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            mock_save.assert_called_once_with("test-uid-123", ["Pasta pomodoro"])
