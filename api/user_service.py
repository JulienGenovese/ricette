"""User data operations in Firestore: profiles, plans, recipes, GDPR."""

import json
from datetime import datetime, timezone

from firebase_admin import auth as firebase_auth
from google.cloud.firestore_v1 import Client as FirestoreClient
from loguru import logger


class UserService:
    """Manages per-user data in Firestore."""

    def __init__(self, db: FirestoreClient):
        self.db = db

    # --- User Profile ---

    def create_or_update_user(
        self, uid: str, email: str, name: str | None, provider: str
    ) -> dict:
        """Create user document on first login or update on subsequent logins."""
        ref = self.db.collection("users").document(uid)
        doc = ref.get()
        now = datetime.now(timezone.utc)

        if doc.exists:
            ref.update(
                {
                    "updated_at": now,
                    "display_name": name or doc.to_dict().get("display_name"),
                }
            )
            return ref.get().to_dict()

        data = {
            "email": email,
            "display_name": name,
            "provider": provider,
            "created_at": now,
            "updated_at": now,
            "gdpr_consent": False,
            "gdpr_consent_date": None,
            "preferences": {
                "preferred_recipes": [],
                "default_num_people": 2,
                "default_season": None,
            },
        }
        ref.set(data)
        return data

    def accept_gdpr(self, uid: str) -> None:
        ref = self.db.collection("users").document(uid)
        ref.update(
            {
                "gdpr_consent": True,
                "gdpr_consent_date": datetime.now(timezone.utc),
            }
        )

    def get_user(self, uid: str) -> dict | None:
        doc = self.db.collection("users").document(uid).get()
        return doc.to_dict() if doc.exists else None

    # --- Preferences ---

    def save_preferences(
        self,
        uid: str,
        preferred_recipes: list[str],
        default_num_people: int = 2,
        default_season: str | None = None,
    ) -> None:
        ref = self.db.collection("users").document(uid)
        ref.update(
            {
                "preferences": {
                    "preferred_recipes": preferred_recipes,
                    "default_num_people": default_num_people,
                    "default_season": default_season,
                },
                "updated_at": datetime.now(timezone.utc),
            }
        )

    def get_preferences(self, uid: str) -> dict:
        user = self.get_user(uid)
        if user and "preferences" in user:
            return user["preferences"]
        return {"preferred_recipes": [], "default_num_people": 2, "default_season": None}

    # --- Plans ---

    def save_plan(self, uid: str, plan_data: dict) -> str:
        """Save a generated plan. Returns the plan document ID."""
        ref = self.db.collection("users").document(uid).collection("plans").document()
        plan_data["created_at"] = datetime.now(timezone.utc)
        ref.set(plan_data)
        return ref.id

    def get_plans(self, uid: str, limit: int = 20) -> list[dict]:
        """Get user's saved plans, most recent first."""
        plans_ref = (
            self.db.collection("users")
            .document(uid)
            .collection("plans")
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
        )
        return [{"id": doc.id, **doc.to_dict()} for doc in plans_ref.stream()]

    def delete_plan(self, uid: str, plan_id: str) -> bool:
        ref = (
            self.db.collection("users")
            .document(uid)
            .collection("plans")
            .document(plan_id)
        )
        if ref.get().exists:
            ref.delete()
            return True
        return False

    # --- User Recipes ---

    def add_user_recipe(self, uid: str, recipe_data: dict) -> str:
        """Add a recipe to user's personal collection. Returns recipe doc ID."""
        ref = (
            self.db.collection("users")
            .document(uid)
            .collection("recipes")
            .document()
        )
        now = datetime.now(timezone.utc)
        recipe_data["created_at"] = now
        recipe_data["updated_at"] = now
        ref.set(recipe_data)
        return ref.id

    def get_user_recipes(self, uid: str) -> list[dict]:
        """Get all recipes created by this user."""
        recipes_ref = (
            self.db.collection("users").document(uid).collection("recipes")
        )
        return [{"id": doc.id, **doc.to_dict()} for doc in recipes_ref.stream()]

    def update_user_recipe(self, uid: str, recipe_id: str, updates: dict) -> bool:
        ref = (
            self.db.collection("users")
            .document(uid)
            .collection("recipes")
            .document(recipe_id)
        )
        if not ref.get().exists:
            return False
        updates["updated_at"] = datetime.now(timezone.utc)
        ref.update(updates)
        return True

    def delete_user_recipe(self, uid: str, recipe_id: str) -> bool:
        ref = (
            self.db.collection("users")
            .document(uid)
            .collection("recipes")
            .document(recipe_id)
        )
        if not ref.get().exists:
            return False
        ref.delete()
        return True

    # --- GDPR ---

    def export_user_data(self, uid: str) -> dict:
        """Export all user data for GDPR data portability (Article 20)."""
        user = self.get_user(uid)
        plans = self.get_plans(uid, limit=1000)
        recipes = self.get_user_recipes(uid)

        def _serialize(obj):
            if hasattr(obj, "isoformat"):
                return obj.isoformat()
            return obj

        return json.loads(
            json.dumps(
                {"profile": user, "plans": plans, "recipes": recipes},
                default=_serialize,
            )
        )

    def delete_user_data(self, uid: str) -> None:
        """Delete all user data from Firestore (GDPR Article 17 - right to erasure)."""
        user_ref = self.db.collection("users").document(uid)

        for doc in user_ref.collection("plans").stream():
            doc.reference.delete()

        for doc in user_ref.collection("recipes").stream():
            doc.reference.delete()

        user_ref.delete()

        try:
            firebase_auth.delete_user(uid)
        except Exception as e:
            logger.warning("Could not delete Firebase Auth user {}: {}", uid, e)
