# QuickChef

Generatore di piani settimanali bilanciati con ricette italiane.

## Comandi

```bash
uv run uvicorn api.app:app --reload   # dev server (localhost:8000)
uv run pytest                         # tutti i test
uv run pytest test/test_api.py        # singolo file
```

## Architettura

- **`api/`** — FastAPI backend (routes, service layer, auth Firebase, export PDF/Excel)
- **`src/`** — Core logic (optimizer, rules, model, excel, classifier, list_generator)
- **`frontend/`** — Vanilla JS SPA (no framework, ES6 modules)
- **`test/`** — Pytest con mock Firebase (conftest.py ha i fixtures)
- **`dati/ricette/`** — Ricette in file Excel (.xlsx)

## Convenzioni

- Python 3.14, type hints obbligatori, dataclass frozen per i modelli
- Nomi business in italiano (ricetta, piatto, contorno), nomi tecnici in inglese
- Backend: snake_case — Frontend: camelCase
- Package manager: `uv` (mai pip o poetry)
- Pydantic per request/response models in `api/models.py`
- Enum `DishType`: PRIMO, SECONDO, PIATTO_UNICO, CONTORNO
- Loguru per il logging (no print)

## Test

I test mockano Firebase e il caricamento ricette. Fixtures principali in `test/conftest.py`:
`client`, `mock_firestore_db`, `auth_headers`, `mock_verify_token`.
Usa sempre uv per testare tutto cio' che fai.

## Deploy

Docker → Google Cloud Run. Firebase per auth e Firestore per dati utente.
