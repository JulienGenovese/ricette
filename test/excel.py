# tests/test_excel.py
import pytest
from src.config import RECIPES_DIR
from src.excel import RecipeRepository, ShoppingListGenerator, PlanExcelWriter
from src.model import Recipe

class TestRecipeRepository:
    """Test per RecipeRepository"""
    
    @pytest.fixture
    def filepath(self):
        """Fixture che fornisce il percorso del file Excel"""
        return RECIPES_DIR
    
    @pytest.fixture
    def repository(self, filepath):
        """Fixture che crea un'istanza di RecipeRepository"""
        return RecipeRepository(filepath)

    def test_categories_exist(self, repository):
        """Test che tutte le 4 categorie siano presenti"""
        expected_categories = {"PRIMI", "SECONDI", "PIATTI UNICI", "CONTORNI"}
        assert set(repository.CATEGORIES) == expected_categories
    
    def test_load_recipes_returns_dict(self, repository):
        """Test che load_recipes ritorni un dizionario"""
        recipes, _ = repository.load_recipes()
        assert isinstance(recipes, dict)
    
    def test_load_recipes_has_all_categories(self, repository):
        """Test che il dizionario contenga tutte le categorie"""
        recipes, _ = repository.load_recipes()
        assert set(recipes.keys()) == {"PRIMI", "SECONDI", "PIATTI UNICI", "CONTORNI"}
    
    def test_load_recipes_values_are_lists(self, repository):
        """Test che i valori siano liste"""
        recipes, _ = repository.load_recipes()
        for category, recipe_list in recipes.items():
            assert isinstance(recipe_list, list), f"{category} non è una lista"
    
    @pytest.mark.parametrize("category", ["PRIMI", "SECONDI", "PIATTI UNICI", "CONTORNI"])
    def test_each_category_has_recipes(self, repository, category):
        """Test che ogni categoria abbia almeno una ricetta"""
        recipes, _ = repository.load_recipes()
        assert len(recipes[category]) > 0, f"Nessuna ricetta in {category}"
    
    def test_recipe_attributes(self, repository):
        """Test che ogni ricetta abbia gli attributi richiesti"""
        recipes, _ = repository.load_recipes()
        required_attrs = {'name', 'ingredients', 'seasonality', 'source1', 'source2'}
        
        for category, recipe_list in recipes.items():
            for recipe in recipe_list:
                for attr in required_attrs:
                    assert hasattr(recipe, attr), \
                        f"Ricetta in {category} non ha attributo '{attr}'"
    
    def test_recipe_names_not_empty(self, repository):
        """Test che i nomi delle ricette non siano vuoti"""
        recipes, _ = repository.load_recipes()
        
        for category, recipe_list in recipes.items():
            for recipe in recipe_list:
                assert recipe.name and str(recipe.name).strip(), \
                    f"Ricetta con nome vuoto in {category}"
    
    def test_recipe_types(self, repository):
        """Test che le ricette siano istanze di Recipe"""
        recipes, _ = repository.load_recipes()
        
        for category, recipe_list in recipes.items():
            for recipe in recipe_list:
                assert isinstance(recipe, Recipe), \
                    f"Elemento in {category} non è una Recipe"
