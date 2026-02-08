"""Utilities for recipes (placeholder).

This module kept minimal helpers; main `Recipe` dataclass is in `model.py`.
"""

def to_display_name(recipe):
    try:
        return recipe.name
    except Exception:
        return str(recipe)
