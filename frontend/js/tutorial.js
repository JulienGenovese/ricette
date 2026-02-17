/**
 * Onboarding Tutorial for QuickChef.
 *
 * Step-by-step guided tour with spotlight + tooltip.
 * Skippable, shown on first visit, re-launchable via "?" button.
 */

import { showToast } from "./helpers.js";

const STEPS = [
    {
        target: ".navbar-links",
        page: "menu",
        title: "Navigazione",
        text: "Usa la barra di navigazione per spostarti tra le sezioni: Home, Planner, Ricette e Aggiungi.",
        position: "bottom",
    },
    {
        target: ".menu-grid",
        page: "menu",
        title: "Menu Principale",
        text: "Da qui puoi generare un piano settimanale, aggiungere nuove ricette o gestire quelle esistenti.",
        position: "bottom",
    },
    {
        target: "#btn-generate",
        page: "planner",
        title: "Genera Piano",
        text: "Premi questo pulsante per creare un piano alimentare bilanciato per tutta la settimana.",
        position: "bottom",
    },
    {
        target: ".control-group",
        page: "planner",
        title: "Personalizza",
        text: "Imposta il numero di persone e la stagione per adattare il piano alle tue esigenze.",
        position: "bottom",
    },
    {
        target: "#empty-state",
        page: "planner",
        title: "Il Tuo Piano",
        text: "Qui apparir\u00E0 il piano settimanale con pranzi e cene per ogni giorno. Puoi trascinare i pasti per scambiarli!",
        position: "top",
    },
    {
        target: "#shopping-section",
        page: "planner",
        title: "Lista della Spesa",
        text: "Dopo aver generato un piano, qui troverai la lista della spesa completa con le quantit\u00E0 per tutti gli ingredienti.",
        position: "top",
    },
    {
        target: "#export-controls",
        page: "planner",
        title: "Esporta e Salva",
        text: "Dopo aver generato un piano, potrai esportarlo in Excel o PDF e salvarlo per il futuro.",
        position: "bottom",
        fallback: true,
    },
    {
        target: "[data-page='add-recipe']",
        page: null,
        title: "Aggiungi Ricette",
        text: "Usa la procedura guidata per aggiungere le tue ricette personali con ingredienti, stagionalit\u00E0 e valori nutrizionali.",
        position: "bottom",
    },
    {
        target: "[data-page='manage-recipes']",
        page: null,
        title: "Gestisci Ricette",
        text: "Visualizza, modifica ed elimina tutte le ricette disponibili. Cerca per nome o ingrediente.",
        position: "bottom",
    },
    {
        target: "#btn-theme-toggle",
        page: null,
        title: "Tema Chiaro / Scuro",
        text: "Cambia tra tema chiaro e scuro in qualsiasi momento con questo pulsante.",
        position: "left",
    },
];

const LS_KEY = "quickchef-tutorial-completed";
const PADDING = 8; // px around target
const TOOLTIP_GAP = 12; // px between spotlight and tooltip

let step = 0;
let backdropEl = null;
let spotlightEl = null;
let tooltipEl = null;
let resizeHandler = null;

/* ---- public API ---- */

export function shouldShowTutorial() {
    return !localStorage.getItem(LS_KEY);
}

export function startTutorial() {
    step = 0;
    createOverlay();
    showStep(0);
}

export function skipTutorial() {
    localStorage.setItem(LS_KEY, "true");
    destroyOverlay();
}

export function nextStep() {
    if (step >= STEPS.length - 1) {
        completeTutorial();
        return;
    }
    step++;
    showStep(step);
}

export function prevStep() {
    if (step <= 0) return;
    step--;
    showStep(step);
}

/* ---- overlay lifecycle ---- */

function createOverlay() {
    destroyOverlay(); // clean slate

    backdropEl = document.createElement("div");
    backdropEl.className = "tutorial-backdrop";
    backdropEl.addEventListener("click", (e) => e.stopPropagation());

    spotlightEl = document.createElement("div");
    spotlightEl.className = "tutorial-spotlight";

    tooltipEl = document.createElement("div");
    tooltipEl.className = "tutorial-tooltip";

    document.body.appendChild(backdropEl);
    document.body.appendChild(spotlightEl);
    document.body.appendChild(tooltipEl);

    resizeHandler = () => showStep(step);
    window.addEventListener("resize", resizeHandler);
}

function destroyOverlay() {
    if (backdropEl) { backdropEl.remove(); backdropEl = null; }
    if (spotlightEl) { spotlightEl.remove(); spotlightEl = null; }
    if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
    if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
        resizeHandler = null;
    }
}

