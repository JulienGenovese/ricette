import os
import re
from typing import List, Tuple, Optional, Dict as DictType
import pandas as pd
from difflib import SequenceMatcher

from src.model import Recipe
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter
from typing import Dict, List

class RecipeRepository:
    CATEGORIES = ["PRIMI", "SECONDI", "PIATTI UNICI", "CONTORNI"]
    
    def __init__(self, filepath: str):
        self._filepath = filepath

    def load_recipes(self) -> Dict[str, List[Recipe]]:
        """
        Carica ricette da tutti i sheet del workbook.
        Ritorna: {categoria: [lista_ricette]}
        """
        recipes_by_category = {}
        required_cols = {"RICETTA", "INGREDIENTI", "STAGIONALITA", "FONTE", "FONTE 2"}

        for category in self.CATEGORIES:
            try:
                df = pd.read_excel(self._filepath, sheet_name=category)
                
                if not required_cols.issubset(df.columns):
                    raise ValueError(f"Colonne mancanti nel sheet {category}")

                recipes = [
                    Recipe(
                        name=row["RICETTA"],
                        ingredients=row["INGREDIENTI"],
                        seasonality=row["STAGIONALITA"],
                        source1=row["FONTE"],
                        source2=row["FONTE 2"],
                    )
                    for _, row in df.iterrows()
                ]
                recipes_by_category[category] = recipes
            except ValueError:
                recipes_by_category[category] = []

        return recipes_by_category

class BaseExcelWriter:
    def __init__(self, output_path: str, sheet_name: str):
        self.output_path = output_path
        self.wb = Workbook()
        self.ws = self.wb.active
        self.ws.title = sheet_name

        self.header_font = Font(bold=True)
        self.font = Font(bold=False)

        self.align_center = Alignment(horizontal="center", vertical="center")
        self.align_left = Alignment(horizontal="left", vertical="center")

    def save(self):
        dirpath = os.path.dirname(self.output_path)
        if dirpath:
            os.makedirs(dirpath, exist_ok=True)
        self.wb.save(self.output_path)
        
class PlanExcelWriter(BaseExcelWriter):
    def __init__(self, output_path: str):
        super().__init__(output_path, "Piano Settimanale")

        self.fills = {
            "Giorno": PatternFill("solid", "BDD7EE"),
            "Pasto": PatternFill("solid", "C6E0B4"),
            "Ricette": PatternFill("solid", "F8CBAD"),
            "Nutrienti": PatternFill("solid", "FFF2CC"),
        }

    def write(self, plan):
        self.ws.append(["Giorno", "Pasto", "Ricette", "Nutrienti"])

        for day, meals in plan.items():
            for meal, data in meals.items():
                if isinstance(data, dict):
                    recipes = data.get("recipes", [])
                    nutrients = data.get("nutrients", "")
                else:
                    recipes = data
                    nutrients = ""

                self.ws.append([day, meal, ", ".join(r.name for r in recipes), nutrients])

        self._format()
        self.save()

    def _format(self):
        for col in self.ws.iter_cols():
            header = col[0].value
            fill = self.fills.get(header)

            for i, cell in enumerate(col):
                cell.font = self.header_font if i == 0 else self.font
                if header == "Ricette" or header == "Nutrienti":
                    cell.alignment = self.align_left
                else:
                    cell.alignment = self.align_center
                if i == 0 and fill:
                    cell.fill = fill

class ShoppingListWriter(BaseExcelWriter):
    def __init__(self, output_path: str):
        super().__init__(output_path, "Lista della Spesa")

    def write(self, shopping_list, aggregations=None):
        self.ws.append(["Ingrediente", "Quantità", "Unità", "Varianti Aggregate"])

        for cell in self.ws[1]:
            cell.font = self.header_font
            cell.alignment = self.align_center

        for ingredient, (qty, unit) in sorted(shopping_list.items()):
            variants = ", ".join(
                v for v in aggregations.get(ingredient, []) if v != ingredient
            ) if aggregations else ""

            self.ws.append([
                ingredient,
                f"{qty:.2f}".rstrip("0").rstrip(".") if qty else "",
                unit or "",
                variants
            ])

        self.save()

if __name__ == "__main__":
    reader = RecipeRepository("dati/ricette/Cucina ottimizzata.xlsx")
    df_all = reader.load_recipes()
    print(df_all)
