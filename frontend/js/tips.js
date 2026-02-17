/**
 * Tips Widget for the Planner page.
 *
 * Shows rotating tips about app features in a small floating card.
 * Auto-rotates every 8s, manually navigable, permanently dismissible.
 */

const TIPS = [
    {
        icon: "\u{1F4A1}",
        title: "Scambia i pasti",
        text: "Trascina un pasto su un altro per scambiarli tra giorni diversi. Comodo per organizzare la settimana!",
    },
    {
        icon: "\u{274C}",
        title: "Sostituisci ricette",
        text: "Non ti piace una ricetta? Clicca la \u00D7 sulla card per sostituirla con un'alternativa bilanciata.",
    },
    {
        icon: "\u{1F6D2}",
        title: "Lista della spesa",
        text: "Dopo aver generato il piano, espandi la lista della spesa per vedere tutti gli ingredienti necessari.",
    },
    {
        icon: "\u{1F4E6}",
        title: "Esporta in PDF o Excel",
        text: "Usa i pulsanti di esportazione per scaricare il piano o la lista della spesa e portarli al supermercato.",
    },
    {
        icon: "\u{1F4BE}",
        title: "Salva i tuoi piani",
        text: "Clicca 'Salva Piano' per conservare il piano corrente. Puoi ricaricarlo dalla sezione Piani Salvati.",
    },
    {
        icon: "\u{1F5D1}",
        title: "Rimuovi giorni o pasti",
        text: "Clicca la \u00D7 sull'intestazione del giorno o del pasto per rimuoverli dal piano.",
    },
    {
        icon: "\u{1F441}",
        title: "Vista compatta",
        text: "Usa il pulsante 'Compatto' per nascondere ingredienti e badge e avere una vista pi\u00F9 sintetica.",
    },
    {
        icon: "\u{2600}",
        title: "Stagionalit\u00E0",
        text: "Seleziona una stagione per ottenere ricette con ingredienti di stagione. Lascia 'Auto' per la stagione corrente.",
    },
    {
        icon: "\u{1F465}",
        title: "Numero di persone",
        text: "Cambia il numero di persone per ricalcolare automaticamente tutte le quantit\u00E0 degli ingredienti.",
    },
    {
        icon: "\u{2795}",
        title: "Aggiungi le tue ricette",
        text: "Vai alla sezione 'Aggiungi' per inserire le tue ricette preferite. Saranno incluse nei piani futuri!",
    },
];

const LS_KEY = "quickchef-tips-dismissed";
const ROTATION_MS = 8000;

let currentTip = 0;
let rotationTimer = null;
let widgetEl = null;

/* ---- public API ---- */

export function initTips() {
    if (widgetEl) return;
    widgetEl = buildWidget();
    document.getElementById("planner").appendChild(widgetEl);
}

export function showTips() {
    if (localStorage.getItem(LS_KEY) === "true") return;
    if (!widgetEl) initTips();
    currentTip = Math.floor(Math.random() * TIPS.length);
    renderTip();
    widgetEl.classList.remove("tips-hidden");
    // force reflow so the transition plays
    void widgetEl.offsetWidth;
    widgetEl.classList.add("tips-visible");
    startRotation();
}

export function hideTips() {
    if (!widgetEl) return;
    widgetEl.classList.remove("tips-visible");
    stopRotation();
    // after transition, fully hide
    setTimeout(() => {
        if (widgetEl && !widgetEl.classList.contains("tips-visible")) {
            widgetEl.classList.add("tips-hidden");
        }
    }, 450);
}

export function dismissTips() {
    localStorage.setItem(LS_KEY, "true");
    hideTips();
}

export function nextTip() {
    currentTip = (currentTip + 1) % TIPS.length;
    renderTipWithTransition("left");
    resetRotation();
}

export function prevTip() {
    currentTip = (currentTip - 1 + TIPS.length) % TIPS.length;
    renderTipWithTransition("right");
    resetRotation();
}

/* ---- internal ---- */

function buildWidget() {
    const w = document.createElement("div");
    w.className = "tips-widget glass tips-hidden";
    w.id = "tips-widget";
    w.innerHTML = `
        <button class="tips-dismiss" onclick="dismissTips()" title="Non mostrare pi\u00F9">\u00D7</button>
        <div class="tips-content" id="tips-content"></div>
        <div class="tips-footer">
            <button class="tips-nav-btn" onclick="prevTip()">\u2039</button>
            <span class="tips-counter" id="tips-counter"></span>
            <button class="tips-nav-btn" onclick="nextTip()">\u203A</button>
        </div>
    `;
    return w;
}

function renderTip() {
    const tip = TIPS[currentTip];
    const el = document.getElementById("tips-content");
    if (!el) return;
    el.innerHTML = `
        <div class="tips-icon">${tip.icon}</div>
        <div class="tips-title">${tip.title}</div>
        <div class="tips-text">${tip.text}</div>
    `;
    const counter = document.getElementById("tips-counter");
    if (counter) counter.textContent = `${currentTip + 1} / ${TIPS.length}`;
}

function renderTipWithTransition(direction) {
    const el = document.getElementById("tips-content");
    if (!el) return;
    el.classList.add(`tips-slide-out-${direction}`);

    setTimeout(() => {
        renderTip();
        el.classList.remove(`tips-slide-out-${direction}`);
        el.classList.add(`tips-slide-in-${direction}`);

        setTimeout(() => el.classList.remove(`tips-slide-in-${direction}`), 300);
    }, 200);
}

function startRotation() {
    stopRotation();
    rotationTimer = setInterval(() => nextTip(), ROTATION_MS);
}

function stopRotation() {
    if (rotationTimer) {
        clearInterval(rotationTimer);
        rotationTimer = null;
    }
}

function resetRotation() {
    stopRotation();
    startRotation();
}
