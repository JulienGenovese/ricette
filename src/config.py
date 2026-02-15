"""Simple config for project."""
import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", "dati"))
RECIPES_DIR = DATA_DIR / "ricette"
PLANS_DIR = DATA_DIR / "piani_settimanali"

# Etichette nutrienti in italiano (estendibile)
NUTRIENT_LABELS = {"protein": "proteine", "carb": "carboidrati", "fiber": "fibre"}

# Ordine giorni e pasti (single source of truth)
DAYS_ORDER = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
MEALS_ORDER = ["Pranzo", "Cena"]

# Colori header export
PLAN_HEADER_COLOR = "6c5ce7"
PLAN_ALT_COLOR = "f5f6fa"
SHOPPING_HEADER_COLOR = "00b894"
SHOPPING_ALT_COLOR = "f0fff4"

PLAN_EXCEL_FILLS = {
    0: "BDD7EE",
    1: "C6E0B4",
    2: "F8CBAD",
    3: "D9E2F3",
    4: "FFF2CC",
}
