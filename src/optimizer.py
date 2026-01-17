import os
import pickle
from datetime import datetime, timedelta

import pandas as pd

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# SCOPE: lettura e scrittura (modifica fogli)
SCOPES = ["https://docs.google.com/spreadsheets/d/17QH3mF9E3X9LDJo1DXncrWw1-08MT16JKc4N0pyEtz4/edit?usp=drive_link"]

class GoogleSheetsClient:
    def __init__(self, creds_file="credentials.json", token_file="token.json"):
        self.creds_file = creds_file
        self.token_file = token_file
        self.creds = None
        self.service = None
        self.authenticate()

    def authenticate(self):
        if os.path.exists(self.token_file):
            self.creds = Credentials.from_authorized_user_file(self.token_file, SCOPES)
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                self.creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(self.creds_file, SCOPES)
                self.creds = flow.run_local_server(port=0)
            with open(self.token_file, "w") as token:
                token.write(self.creds.to_json())
        self.service = build("sheets", "v4", credentials=self.creds)

    def read_sheet(self, spreadsheet_id, range_name):
        sheet = self.service.spreadsheets()
        result = sheet.values().get(spreadsheetId=spreadsheet_id, range=range_name).execute()
        values = result.get("values", [])
        return values

class MealPlanner:
    def __init__(self, sheet_data):
        """
        sheet_data: lista di liste (rappresenta righe del foglio)
        assumiamo che la prima riga contenga intestazioni
        e che ci sia una colonna 'RICETTA' o simile.
        """
        self.df_raw = pd.DataFrame(sheet_data[1:], columns=sheet_data[0])

    def extract_recipes(self, recipe_col="RICETTA"):
        if recipe_col not in self.df_raw.columns:
            raise KeyError(f"Colonna '{recipe_col}' non trovata nel dataset")
        recipes = self.df_raw[recipe_col].dropna().tolist()
        if not recipes:
            raise ValueError("Nessuna ricetta valida trovata nel dataset")
        return recipes

    def build_week_plan(self, recipes):
        weekdays = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"]
        plan = {"GIORNO": [], "PRANZO": [], "CENA": []}

        idx = 0
        for day in weekdays:
            plan["GIORNO"].append(day)
            plan["PRANZO"].append(recipes[idx % len(recipes)])
            idx += 1
            plan["CENA"].append(recipes[idx % len(recipes)])
            idx += 1

        return pd.DataFrame(plan)

if __name__ == "__main__":
    SPREADSHEET_ID = "17QH3mF9E3X9LDJo1DXncrWw1-08MT16JKc4N0pyEtz4"
    # Usa il range che contiene TUTTE le colonne del tuo dataset (es. "Sheet1!A:Z")
    RANGE_NAME = "Sheet1!A:Z"

    sheets = GoogleSheetsClient()
    raw_data = sheets.read_sheet(SPREADSHEET_ID, RANGE_NAME)

    planner = MealPlanner(raw_data)
    recipes = planner.extract_recipes(recipe_col="RICETTA")  # adatta nome colonna
    week_df = planner.build_week_plan(recipes)

    print(week_df)
    # Salva su CSV se serve
    week_df.to_csv("meal_plan.csv", index=False)
