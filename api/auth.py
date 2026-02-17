"""FastAPI authentication dependency using Firebase ID tokens."""

from dataclasses import dataclass

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from loguru import logger

security = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    """Authenticated user extracted from Firebase token."""

    uid: str
    email: str
    name: str | None
    email_verified: bool
    provider: str


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> CurrentUser:
    """Dependency that validates the Firebase ID token from Authorization header.

    Raises 401 if token is missing or invalid.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Token di autenticazione mancante")

    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
    except (ValueError, firebase_auth.InvalidIdTokenError, firebase_auth.ExpiredIdTokenError,
            firebase_auth.RevokedIdTokenError, firebase_auth.CertificateFetchError) as e:
        logger.warning("Token verification failed: {}", e)
        raise HTTPException(status_code=401, detail="Token non valido o scaduto")

    provider = decoded.get("firebase", {}).get("sign_in_provider", "unknown")

    return CurrentUser(
        uid=decoded["uid"],
        email=decoded.get("email", ""),
        name=decoded.get("name"),
        email_verified=decoded.get("email_verified", False),
        provider=provider,
    )


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> CurrentUser | None:
    """Like get_current_user but returns None if no token is provided."""
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
