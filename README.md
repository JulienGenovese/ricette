# QuickChef - Generatore di Piani Settimanali

Applicazione web full-stack per la generazione automatica di piani alimentari settimanali bilanciati. QuickChef seleziona ricette da un archivio Excel, costruisce pasti equilibrati dal punto di vista nutrizionale e genera liste della spesa aggregate.

## Indice

- [Architettura](#architettura)
- [Struttura del Progetto](#struttura-del-progetto)
- [Prerequisiti e Installazione](#prerequisiti-e-installazione)
- [Avvio](#avvio)
- [API Endpoints](#api-endpoints)
- [Moduli Core (`src/`)](#moduli-core-src)
- [Backend API (`api/`)](#backend-api-api)
- [Frontend (`frontend/`)](#frontend-frontend)
- [Formato Dati](#formato-dati)
- [Algoritmi Chiave](#algoritmi-chiave)
- [Autenticazione e Sicurezza](#autenticazione-e-sicurezza)
- [Test](#test)
- [Dipendenze](#dipendenze)

---

## Architettura

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│          Vanilla JS SPA + Firebase Auth          │
└──────────────────────┬──────────────────────────┘
                       │ HTTP (JSON)
┌──────────────────────▼──────────────────────────┐
│                Backend (FastAPI)                  │
│  routes.py / user_routes.py → service.py         │
│  auth.py ← Firebase Admin SDK                   │
│  export.py → Excel / PDF                         │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│               Core Logic (src/)                   │
│  optimizer.py → rules.py → list_generator.py     │
│  model.py ← excel.py ← dati/ricette/*.xlsx      │
└─────────────────────────────────────────────────┘
```

**Flusso principale:**
1. Il frontend invia una richiesta di generazione piano
2. Il backend carica le ricette dai file Excel tramite `RecipeService`
3. Il motore di ottimizzazione (`WeeklyMealPlanner`) costruisce 7 giorni di pasti bilanciati
4. Il motore di regole (`MealRuleEngine`, `DayRuleEngine`) valida ogni pasto e giornata
5. Il generatore di lista della spesa aggrega gli ingredienti
6. Il risultato viene restituito come JSON strutturato

---

## Struttura del Progetto

```
ricette/
├── api/                        # Backend FastAPI
│   ├── app.py                  # Entry point, middleware, lifespan
│   ├── routes.py               # Endpoint ricette, pianificazione, export
│   ├── user_routes.py          # Endpoint utente e GDPR
│   ├── models.py               # Schemi Pydantic (request/response)
│   ├── service.py              # RecipeService - orchestrazione logica
│   ├── plan_generator.py       # Generazione piano e sostituzione ricette
│   ├── export.py               # Esportazione Excel e PDF
│   ├── auth.py                 # Autenticazione Firebase (dependency)
│   ├── firebase.py             # Inizializzazione Firebase Admin SDK
│   ├── user_service.py         # Operazioni Firestore per utenti
│   └── recipe_crud.py          # Operazioni CRUD su file Excel
│
├── src/                        # Logica core
│   ├── model.py                # Modelli dati (Recipe, DishType, Ingredient)
│   ├── classifier.py           # Classificazione e arricchimento ricette
│   ├── optimizer.py            # MealBuilder e WeeklyMealPlanner
│   ├── rules.py                # Motore di regole (pasto e giornata)
│   ├── list_generator.py       # Generazione lista della spesa
│   ├── excel.py                # Lettura/scrittura file Excel
│   └── config.py               # Configurazione e costanti
│
├── frontend/                   # SPA Vanilla JavaScript
│   ├── index.html              # Entry point HTML (tutte le pagine)
│   ├── js/
│   │   ├── app.js              # Inizializzazione applicazione
│   │   ├── state.js            # Stato globale
│   │   ├── api.js              # Client API
│   │   ├── auth.js             # Autenticazione Firebase (frontend)
│   │   ├── navigation.js       # Navigazione tra pagine
│   │   ├── planner.js          # Logica UI pianificatore settimanale
│   │   ├── recipes.js          # Wizard ricette e gestione
│   │   ├── theme.js            # Tema chiaro/scuro
│   │   ├── helpers.js          # Funzioni utility
│   │   ├── constants.js        # Costanti frontend
│   │   ├── tutorial.js         # Tutorial interattivo
│   │   └── tips.js             # Sistema di suggerimenti
│   └── css/
│       ├── base.css            # Stili globali e variabili
│       ├── components.css      # Componenti (bottoni, card, form, modal)
│       ├── navbar.css          # Barra di navigazione
│       ├── auth.css            # Pagina autenticazione
│       ├── recipes.css         # Wizard e gestione ricette
│       ├── responsive.css      # Responsive mobile/tablet
│       ├── tips.css            # Tooltip suggerimenti
│       └── print.css           # Stili per stampa
│
├── test/                       # Suite di test
│   ├── conftest.py             # Configurazione pytest
│   ├── test_rules.py           # Test regole nutrizionali
│   ├── test_list_generator.py  # Test lista della spesa
│   ├── test_api.py             # Test endpoint API
│   ├── test_auth.py            # Test autenticazione
│   ├── test_export.py          # Test esportazione
│   ├── test_service.py         # Test service layer
│   ├── test_priority.py        # Test pesi/priorità ricette
│   └── test_user_routes.py     # Test endpoint utente
│
├── scripts/                    # Script di utilità
│   ├── generate_1000_recipes.py
│   ├── generate_healthy_recipes.py
│   ├── generate_ingredienti.py
│   ├── add_procedimento.py
│   └── create_claude_cucina.py
│
├── dati/                       # Dati
│   ├── ricette/                # File Excel con le ricette
│   └── piani_settimanali/      # Piani generati
│
└── pyproject.toml              # Configurazione progetto e dipendenze
```

---

## Prerequisiti e Installazione

**Requisiti:**
- Python >= 3.14
- [uv](https://docs.astral.sh/uv/) (package manager)
- Firebase project (opzionale, per autenticazione utente)

**Installazione:**

```bash
# Clona il repository
git clone <url-repository>
cd ricette

# Installa le dipendenze con uv
uv sync
```

**Configurazione Firebase (opzionale):**

Per abilitare l'autenticazione utente, impostare la variabile d'ambiente con il path al file JSON delle credenziali Firebase:

```bash
export FIREBASE_SERVICE_ACCOUNT_KEY='<contenuto-json-credenziali>'
```

In alternativa, l'applicazione usa Application Default Credentials se disponibili.

---

## Avvio

```bash
# Avvio del server di sviluppo
uv run uvicorn api.app:app --reload
```

L'applicazione sarà disponibile su `http://localhost:8000/`. Il frontend viene servito come file statici dalla stessa porta.

---

## API Endpoints

### Ricette

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `GET` | `/api/recipes` | Lista tutte le ricette (nome e tipo) |
| `GET` | `/api/recipes/all-details` | Dettagli completi di tutte le ricette |
| `GET` | `/api/recipes/search?q=...` | Cerca ricette per nome o ingrediente |
| `GET` | `/api/featured-recipes?n=4` | Ricette casuali per selezione preferenze |
| `GET` | `/api/recipe-files` | Lista file Excel disponibili |
| `POST` | `/api/recipes` | Aggiungi nuova ricetta |
| `PUT` | `/api/recipes/{name}` | Modifica ricetta esistente |
| `DELETE` | `/api/recipes/{name}` | Elimina ricetta |

### Pianificazione

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `POST` | `/api/generate` | Genera piano settimanale |
| `POST` | `/api/replace-recipe` | Sostituisci una ricetta nel piano |
| `POST` | `/api/preferences` | Imposta preferenze ricette (boost pesi) |

### Esportazione

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `POST` | `/api/export/plan/excel` | Esporta piano in Excel |
| `POST` | `/api/export/plan/pdf` | Esporta piano in PDF |
| `POST` | `/api/export/shopping/excel` | Esporta lista spesa in Excel |
| `POST` | `/api/export/shopping/pdf` | Esporta lista spesa in PDF |

### Utente (richiede autenticazione)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `POST` | `/api/user/sync` | Sincronizza/crea profilo utente al login |
| `POST` | `/api/user/gdpr-consent` | Accetta termini GDPR |
| `GET` | `/api/user/preferences` | Ottieni preferenze salvate |
| `POST` | `/api/user/preferences` | Salva preferenze |
| `POST` | `/api/user/plans` | Salva piano |
| `GET` | `/api/user/plans` | Lista piani salvati (max 20) |
| `DELETE` | `/api/user/plans/{plan_id}` | Elimina piano |
| `POST` | `/api/user/recipes` | Aggiungi ricetta personale |
| `GET` | `/api/user/recipes` | Lista ricette personali |
| `PUT` | `/api/user/recipes/{id}` | Modifica ricetta personale |
| `DELETE` | `/api/user/recipes/{id}` | Elimina ricetta personale |
| `GET` | `/api/user/data-export` | Esporta tutti i dati utente (GDPR Art. 20) |
| `DELETE` | `/api/user/account` | Elimina account e dati (GDPR Art. 17) |

### Sistema

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |

---

## Moduli Core (`src/`)

### `model.py` - Modelli Dati

Definisce le strutture dati immutabili del dominio:

- **`DishType`** (Enum) - Tipi di piatto: `PRIMO`, `SECONDO`, `PIATTO_UNICO`, `CONTORNO`
- **`Recipe`** (frozen dataclass) - Ricetta con nome, ingredienti, stagionalità, fonti nutrizionali. Metodo `sources()` restituisce le fonti non vuote.
- **`CategorizedRecipe`** (frozen dataclass) - Ricetta associata al suo `DishType`
- **`Ingredient`** (dataclass) - Ingrediente con nome, quantità e unità di misura
- **`UnitNormalizer`** - Normalizza le unità di misura (g, kg, ml, l, pz, cucchiaio, ecc.)
- **`NutritionClassifier`** - Classifica le ricette per fonte nutrizionale (proteica, glucidica, fibra)

### `classifier.py` - Classificazione Ricette

- **`classify_recipes()`** - Converte ricette grezze in `CategorizedRecipe` con profili nutrizionali
- **`_enrich_plan()`** - Arricchisce il piano con etichette nutrizionali

### `optimizer.py` - Costruzione Pasti e Pianificazione

Contiene la logica principale di generazione del piano:

- **`MealBuilder`** - Costruisce pasti validi da ricette disponibili
  - Usa uno shuffle pesato per la selezione
  - Tenta fino a `MAX_ATTEMPTS` (10) combinazioni
  - Massimo `MAX_RECIPES` (2) per pasto
  - Ricerca deterministica di fallback per pasti con `allow_both`

- **`WeeklyMealPlanner`** - Genera il piano di 7 giorni
  - Usa `MealBuilder` e i motori di regole
  - Traccia le ricette usate per evitare ripetizioni
  - Alterna nutrienti preferiti: pranzo → proteine, cena → carboidrati
  - Gestione speciale: pranzo del sabato è un pasto singolo (piatto unico con sia proteine che carboidrati)

### `rules.py` - Motore di Regole

Sistema di validazione a due livelli basato su classi astratte:

**Regole per pasto** (`MealRule` ABC):
- **`NutritionRule`** - Ogni pasto deve contenere fibra + esattamente una tra proteine/carboidrati. Eccezione: entrambi permessi se `allow_both=True` (pranzo del sabato)
- **`PiattoUnicoRule`** - Un piatto unico deve essere l'unico piatto nel pasto

**Regole per giornata** (`DayRule` ABC):
- **`DayNutritionRule`** - Ogni giornata deve avere almeno un pasto proteico e uno glucidico

**Motori:**
- **`MealRuleEngine`** - Applica tutte le regole pasto in sequenza
- **`DayRuleEngine`** - Applica tutte le regole giornata in sequenza

### `list_generator.py` - Generazione Lista della Spesa

Pipeline completa per trasformare ingredienti delle ricette in lista della spesa:

- **`IngredientParser`** - Parsing di stringhe ingrediente (es. "200g pomodori" → qty=200, unit=g, name=pomodori). Gestisce frazioni (1/2), decimali, unità multiple.
- **`IngredientAggregator`** - Aggrega ingredienti per nome, sommando le quantità
- **`IngredientSimilarityMerger`** - Unisce nomi simili (soglia 85%) per gestire varianti ortografiche
- **`ShoppingListGenerator`** - Orchestratore della pipeline completa con scalatura per numero di persone

### `excel.py` - Operazioni su File Excel

- **`RecipeRepository`** - Carica ricette dai file Excel. Legge 4 fogli: PRIMI, SECONDI, PIATTI UNICI, CONTORNI. Traccia fonti e ricette utente.
- **`PlanExcelWriter`** - Scrive il piano settimanale in Excel con formattazione
- **`ShoppingListWriter`** - Scrive la lista della spesa in Excel
- **`RecipeWriter`** - Scrive/aggiunge ricette a file Excel

### `config.py` - Configurazione

Costanti e percorsi:
- `DATA_DIR` - Directory dati (default: `dati`)
- `RECIPES_DIR` - Directory file ricette
- `PLANS_DIR` - Directory piani generati
- `DAYS_ORDER` - Ordine giorni (Lun-Dom)
- `MEALS_ORDER` - Tipi pasto (Pranzo, Cena)
- Colori per header e righe alternate nelle esportazioni

---

## Backend API (`api/`)

### `app.py` - Entry Point

Inizializza l'applicazione FastAPI:
- **`lifespan()`** - Carica ricette e inizializza Firebase/Firestore all'avvio
- Configura CORS per localhost (porte 8000, 127.0.0.1:8000)
- Monta i file statici del frontend
- Include i router per ricette e utenti

### `routes.py` - Endpoint Principali

Gestisce tutte le operazioni su ricette, pianificazione ed esportazione. Utilizza `RecipeService` come intermediario verso la logica core.

### `user_routes.py` - Endpoint Utente

Endpoint protetti da autenticazione per gestione profilo, preferenze, piani salvati, ricette personali e operazioni GDPR.

### `service.py` - RecipeService

Singleton che orchestra tutta la logica applicativa:
- Carica e filtra le ricette
- Gestisce i pesi per le preferenze utente
- Delega la generazione piano a `plan_generator.py`
- Integra ricette personali degli utenti nella generazione

**Strategia di pesi:**
| Boost | Valore | Descrizione |
|-------|--------|-------------|
| `USER_FILE_BOOST` | +0.20 | Ricette nel file della sessione utente |
| `PREFERENCE_BOOST` | +0.30 | Ricette preferite dall'utente |
| `FEATURED_BOOST` | +0.15 | Per selezione ricette in evidenza |

### `plan_generator.py` - Generazione Piano

- **`generate_plan()`** - Crea piano di 7 giorni rispettando regole nutrizionali e stagionalità
- **`build_result()`** - Costruisce la risposta JSON dal piano interno
- **`replace_recipe()`** - Sostituisce una ricetta mantenendo la validità delle regole
- **`matches_season()`** - Verifica compatibilità stagionale
- **`_current_season()`** - Determina la stagione dalla data corrente

### `export.py` - Esportazione

- **`PlanExporter`** - Esporta piano in Excel o PDF con formattazione, header colorati e righe alternate
- **`ShoppingExporter`** - Esporta lista della spesa in Excel o PDF
- Supporta scalatura per numero di persone

### `auth.py` - Autenticazione

- **`get_current_user()`** - Dependency FastAPI per endpoint protetti. Valida token Firebase.
- **`get_optional_user()`** - Dependency che restituisce `None` se nessun token presente
- Gestisce validazione token, scadenza e revoca

### `firebase.py` - Firebase Admin SDK

- **`init_firebase()`** - Inizializza SDK con credenziali service account o Application Default
- **`get_firestore_client()`** - Restituisce client Firestore
- **`verify_token()`** - Verifica token ID Firebase

### `user_service.py` - Operazioni Firestore

Gestisce tutte le operazioni su Firestore per gli utenti:
- Profilo: creazione, aggiornamento, consenso GDPR
- Preferenze: salvataggio e recupero
- Piani: salvataggio, lista (max 20, ordinati per data), eliminazione
- Ricette personali: CRUD completo
- GDPR: esportazione dati (Art. 20), cancellazione completa (Art. 17)

### `recipe_crud.py` - CRUD su Excel

- **`add_recipe_to_excel()`** - Aggiunge ricetta al file di sessione
- **`update_recipe_in_excel()`** - Modifica ricetta esistente
- **`remove_from_excel()`** - Elimina ricetta da tutti i file Excel
- Validazione path per prevenire directory traversal

---

## Frontend (`frontend/`)

### Pagine

L'applicazione è una SPA con pagine nascoste/visibili tramite CSS:

| Pagina | Descrizione |
|--------|-------------|
| **Landing** | Pagina introduttiva con slideshow |
| **Auth** | Login/registrazione (email o Google) |
| **Preferenze** | Wizard a 4 step per selezionare ricette preferite per categoria |
| **Menu** | Hub principale con 3 azioni (genera piano, aggiungi ricetta, gestisci) |
| **Planner** | Generatore e visualizzatore piano settimanale |
| **Aggiungi Ricetta** | Wizard a 6 step per inserire nuove ricette |
| **Gestione Ricette** | Ricerca, modifica ed eliminazione ricette |

### Moduli JavaScript

| Modulo | Responsabilità |
|--------|----------------|
| `app.js` | Inizializzazione, event listener, collegamento funzioni a `window` |
| `state.js` | Stato globale dell'applicazione (piano, token, preferenze, filtri) |
| `api.js` | Client HTTP per tutti gli endpoint backend |
| `auth.js` | Gestione autenticazione Firebase lato client |
| `navigation.js` | Routing tra pagine, gestione visibilità |
| `planner.js` | UI del pianificatore: generazione, sostituzione, esportazione, salvataggio |
| `recipes.js` | Wizard aggiunta ricette e interfaccia gestione |
| `theme.js` | Toggle tema chiaro/scuro, slideshow sfondi |
| `helpers.js` | Funzioni utility DOM e formattazione |
| `constants.js` | Costanti (endpoint, messaggi, numeri) |
| `tutorial.js` | Tutorial interattivo passo-passo per nuovi utenti |
| `tips.js` | Sistema di suggerimenti contestuali |

### Stili CSS

Organizzati per responsabilità: stili base, componenti, navigazione, autenticazione, ricette, responsive, suggerimenti e stampa. Supporto tema chiaro/scuro tramite variabili CSS.

---

## Formato Dati

### File Excel Ricette (`dati/ricette/`)

Ogni file Excel contiene 4 fogli, uno per tipo di piatto:

| Foglio | Tipo |
|--------|------|
| PRIMI | Primi piatti (pasta, risotti, zuppe) |
| SECONDI | Secondi piatti (carne, pesce, uova) |
| PIATTI UNICI | Piatti unici completi |
| CONTORNI | Contorni e verdure |

**Colonne per foglio:**

| Colonna | Descrizione | Esempio |
|---------|-------------|---------|
| RICETTA | Nome della ricetta | "Pasta al pomodoro" |
| INGREDIENTI | Lista ingredienti separati da virgola | "200g pasta, 400g pomodori, 30ml olio" |
| STAGIONALITA | Stagione | "Tutto l'anno", "Estate", "Inverno" |
| FONTE | Fonte nutrizionale primaria | "Proteica", "Glucidica", "Fibra" |
| FONTE 2 | Fonte nutrizionale secondaria | "Fibra", "" |

**Stagionalità disponibili:** Primavera, Estate, Autunno, Inverno, Tutto l'anno

**Fonti nutrizionali:** Proteica, Glucidica, Fibra

---

## Algoritmi Chiave

### Generazione del Piano Settimanale

```
Per ogni giorno (Lunedì → Domenica):
  Per ogni pasto (Pranzo, Cena):
    1. Determina nutriente preferito (pranzo → proteine, cena → carboidrati)
    2. Filtra ricette disponibili (escludi usate, fuori stagione, escluse)
    3. Ordina con shuffle pesato (peso base + boost preferenze)
    4. Prova fino a 10 combinazioni di max 2 ricette:
       - Valida contro regole pasto (NutritionRule, PiattoUnicoRule)
       - Se valido → seleziona e marca come usate
    5. Valida regole giornata (DayNutritionRule)

Eccezione: Pranzo del sabato → piatto singolo con allow_both=True
           (accetta sia proteine che carboidrati nello stesso pasto)
```

### Sostituzione di una Ricetta

```
1. Costruisci contesto del giorno corrente
2. Identifica le ricette companion (altre ricette nello stesso pasto)
3. Filtra candidati (escludi usate, escluse, già selezionate)
4. Per ogni candidato:
   a. Prova ad aggiungerlo ai companion
   b. Valida regole pasto
   c. Valida regole giornata
   d. Se valido → restituisci piano aggiornato + nuova lista spesa
```

### Generazione Lista della Spesa

```
1. Parsing: per ogni ricetta nel piano, parsa "200g pomodori" → {qty: 200, unit: g, name: pomodori}
2. Aggregazione: somma quantità per ingrediente (es. 200g + 300g pomodori = 500g)
3. Merge similarità: unisci nomi simili con soglia 85% (es. "pomodoro" e "pomodori")
4. Scalatura: moltiplica quantità per numero di persone
5. Restituzione: lista ordinata con nome, quantità totale e unità
```

---

## Autenticazione e Sicurezza

### Firebase Authentication

- **Frontend:** Firebase SDK v10.12.0 per login con email/password e Google OAuth
- **Backend:** Firebase Admin SDK per validazione token ID
- Token passato nell'header `Authorization: Bearer <token>`
- Autenticazione opzionale per la maggior parte degli endpoint (obbligatoria per operazioni utente)

### CORS

Origini consentite:
- `http://localhost:8000`
- `http://127.0.0.1:8000`

Metodi: GET, POST, PUT, DELETE, OPTIONS

### Conformità GDPR

- **Articolo 20 (Portabilità):** `GET /api/user/data-export` - esporta tutti i dati dell'utente in formato JSON
- **Articolo 17 (Diritto all'oblio):** `DELETE /api/user/account` - elimina account Firebase e tutti i dati associati in Firestore
- Consenso GDPR richiesto e tracciato al primo login

---

## Test

Esecuzione della suite di test:

```bash
uv run pytest
```

| File | Copertura |
|------|-----------|
| `test_rules.py` | Regole nutrizionali per pasto e giornata |
| `test_list_generator.py` | Parsing ingredienti, aggregazione, merge similarità |
| `test_api.py` | Endpoint API (ricette, generazione, export) |
| `test_auth.py` | Validazione token e autenticazione |
| `test_export.py` | Esportazione Excel e PDF |
| `test_service.py` | Logica del service layer |
| `test_priority.py` | Sistema di pesi e priorità ricette |
| `test_user_routes.py` | Endpoint utente e GDPR |

---

## Dipendenze

### Produzione

| Pacchetto | Versione | Utilizzo |
|-----------|----------|----------|
| fastapi | >= 0.115.0 | Framework web |
| uvicorn[standard] | >= 0.34.0 | Server ASGI |
| firebase-admin | >= 7.1.0 | Firebase Admin SDK |
| openpyxl | >= 3.1.5 | Lettura/scrittura Excel |
| pandas | >= 2.3.3 | Elaborazione dati |
| reportlab | >= 4.0 | Generazione PDF |
| loguru | >= 0.7.3 | Logging strutturato |

### Sviluppo

| Pacchetto | Versione | Utilizzo |
|-----------|----------|----------|
| pytest | >= 9.0.2 | Framework di test |
| httpx | >= 0.28.1 | Client HTTP per test API |
