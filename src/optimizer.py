"""Costruzione pasti e pianificazione settimanale."""

import random

from loguru import logger

from src.config import DAYS_ORDER, MEALS_ORDER
from src.model import Recipe, CategorizedRecipe
from src.rules import (
    MealContext, DayContext,
    MealRuleEngine, DayRuleEngine,
)

# Re-export for backward compatibility
from src.classifier import classify_recipes, _enrich_plan  # noqa: F401


class MealBuilder:
    """Costruisce un singolo pasto valido a partire dalle ricette disponibili.

    Prova combinazioni casuali di ricette (max MAX_RECIPES per pasto)
    fino a trovarne una che soddisfa tutte le regole del MealRuleEngine.
    Se il pasto e' a giornata singola (allow_both), tenta anche un
    fallback deterministico prima di arrendersi.
    """

    MAX_RECIPES = 2
    MAX_ATTEMPTS = 10

    def __init__(self, meal_rules: MealRuleEngine, profiles: dict[Recipe, dict],
                 weights: dict[str, float] | None = None):
        self.meal_rules = meal_rules
        self.profiles = profiles
        self.weights = weights or {}

    def _make_ctx(self, tentative: list[CategorizedRecipe], allow_both: bool) -> MealContext:
        return MealContext(
            recipes=[x.recipe for x in tentative],
            profiles=self.profiles,
            dish_types=[x.dish_type for x in tentative],
            allow_both=allow_both,
        )

    def build(
        self,
        available: list[CategorizedRecipe],
        must_have: str | None = None,
        allow_both: bool = False,
    ) -> list[CategorizedRecipe]:
        """Costruisce un pasto valido dalle ricette disponibili.

        Mescola le ricette e prova combinazioni fino a MAX_ATTEMPTS volte.
        must_have forza la presenza di un nutriente specifico (es. "protein").
        allow_both permette proteine + carboidrati nello stesso pasto.
        Solleva RuntimeError se nessuna combinazione valida viene trovata.
        """

        logger.info(
            "Costruzione pasto | ricette disponibili: {} | nutriente obbligatorio: {}",
            len(available),
            must_have,
        )

        for attempt in range(1, self.MAX_ATTEMPTS + 1):
            logger.debug("Tentativo pasto {}/{}", attempt, self.MAX_ATTEMPTS)

            meal: list[CategorizedRecipe] = []
            # Weighted shuffle: higher weight = more likely to appear first
            shuffled = sorted(
                available,
                key=lambda cr: random.random() ** (1.0 / max(self.weights.get(cr.recipe.name, 1.0), 0.01)),
                reverse=True,
            )

            for cr in shuffled:
                if len(meal) >= self.MAX_RECIPES:
                    break

                tentative = meal + [cr]
                ctx = self._make_ctx(tentative, allow_both)

                if not self.meal_rules.validate(ctx):
                    logger.debug(
                        "Scartata combinazione: {}",
                        [x.recipe.name for x in tentative],
                    )
                    continue

                recipes = ctx.recipes

                if allow_both:
                    if not (any(self.profiles[r]["protein"] for r in recipes) and any(self.profiles[r]["carb"] for r in recipes)):
                        logger.debug(
                            "Scartato: non contiene entrambi i nutrienti richiesti in {}",
                            [r.name for r in recipes],
                        )
                        continue

                if must_have:
                    if not any(self.profiles[r][must_have] for r in recipes):
                        logger.debug(
                            "Scartato: manca nutriente obbligatorio '{}' in {}",
                            must_have,
                            [r.name for r in recipes],
                        )
                        continue

                logger.success(
                    "Pasto valido costruito: {}",
                    [r.name for r in recipes],
                )
                return tentative

            if allow_both:
                result = self._fallback_both(available)
                if result:
                    return result

            logger.warning(
                "Tentativo {} fallito: nessuna combinazione valida trovata",
                attempt,
            )

        logger.error("Impossibile costruire un pasto valido")
        raise RuntimeError("Impossibile costruire un pasto valido")

    def _fallback_both(self, available: list[CategorizedRecipe]) -> list[CategorizedRecipe] | None:
        """Ricerca deterministica di una coppia proteina+fibra / carboidrato.

        Usato come fallback quando il tentativo casuale fallisce
        per i giorni a pasto singolo.
        """
        def _by_weight(items):
            return sorted(items, key=lambda c: self.weights.get(c.recipe.name, 1.0), reverse=True)

        pairs = [
            (
                _by_weight([c for c in available if self.profiles[c.recipe].get("protein") and self.profiles[c.recipe].get("fiber")]),
                _by_weight([c for c in available if self.profiles[c.recipe].get("carb")]),
            ),
            (
                _by_weight([c for c in available if self.profiles[c.recipe].get("carb") and self.profiles[c.recipe].get("fiber")]),
                _by_weight([c for c in available if self.profiles[c.recipe].get("protein")]),
            ),
        ]

        for primary, secondary in pairs:
            for p in primary:
                for s in secondary:
                    if p == s:
                        continue
                    ctx = self._make_ctx([p, s], allow_both=True)
                    if self.meal_rules.validate(ctx):
                        logger.success("Pasto valido costruito (fallback): {}", [p.recipe.name, s.recipe.name])
                        return [p, s]

        return None


class WeeklyMealPlanner:
    """Pianificatore settimanale: genera un piano di pasti per 7 giorni."""

    def __init__(
        self,
        recipes: list[CategorizedRecipe],
        profiles: dict,
        builder: MealBuilder,
        day_rules: DayRuleEngine,
    ):
        self.recipes = recipes
        self.builder = builder
        self.day_rules = day_rules
        self.profiles = profiles

    def generate(self) -> dict:
        """Genera e restituisce il piano settimanale completo."""
        logger.info("Avvio generazione piano settimanale")

        used: set[Recipe] = set()
        plan: dict = {}

        for day in DAYS_ORDER:
            logger.info("Pianificazione giorno: {}", day)

            plan[day] = {}
            day_profiles: list[dict] = []
            used_nutrients = {"protein": False, "carb": False}

            for idx, meal_name in enumerate(MEALS_ORDER):
                if day == "Sab" and meal_name == "Cena":
                    logger.info("Salto {} {}", day, meal_name)
                    continue

                prefer = "protein" if idx == 0 else "carb"
                must_have = prefer if not used_nutrients[prefer] else None
                allow_both = day == "Sab" and meal_name == "Pranzo"
                if allow_both:
                    must_have = None

                logger.info(
                    "Costruzione {} | nutriente preferito: {} | obbligatorio: {}",
                    meal_name, prefer, must_have,
                )

                available = [r for r in self.recipes if r.recipe not in used]
                meal = self.builder.build(available, must_have, allow_both=allow_both)

                recipes_list = [x.recipe for x in meal]
                plan[day][meal_name] = recipes_list
                used.update(recipes_list)

                for r in recipes_list:
                    p = self.profiles[r]
                    day_profiles.append(p)
                    if p["protein"]:
                        used_nutrients["protein"] = True
                    if p["carb"]:
                        used_nutrients["carb"] = True

            if not self.day_rules.validate(DayContext(meal_profiles=day_profiles)):
                logger.error("Giorno {} non valido nutrizionalmente", day)
                raise RuntimeError(f"Giorno {day} non valido")

            logger.success("Giorno {} pianificato correttamente", day)

        logger.success("Piano settimanale generato con successo")
        return plan
