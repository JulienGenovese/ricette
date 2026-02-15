"""Service layer: bridge tra l'API FastAPI e la logica esistente in src/.

Carica le ricette una volta al startup e orchestra la generazione
del piano settimanale e della lista della spesa per ogni richiesta.
"""
import random
from datetime import datetime

from loguru import logger

from src.config import RECIPES_DIR, NUTRIENT_LABELS
from src.excel import RecipeRepository
from src.list_generator import IngredientParser
from src.model import CategorizedRecipe, Recipe, UnitNormalizer
from src.classifier import classify_recipes

from api.recipe_crud import remove_from_excel, update_recipe_in_excel, add_recipe_to_excel
from api.plan_generator import generate_plan, replace_recipe


class RecipeService:
    """Servizio singleton che gestisce il ciclo di vita delle ricette
    e la generazione dei piani settimanali.

    Viene inizializzato una volta al startup dell'app FastAPI
    e riutilizzato per tutte le richieste successive.
    """

    MAX_RETRIES = 3
    FEATURED_BOOST = 0.15
    USER_FILE_BOOST = 0.20
    PREFERENCE_BOOST = 0.30

    def __init__(self):
        self._all_recipes: list[CategorizedRecipe] = []
        self._profiles: dict[Recipe, dict] = {}
        self._dish_type_map: dict[Recipe, str] = {}
        self._weights: dict[str, float] = {}
        self._parser = IngredientParser(UnitNormalizer())
        self._current_session_file: str | None = None

    def load(self):
        """Carica le ricette dal file Excel e classifica i nutrienti."""
        logger.info("Caricamento ricette da Excel per il servizio API")
        repo = RecipeRepository(RECIPES_DIR)
        raw, user_recipe_names = repo.load_recipes()

        self._all_recipes, self._profiles = classify_recipes(raw)
        self._dish_type_map = {
            cr.recipe: cr.dish_type.value for cr in self._all_recipes
        }

        # Inizializza pesi: tutte a 1.0, boost per ricette utente
        self._weights = {cr.recipe.name: 1.0 for cr in self._all_recipes}
        for name in user_recipe_names:
            if name in self._weights:
                self._weights[name] += self.USER_FILE_BOOST
                logger.debug("Boost peso ricetta utente '{}': {}", name, self._weights[name])

        logger.success("Servizio API pronto: {} ricette caricate", len(self._all_recipes))

    def list_recipes(self) -> list[CategorizedRecipe]:
        """Ritorna tutte le ricette disponibili."""
        return self._all_recipes

    def get_all_details(self) -> list[dict]:
        """Ritorna tutte le ricette con dettagli completi per la gestione."""
        result = []
        for cr in self._all_recipes:
            profile = self._profiles.get(cr.recipe, {})
            nutrients = [
                label for key, label in NUTRIENT_LABELS.items()
                if profile.get(key, False)
            ]
            result.append({
                "name": cr.recipe.name,
                "dish_type": cr.dish_type.value,
                "ingredients": cr.recipe.ingredients,
                "seasonality": cr.recipe.seasonality if isinstance(cr.recipe.seasonality, str) else "",
                "nutrients": nutrients,
                "source1": cr.recipe.source1 if isinstance(cr.recipe.source1, str) else "",
                "source2": cr.recipe.source2 if isinstance(cr.recipe.source2, str) else "",
            })
        return result

    def search_recipes(self, query: str) -> list[dict]:
        """Cerca ricette per nome o ingredienti (case-insensitive, substring)."""
        q = query.lower()
        results = []
        for cr in self._all_recipes:
            name_match = q in cr.recipe.name.lower()
            ing_match = isinstance(cr.recipe.ingredients, str) and q in cr.recipe.ingredients.lower()
            if name_match or ing_match:
                profile = self._profiles.get(cr.recipe, {})
                nutrients = [
                    label for key, label in NUTRIENT_LABELS.items()
                    if profile.get(key, False)
                ]
                results.append({
                    "name": cr.recipe.name,
                    "dish_type": cr.dish_type.value,
                    "ingredients": cr.recipe.ingredients,
                    "seasonality": cr.recipe.seasonality if isinstance(cr.recipe.seasonality, str) else "",
                    "nutrients": nutrients,
                    "source1": cr.recipe.source1 if isinstance(cr.recipe.source1, str) else "",
                    "source2": cr.recipe.source2 if isinstance(cr.recipe.source2, str) else "",
                })
        return results

    def get_featured_recipes(self, n: int = 4) -> list[dict]:
        """Ritorna N ricette casuali per categoria per la selezione preferenze."""
        from src.model import DishType

        by_type: dict[str, list[CategorizedRecipe]] = {}
        for cr in self._all_recipes:
            by_type.setdefault(cr.dish_type.value, []).append(cr)

        result = []
        for dtype in [dt.value for dt in DishType]:
            pool = by_type.get(dtype, [])
            sample_size = min(n, len(pool))
            sampled = random.sample(pool, sample_size) if sample_size > 0 else []
            for cr in sampled:
                profile = self._profiles.get(cr.recipe, {})
                nutrients = [
                    label for key, label in NUTRIENT_LABELS.items()
                    if profile.get(key, False)
                ]
                result.append({
                    "name": cr.recipe.name,
                    "dish_type": dtype,
                    "nutrients": nutrients,
                })

        return result

    def boost_preferred(self, recipe_names: list[str]):
        """Aumenta il peso delle ricette selezionate dall'utente come preferite."""
        for name in recipe_names:
            if name in self._weights:
                self._weights[name] += self.PREFERENCE_BOOST
                logger.debug("Boost preferenza utente '{}': {}", name, self._weights[name])

    def delete_recipe(self, name: str) -> bool:
        """Rimuove una ricetta dalla lista interna e da tutti i file Excel."""
        target = self._recipe_by_name(name)
        if target is None:
            return False

        remove_from_excel(RECIPES_DIR, name)
        self.load()
        return True

    def update_recipe(self, original_name: str, updates: dict) -> bool:
        """Aggiorna una ricetta esistente nei file Excel e ricarica."""
        found = update_recipe_in_excel(RECIPES_DIR, original_name, updates)
        if found:
            self.load()
        return found

    def add_recipe(self, category: str, name: str, ingredients: str,
                   seasonality: str, source1: str, source2: str):
        """Aggiunge una ricetta al file Excel della sessione corrente e ricarica."""
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
        self._current_session_file = add_recipe_to_excel(
            RECIPES_DIR, self._current_session_file, timestamp,
            category, name, ingredients, seasonality, source1, source2,
        )
        self.load()

    def generate_plan(
        self, num_people: int, excluded: list[str], season: str | None = None
    ) -> dict:
        """Genera un piano settimanale completo con lista della spesa."""
        return generate_plan(
            self._all_recipes, self._profiles, self._weights,
            self._dish_type_map, self._parser,
            excluded, num_people, season, self.MAX_RETRIES,
        )

    def replace_recipe(
        self, plan_data: dict, day: str, meal: str,
        recipe_name: str, excluded: list[str],
    ) -> dict:
        """Sostituisce una singola ricetta nel piano mantenendo le regole."""
        return replace_recipe(
            self._all_recipes, self._profiles, self._weights,
            self._dish_type_map, self._parser,
            plan_data, day, meal, recipe_name, excluded,
            self._recipe_by_name,
        )

    def _recipe_by_name(self, name: str) -> CategorizedRecipe | None:
        """Trova una CategorizedRecipe per nome."""
        for cr in self._all_recipes:
            if cr.recipe.name == name:
                return cr
        return None
