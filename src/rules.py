from abc import ABC, abstractmethod
from dataclasses import dataclass
from src.model import DishType, Recipe


@dataclass
class MealContext:
    """Contesto condiviso passato a tutte le regole di un pasto.

    Racchiude le ricette candidate, i loro profili nutrizionali,
    i tipi di piatto e il flag allow_both (usato per i giorni
    con un solo pasto, es. Sabato, dove servono sia proteine che carboidrati).
    """

    recipes: list[Recipe]
    profiles: dict[Recipe, dict]
    dish_types: list[DishType]
    allow_both: bool = False


@dataclass
class DayContext:
    """Contesto condiviso passato a tutte le regole giornaliere.

    Contiene i profili nutrizionali aggregati di tutti i pasti
    pianificati in un dato giorno.
    """

    meal_profiles: list[dict]


class MealRule(ABC):
    """Classe base astratta per le regole di validazione di un singolo pasto.

    Ogni regola concreta riceve un MealContext e restituisce True
    se il pasto lo rispetta, False altrimenti.
    Interfaccia uniforme: tutte le regole hanno la stessa firma,
    cosi' sono intercambiabili (LSP).
    """

    @abstractmethod
    def is_valid(self, ctx: MealContext) -> bool: ...


class DayRule(ABC):
    """Classe base astratta per le regole di validazione giornaliera.

    Analoga a MealRule ma opera a livello di giorno intero,
    ricevendo un DayContext con i profili di tutti i pasti del giorno.
    """

    @abstractmethod
    def is_valid(self, ctx: DayContext) -> bool: ...


class NutritionRule(MealRule):
    """Regola nutrizionale: ogni pasto deve contenere fibra
    e esattamente uno tra proteine o carboidrati.

    Con allow_both=True (giorni a pasto singolo) accetta
    fibra + almeno uno tra proteine e carboidrati,
    permettendo che entrambi siano presenti.
    """

    def is_valid(self, ctx: MealContext) -> bool:
        if not ctx.recipes:
            return False

        has_fiber = any(ctx.profiles.get(r, {}).get("fiber", False) for r in ctx.recipes)
        has_protein = any(ctx.profiles.get(r, {}).get("protein", False) for r in ctx.recipes)
        has_carb = any(ctx.profiles.get(r, {}).get("carb", False) for r in ctx.recipes)

        if not has_fiber:
            return False

        if ctx.allow_both:
            return has_protein or has_carb

        return (has_protein and not has_carb) or (has_carb and not has_protein)


class PiattoUnicoRule(MealRule):
    """Regola di compatibilita' dei tipi di piatto.

    Se nel pasto e' presente un PIATTO_UNICO, deve essere
    l'unico piatto (non puo' essere combinato con primi, secondi, ecc.).
    """

    def is_valid(self, ctx: MealContext) -> bool:
        if not ctx.dish_types:
            return False

        has_piatto_unico = any(dt == DishType.PIATTO_UNICO for dt in ctx.dish_types)
        if has_piatto_unico and len(ctx.dish_types) > 1:
            return False

        return True


class DayNutritionRule(DayRule):
    """Regola nutrizionale giornaliera.

    Verifica che nell'arco della giornata ci sia almeno un pasto
    con proteine e almeno un pasto con carboidrati,
    garantendo una dieta bilanciata.
    """

    def is_valid(self, ctx: DayContext) -> bool:
        if not ctx.meal_profiles:
            return False

        has_protein = any(p.get("protein", False) for p in ctx.meal_profiles)
        has_carb = any(p.get("carb", False) for p in ctx.meal_profiles)

        return has_protein and has_carb


class MealRuleEngine:
    """Motore che aggrega piu' MealRule e le applica tutte in sequenza.

    Un pasto e' valido solo se tutte le regole registrate
    restituiscono True. Permette di aggiungere o rimuovere regole
    senza modificare il codice che le usa.
    """

    def __init__(self, rules: list[MealRule]):
        self.rules = rules

    def validate(self, ctx: MealContext) -> bool:
        """Restituisce True se il pasto rispetta tutte le regole."""
        return all(rule.is_valid(ctx) for rule in self.rules)


class DayRuleEngine:
    """Motore che aggrega piu' DayRule e le applica tutte in sequenza.

    Analogo a MealRuleEngine ma opera a livello giornaliero.
    Un giorno e' valido solo se tutte le regole registrate
    restituiscono True.
    """

    def __init__(self, rules: list[DayRule]):
        self.rules = rules

    def validate(self, ctx: DayContext) -> bool:
        """Restituisce True se il giorno rispetta tutte le regole."""
        return all(rule.is_valid(ctx) for rule in self.rules)
