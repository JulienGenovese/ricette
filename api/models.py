"""Pydantic schemas per request/response dell'API."""
from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    """Richiesta di generazione piano settimanale."""
    num_people: int = Field(ge=1, le=20, default=2)
    excluded_recipes: list[str] = Field(default_factory=list)
    season: str | None = Field(
        default=None,
        description="Stagione per filtrare le ricette (Primavera, Estate, Autunno, Inverno). None = auto dalla data corrente.",
    )
    recipe_files: list[str] | None = Field(
        default=None,
        description="File di ricette da usare (nomi file .xlsx). None = tutti i file.",
    )


class IngredientOut(BaseModel):
    """Singolo ingrediente con quantita' scalata per numero di persone."""
    name: str
    quantity: float | None
    unit: str | None = None


class RecipeOut(BaseModel):
    """Ricetta con ingredienti scalati e informazioni nutrizionali."""
    name: str
    ingredients: list[IngredientOut]
    dish_type: str
    nutrients: list[str]


class MealOut(BaseModel):
    """Singolo pasto (pranzo o cena) con le sue ricette."""
    recipes: list[RecipeOut]


class DayOut(BaseModel):
    """Giornata con i suoi pasti."""
    meals: dict[str, MealOut]


class ShoppingItem(BaseModel):
    """Singolo elemento della lista della spesa."""
    name: str
    quantity: float | None
    unit: str | None = None


class GenerateResponse(BaseModel):
    """Risposta completa: piano settimanale + lista della spesa."""
    plan: dict[str, DayOut]
    shopping_list: list[ShoppingItem]
    excluded_recipes: list[str]


class ExportRequest(BaseModel):
    """Richiesta di export piano o lista della spesa."""
    data: GenerateResponse
    num_people: int = Field(ge=1, le=20, default=2)


class ReplaceRequest(BaseModel):
    """Richiesta di sostituzione di una singola ricetta nel piano."""
    plan: dict[str, DayOut]
    day: str
    meal: str
    recipe_name: str
    excluded_recipes: list[str] = Field(default_factory=list)


class ReplaceResponse(BaseModel):
    """Risposta alla sostituzione: piano aggiornato o errore."""
    success: bool
    plan: dict[str, DayOut] | None = None
    shopping_list: list[ShoppingItem] | None = None
    excluded_recipes: list[str] = Field(default_factory=list)
    message: str | None = None


class AddRecipeRequest(BaseModel):
    """Richiesta di aggiunta di una nuova ricetta."""
    category: str
    name: str
    ingredients: str
    seasonality: str
    source1: str
    source2: str = ""


class AddRecipeResponse(BaseModel):
    """Risposta all'aggiunta di una ricetta."""
    success: bool
    message: str


class RecipeListItem(BaseModel):
    """Ricetta nell'elenco completo."""
    name: str
    dish_type: str


class RecipeListResponse(BaseModel):
    """Elenco di tutte le ricette disponibili."""
    recipes: list[RecipeListItem]


class FeaturedRecipeItem(BaseModel):
    """Ricetta in vetrina sulla home page."""
    name: str
    dish_type: str
    nutrients: list[str]


class FeaturedRecipesResponse(BaseModel):
    """Ricette del giorno mostrate sulla landing page."""
    recipes: list[FeaturedRecipeItem]


class PreferencesRequest(BaseModel):
    """Ricette selezionate dall'utente come preferite."""
    recipes: list[str]


# --- New models for recipe management ---

class DeleteRecipeResponse(BaseModel):
    """Risposta alla cancellazione di una ricetta."""
    success: bool
    message: str


class UpdateRecipeRequest(BaseModel):
    """Richiesta di modifica di una ricetta esistente."""
    category: str | None = None
    name: str | None = None
    ingredients: str | None = None
    seasonality: str | None = None
    source1: str | None = None
    source2: str | None = None


class UpdateRecipeResponse(BaseModel):
    """Risposta alla modifica di una ricetta."""
    success: bool
    message: str


class RecipeDetailItem(BaseModel):
    """Ricetta con tutti i dettagli per la gestione."""
    name: str
    dish_type: str
    ingredients: str
    seasonality: str
    nutrients: list[str]
    source1: str
    source2: str


class RecipeDetailResponse(BaseModel):
    """Lista completa di ricette con tutti i dettagli."""
    recipes: list[RecipeDetailItem]


class RecipeFilesResponse(BaseModel):
    """Lista dei file di ricette disponibili."""
    files: list[str]


# --- Auth / User models ---


class LoginSyncResponse(BaseModel):
    """Response after login sync with Firestore."""
    uid: str
    email: str
    display_name: str | None = None
    gdpr_consent: bool = False
    preferences: dict = Field(default_factory=dict)


class UserPreferencesRequest(BaseModel):
    """User preferences to save."""
    preferred_recipes: list[str] = Field(default_factory=list)
    default_num_people: int = Field(ge=1, le=20, default=2)
    default_season: str | None = None


class SavePlanRequest(BaseModel):
    """Save a generated plan to user's Firestore collection."""
    label: str
    num_people: int = Field(ge=1, le=20, default=2)
    plan: dict
    shopping_list: list
    excluded_recipes: list[str] = Field(default_factory=list)


class SavePlanResponse(BaseModel):
    """Response after saving a plan."""
    id: str
    success: bool


class UserPlanListResponse(BaseModel):
    """List of saved plans."""
    plans: list[dict]


class UserRecipeRequest(BaseModel):
    """User-created recipe."""
    category: str
    name: str
    ingredients: str
    seasonality: str
    source1: str
    source2: str = ""


class UserRecipeResponse(BaseModel):
    """Response after adding a user recipe."""
    id: str
    success: bool
