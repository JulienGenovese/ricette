"""User authentication and data endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from api.auth import CurrentUser, get_current_user
from api.models import (
    LoginSyncResponse,
    SavePlanRequest,
    SavePlanResponse,
    UserPlanListResponse,
    UserPreferencesRequest,
    UserRecipeRequest,
    UserRecipeResponse,
)

user_router = APIRouter(prefix="/user", tags=["user"])


@user_router.post("/sync", response_model=LoginSyncResponse)
async def sync_user(request: Request, user: CurrentUser = Depends(get_current_user)):
    """Called after frontend login to sync/create user in Firestore."""
    user_service = request.app.state.user_service
    profile = user_service.create_or_update_user(
        uid=user.uid, email=user.email, name=user.name, provider=user.provider
    )
    return LoginSyncResponse(
        uid=user.uid,
        email=user.email,
        display_name=profile.get("display_name"),
        gdpr_consent=profile.get("gdpr_consent", False),
        preferences=profile.get("preferences", {}),
    )


@user_router.post("/gdpr-consent")
async def accept_gdpr(request: Request, user: CurrentUser = Depends(get_current_user)):
    """Record GDPR consent."""
    user_service = request.app.state.user_service
    user_service.accept_gdpr(user.uid)
    return {"success": True}


@user_router.get("/preferences")
async def get_preferences(
    request: Request, user: CurrentUser = Depends(get_current_user)
):
    """Get user's saved preferences."""
    user_service = request.app.state.user_service
    return user_service.get_preferences(user.uid)


@user_router.post("/preferences")
async def save_preferences(
    body: UserPreferencesRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    """Save user preferences to Firestore."""
    user_service = request.app.state.user_service
    user_service.save_preferences(
        user.uid, body.preferred_recipes, body.default_num_people, body.default_season
    )
    return {"success": True}


# --- Plans ---


@user_router.post("/plans", response_model=SavePlanResponse)
async def save_plan(
    body: SavePlanRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    """Save a generated plan to user's collection."""
    user_service = request.app.state.user_service
    plan_id = user_service.save_plan(user.uid, body.model_dump())
    return SavePlanResponse(id=plan_id, success=True)


@user_router.get("/plans", response_model=UserPlanListResponse)
async def list_plans(request: Request, user: CurrentUser = Depends(get_current_user)):
    """List user's saved plans."""
    user_service = request.app.state.user_service
    plans = user_service.get_plans(user.uid)
    return UserPlanListResponse(plans=plans)


@user_router.delete("/plans/{plan_id}")
async def delete_plan(
    plan_id: str, request: Request, user: CurrentUser = Depends(get_current_user)
):
    """Delete a saved plan."""
    user_service = request.app.state.user_service
    if not user_service.delete_plan(user.uid, plan_id):
        raise HTTPException(status_code=404, detail="Piano non trovato")
    return {"success": True}


# --- User Recipes ---


@user_router.post("/recipes", response_model=UserRecipeResponse)
async def add_user_recipe(
    body: UserRecipeRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    """Add a recipe to user's personal collection."""
    user_service = request.app.state.user_service
    recipe_id = user_service.add_user_recipe(user.uid, body.model_dump())
    return UserRecipeResponse(id=recipe_id, success=True)


@user_router.get("/recipes")
async def list_user_recipes(
    request: Request, user: CurrentUser = Depends(get_current_user)
):
    """List user's personal recipes."""
    user_service = request.app.state.user_service
    recipes = user_service.get_user_recipes(user.uid)
    return {"recipes": recipes}


@user_router.put("/recipes/{recipe_id}")
async def update_user_recipe(
    recipe_id: str,
    body: UserRecipeRequest,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
):
    """Update a user's recipe."""
    user_service = request.app.state.user_service
    updates = body.model_dump(exclude_none=True)
    if not user_service.update_user_recipe(user.uid, recipe_id, updates):
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    return {"success": True}


@user_router.delete("/recipes/{recipe_id}")
async def delete_user_recipe(
    recipe_id: str, request: Request, user: CurrentUser = Depends(get_current_user)
):
    """Delete a user's recipe."""
    user_service = request.app.state.user_service
    if not user_service.delete_user_recipe(user.uid, recipe_id):
        raise HTTPException(status_code=404, detail="Ricetta non trovata")
    return {"success": True}


# --- GDPR ---


@user_router.get("/data-export")
async def export_data(
    request: Request, user: CurrentUser = Depends(get_current_user)
):
    """GDPR Article 20: Data portability. Export all user data as JSON."""
    user_service = request.app.state.user_service
    data = user_service.export_user_data(user.uid)
    return JSONResponse(
        content=data,
        headers={
            "Content-Disposition": f'attachment; filename="quickchef-data-{user.uid}.json"'
        },
    )


@user_router.delete("/account")
async def delete_account(
    request: Request, user: CurrentUser = Depends(get_current_user)
):
    """GDPR Article 17: Right to erasure. Delete all user data and account."""
    user_service = request.app.state.user_service
    user_service.delete_user_data(user.uid)
    return {
        "success": True,
        "message": "Account e tutti i dati eliminati con successo",
    }
