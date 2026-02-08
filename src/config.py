"""Simple config for project."""
from pathlib import Path

DATA_DIR = Path("dati")
PLANS_DIR = DATA_DIR / "piani_settimanali"

# Etichette nutrienti in italiano (estendibile)
NUTRIENT_LABELS = {"protein": "proteine", "carb": "carboidrati", "fiber": "fibre"}