import os
import re
from typing import List, Tuple, Optional, Dict as DictType
import pandas as pd
from difflib import SequenceMatcher

from src.model import Recipe
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter
from typing import Dict, List

class RecipeRepository:
    CATEGORIES = ["PRIMI", "SECONDI", "PIATTI UNICI", "CONTORNI"]
    
    def __init__(self, filepath: str):
        self._filepath = filepath

    def load_recipes(self) -> Dict[str, List[Recipe]]:
        """
        Carica ricette da tutti i sheet del workbook.
        Ritorna: {categoria: [lista_ricette]}
        """
        recipes_by_category = {}
        required_cols = {"RICETTA", "INGREDIENTI", "STAGIONALITA", "FONTE", "FONTE 2"}

        for category in self.CATEGORIES:
            try:
                df = pd.read_excel(self._filepath, sheet_name=category)
                
                if not required_cols.issubset(df.columns):
                    raise ValueError(f"Colonne mancanti nel sheet {category}")

                recipes = [
                    Recipe(
                        name=row["RICETTA"],
                        ingredients=row["INGREDIENTI"],
                        seasonality=row["STAGIONALITA"],
                        source1=row["FONTE"],
                        source2=row["FONTE 2"],
                    )
                    for _, row in df.iterrows()
                ]
                recipes_by_category[category] = recipes
            except ValueError:
                recipes_by_category[category] = []

        return recipes_by_category

class BaseExcelWriter:
    def __init__(self, output_path: str, sheet_name: str):
        self.output_path = output_path
        self.wb = Workbook()
        self.ws = self.wb.active
        self.ws.title = sheet_name

        self.header_font = Font(bold=True)
        self.font = Font(bold=False)

        self.align_center = Alignment(horizontal="center", vertical="center")
        self.align_left = Alignment(horizontal="left", vertical="center")

    def save(self):
        dirpath = os.path.dirname(self.output_path)
        if dirpath:
            os.makedirs(dirpath, exist_ok=True)
        self.wb.save(self.output_path)
        
class PlanExcelWriter(BaseExcelWriter):
    def __init__(self, output_path: str):
        super().__init__(output_path, "Piano Settimanale")

        self.fills = {
            "Giorno": PatternFill("solid", "BDD7EE"),
            "Pasto": PatternFill("solid", "C6E0B4"),
            "Ricette": PatternFill("solid", "F8CBAD"),
            "Nutrienti": PatternFill("solid", "FFF2CC"),
        }

    def write(self, plan):
        self.ws.append(["Giorno", "Pasto", "Ricette", "Nutrienti"])

        for day, meals in plan.items():
            for meal, data in meals.items():
                if isinstance(data, dict):
                    recipes = data.get("recipes", [])
                    nutrients = data.get("nutrients", "")
                else:
                    recipes = data
                    nutrients = ""

                self.ws.append([day, meal, ", ".join(r.name for r in recipes), nutrients])

        self._format()
        self.save()

    def _format(self):
        for col in self.ws.iter_cols():
            header = col[0].value
            fill = self.fills.get(header)

            for i, cell in enumerate(col):
                cell.font = self.header_font if i == 0 else self.font
                if header == "Ricette" or header == "Nutrienti":
                    cell.alignment = self.align_left
                else:
                    cell.alignment = self.align_center
                if i == 0 and fill:
                    cell.fill = fill

class ShoppingListWriter(BaseExcelWriter):
    def __init__(self, output_path: str):
        super().__init__(output_path, "Lista della Spesa")

    def write(self, shopping_list, aggregations=None):
        self.ws.append(["Ingrediente", "Quantità", "Unità", "Varianti Aggregate"])

        for cell in self.ws[1]:
            cell.font = self.header_font
            cell.alignment = self.align_center

        for ingredient, (qty, unit) in sorted(shopping_list.items()):
            variants = ", ".join(
                v for v in aggregations.get(ingredient, []) if v != ingredient
            ) if aggregations else ""

            self.ws.append([
                ingredient,
                f"{qty:.2f}".rstrip("0").rstrip(".") if qty else "",
                unit or "",
                variants
            ])

        self.save()

if __name__ == "__main__":
    reader = RecipeRepository("dati/ricette/Cucina ottimizzata.xlsx")
    df_all = reader.load_recipes()
    print(df_all)