/* ---- step rendering ---- */

function showStep(index) {
    const s = STEPS[index];

    // Navigate to the required page if needed
    if (s.page) {
        window.navigateTo(s.page);
        // Wait for page transition animation
        setTimeout(() => positionStep(s), 550);
    } else {
        positionStep(s);
    }
}

function positionStep(s) {
    const el = document.querySelector(s.target);
    const isHidden = !el || el.classList.contains("hidden") ||
                     el.offsetParent === null;

    if (isHidden && s.fallback) {
        showFloating(s);
        return;
    }

    if (isHidden) {
        // Skip this step automatically
        if (step < STEPS.length - 1) { step++; showStep(step); }
        else completeTutorial();
        return;
    }

    const rect = el.getBoundingClientRect();

    // Position spotlight
    spotlightEl.style.display = "block";
    spotlightEl.style.top = `${rect.top - PADDING}px`;
    spotlightEl.style.left = `${rect.left - PADDING}px`;
    spotlightEl.style.width = `${rect.width + PADDING * 2}px`;
    spotlightEl.style.height = `${rect.height + PADDING * 2}px`;

    // Render tooltip content
    renderTooltip(s);
    tooltipEl.classList.remove("tutorial-floating");

    // Position tooltip relative to spotlight
    positionTooltip(s.position, rect);
}

function showFloating(s) {
    spotlightEl.style.display = "none";
    renderTooltip(s);
    tooltipEl.classList.add("tutorial-floating");
    // Reset any inline positioning
    tooltipEl.style.top = "";
    tooltipEl.style.left = "";
}

function renderTooltip(s) {
    const dots = STEPS.map((_, i) => {
        const cls = i === step ? "active" : i < step ? "completed" : "";
        return `<span class="tutorial-dot ${cls}"></span>`;
    }).join("");

    tooltipEl.innerHTML = `
        <button class="tutorial-skip" onclick="skipTutorial()">Salta</button>
        <div class="tutorial-tooltip-title">${s.title}</div>
        <div class="tutorial-tooltip-text">${s.text}</div>
        <div class="tutorial-progress">${dots}</div>
        <div class="tutorial-nav">
            ${step > 0
                ? `<button class="btn-ghost" onclick="tutorialPrev()" style="padding:0.4rem 0.8rem;font-size:0.82rem">Indietro</button>`
                : `<span></span>`}
            <span class="tutorial-spacer"></span>
            <span class="tutorial-step-label">${step + 1} / ${STEPS.length}</span>
            <span class="tutorial-spacer"></span>
            <button class="btn-primary" onclick="tutorialNext()" style="padding:0.4rem 0.8rem;font-size:0.82rem">
                ${step < STEPS.length - 1 ? "Avanti" : "Fine"}
            </button>
        </div>
    `;

    // Re-trigger animation
    tooltipEl.style.animation = "none";
    void tooltipEl.offsetWidth;
    tooltipEl.style.animation = "";
}

function positionTooltip(position, rect) {
    // Reset
    tooltipEl.style.top = "";
    tooltipEl.style.left = "";
    tooltipEl.style.bottom = "";
    tooltipEl.style.right = "";

    const tw = tooltipEl.offsetWidth;
    const th = tooltipEl.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top, left;

    switch (position) {
        case "bottom":
            top = rect.bottom + PADDING + TOOLTIP_GAP;
            left = rect.left + rect.width / 2 - tw / 2;
            break;
        case "top":
            top = rect.top - PADDING - TOOLTIP_GAP - th;
            left = rect.left + rect.width / 2 - tw / 2;
            break;
        case "left":
            top = rect.top + rect.height / 2 - th / 2;
            left = rect.left - PADDING - TOOLTIP_GAP - tw;
            break;
        case "right":
            top = rect.top + rect.height / 2 - th / 2;
            left = rect.right + PADDING + TOOLTIP_GAP;
            break;
        default:
            top = rect.bottom + PADDING + TOOLTIP_GAP;
            left = rect.left + rect.width / 2 - tw / 2;
    }

    // Clamp within viewport
    if (left < 12) left = 12;
    if (left + tw > vw - 12) left = vw - tw - 12;
    if (top < 12) top = 12;
    if (top + th > vh - 12) top = vh - th - 12;

    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
}

/* ---- completion ---- */

function completeTutorial() {
    localStorage.setItem(LS_KEY, "true");
    destroyOverlay();
    window.navigateTo("menu");
    showToast("Tutorial completato! Buon appetito!", "success");
}
