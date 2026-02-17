export const DAYS_ORDER = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
export const MEALS_ORDER = ["Pranzo", "Cena"];

export const BG_IMAGES = [
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1920&q=80",
    "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=1920&q=80",
    "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1920&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80",
    "https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=1920&q=80",
];

export const TOAST_ICONS = {
    success: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
    error: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
    info: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>',
    warning: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
};

export const SHOPPING_CATEGORIES = [
    {
        label: "Verdure e Frutta",
        keywords: [
            "pomodor", "zucchin", "cipoll", "aglio", "insalata", "lattuga",
            "carote", "carota", "patate", "patata", "peperoni", "peperone",
            "melanzane", "melanzana", "spinaci", "basilico", "prezzemolo",
            "limone", "limoni", "broccol", "cavol", "finocchi", "finocchio",
            "sedano", "funghi", "fungo", "piselli", "fagiol", "ceci",
            "lenticch", "rucola", "radicchio", "carciofi", "carciofo",
            "asparagi", "asparago", "mela", "mele", "arancia", "arance",
            "banana", "banane", "pere", "pera", "olive", "oliva",
            "capperi", "rosmarino", "salvia", "timo", "origano",
            "menta", "erba cipollina", "cetriolo", "cetrioli", "mais",
            "zucca", "verza", "bietola",
        ],
    },
    {
        label: "Carne e Pesce",
        keywords: [
            "pollo", "manzo", "maiale", "vitello", "salsiccia", "salsicce",
            "tonno", "salmone", "merluzzo", "gamberi", "gamberett",
            "prosciutto", "pancetta", "speck", "bresaola", "tacchino",
            "coniglio", "agnello", "cozze", "vongole", "calamari",
            "polpo", "sogliola", "pesce", "acciughe", "alici",
            "mortadella", "guanciale", "lardo",
        ],
    },
    {
        label: "Latticini e Uova",
        keywords: [
            "latte", "mozzarella", "parmigiano", "ricotta", "uova", "uovo",
            "burro", "yogurt", "pecorino", "grana", "gorgonzola",
            "mascarpone", "scamorza", "stracchino", "fontina",
            "provola", "provolone", "panna", "formaggio", "formaggi",
            "emmenthal", "brie", "taleggio",
        ],
    },
    {
        label: "Pasta e Cereali",
        keywords: [
            "pasta", "spaghetti", "penne", "rigatoni", "fusilli", "farfalle",
            "linguine", "tagliatelle", "lasagne", "gnocchi", "riso",
            "pane", "farina", "couscous", "orzo", "farro", "polenta",
            "pangrattato", "crackers", "grissini", "focaccia",
            "pizza", "tortellini", "ravioli",
        ],
    },
    {
        label: "Condimenti e Dispensa",
        keywords: [
            "olio", "sale", "pepe", "aceto", "zucchero", "brodo",
            "salsa", "passata", "concentrato", "dado", "maionese",
            "senape", "ketchup", "soia", "miele", "marmellata",
            "cioccolat", "cacao", "vaniglia", "cannella", "noce moscata",
            "curry", "paprika", "peperoncino", "cumino", "zafferano",
            "lievito", "amido", "fecola", "vino",
        ],
    },
];

export const SHOPPING_CATEGORY_DEFAULT = "Altro";
