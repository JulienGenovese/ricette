"""Firebase Admin SDK initialization and Firestore client."""

import json
import os

import firebase_admin
from firebase_admin import auth, credentials, firestore
from loguru import logger


def init_firebase() -> None:
    """Initialize Firebase Admin SDK. Call once at app startup."""
    if firebase_admin._apps:
        return

    key_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY")
    if key_json:
        cred = credentials.Certificate(json.loads(key_json))
    else:
        cred = credentials.ApplicationDefault()

    firebase_admin.initialize_app(cred)
    logger.info("Firebase Admin SDK initialized")


def get_firestore_client():
    """Get Firestore client. Must be called after init_firebase()."""
    return firestore.client()


def verify_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return the decoded claims."""
    return auth.verify_id_token(id_token)
