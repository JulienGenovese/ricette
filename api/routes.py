"""Endpoint handlers per l'API del piano settimanale."""
from enum import Enum

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from api.export import EXPORT_HANDLERS, EXPORT_MEDIA_TYPES, EXPORT_FILENAMES
from api.models import (
    AddRecipeRequest,
    AddRecipeResponse,
    DeleteRecipeResponse,
    ExportRequest,
    FeaturedRecipesResponse,
    GenerateRequest,
    GenerateResponse,
    PreferencesRequest,
    RecipeDetailResponse,
    RecipeListItem,
    RecipeListResponse,
    ReplaceRequest,
    ReplaceResponse,
    UpdateRecipeRequest,
    UpdateRecipeResponse,
)

router = APIRouter()


class ExportType(str, Enum):
    PLAN = "plan"
    SHOPPING = "shopping"


class ExportFormat(str, Enum):
    EXCEL = "excel"
    PDF = "pdf"


@router.get("/recipes", response_model=RecipeListResponse)
async def list_recipes(request: Request):
    """Ritorna l'elenco completo delle ricette disponibili."""
    service = request.app.state.recipe_service
    recipes = service.list_recipes()
    return RecipeListResponse(
        recipes=[
            RecipeListItem(
                name=cr.recipe.name,
                dish_type=cr.dish_type.value,
            )
            for cr in recipes
        ]
    )


@router.get("/recipes/all-details", response_model=RecipeDetailResponse)
async def all_recipe_details(request: Request):
    """Ritorna tutte le ricette con dettagli completi per la gestione."""
    service = request.app.state.recipe_service
    details = service.get_all_details()
    return RecipeDetailResponse(recipes=details)


@router.get("/recipes/search", response_model=RecipeDetailResponse)
async def search_recipes(request: Request, q: str = ""):
    """Cerca ricette per nome o ingredienti."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Il parametro 'q' e' obbligatorio")
    service = request.app.state.recipe_service
    results = service.search_recipes(q.strip())
    return RecipeDetailResponse(recipes=results)


@router.get("/featured-recipes", response_model=FeaturedRecipesResponse)
async def featured_recipes(request: Request, n: int = 4):
    """Ritorna ricette casuali per la selezione preferenze."""
    service = request.app.state.recipe_service
    recipes = service.get_featured_recipes(n=n)
    return FeaturedRecipesResponse(recipes=recipes)


@router.post("/preferences")
async def set_preferences(body: PreferencesRequest, request: Request):
    """Salva le preferenze dell'utente e aumenta la probabilita' delle ricette selezionate."""
    service = request.app.state.recipe_service
    service.boost_preferred(body.recipes)
    return {"success": True, "boosted": len(body.recipes)}


@router.post("/recipes", response_model=AddRecipeResponse)
async def add_recipe(body: AddRecipeRequest, request: Request):
    """Aggiunge una nuova ricetta e la salva in un file Excel."""
    service = request.app.state.recipe_service
    try:
        service.add_recipe(
            category=body.category,
            name=body.name,
            ingredients=body.ingredients,
            seasonality=body.seasonality,
            source1=body.source1,
            source2=body.source2,
        )
        return AddRecipeResponse(success=True, message=f"Ricetta '{body.name}' salvata con successo!")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante il salvataggio: {e}")


@router.put("/recipes/{name}", response_model=UpdateRecipeResponse)
async def update_recipe(name: str, body: UpdateRecipeRequest, request: Request):
    """Modifica una ricetta esistente."""
    service = request.app.state.recipe_service
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    try:
        found = service.update_recipe(name, updates)
        if not found:
            raise HTTPException(status_code=404, detail=f"Ricetta '{name}' non trovata")
        return UpdateRecipeResponse(success=True, message=f"Ricetta '{name}' aggiornata con successo!")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante l'aggiornamento: {e}")


@router.delete("/recipes/{name}", response_model=DeleteRecipeResponse)
async def delete_recipe(name: str, request: Request):
    """Elimina una ricetta."""
    service = request.app.state.recipe_service
    try:
        found = service.delete_recipe(name)
        if not found:
            raise HTTPException(status_code=404, detail=f"Ricetta '{name}' non trovata")
        return DeleteRecipeResponse(success=True, message=f"Ricetta '{name}' eliminata con successo!")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante l'eliminazione: {e}")


@router.post("/generate", response_model=GenerateResponse)
async def generate_plan(body: GenerateRequest, request: Request):
    """Genera un nuovo piano settimanale con lista della spesa.

    Accetta il numero di persone e una lista opzionale di ricette
    da escludere. Ritorna il piano arricchito e la lista della spesa
    con quantita' scalate.
    """
    service = request.app.state.recipe_service
    try:
        result = service.generate_plan(body.num_people, body.excluded_recipes, body.season)
    except RuntimeError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Impossibile generare il piano: {e}. Prova a escludere meno ricette.",
        )
    return result


@router.post("/replace-recipe", response_model=ReplaceResponse)
async def replace_recipe(body: ReplaceRequest, request: Request):
    """Sostituisce una singola ricetta nel piano mantenendo le regole nutrizionali."""
    service = request.app.state.recipe_service
    plan_data = {day: day_out.model_dump() for day, day_out in body.plan.items()}
    result = service.replace_recipe(
        plan_data, body.day, body.meal, body.recipe_name, body.excluded_recipes
    )
    return result


@router.post("/export/{export_type}/{export_format}")
async def export_file(
    export_type: ExportType, export_format: ExportFormat,
    body: ExportRequest, request: Request,
):
    """Esporta piano o lista della spesa in Excel o PDF."""
    key = (export_type.value, export_format.value)
    handler = EXPORT_HANDLERS[key]

    plan_data = body.data.model_dump()
    buf = handler(plan_data, body.num_people)

    media = EXPORT_MEDIA_TYPES[export_format.value]
    filename = EXPORT_FILENAMES[key]

    return StreamingResponse(
        buf,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
