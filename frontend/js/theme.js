import { BG_IMAGES } from "./constants.js";
import { state } from "./state.js";

export function initTheme() {
    const saved = localStorage.getItem("quickchef-theme");
    if (saved === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        updateThemeIcon(true);
    }
}

export function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("quickchef-theme", "light");
    } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("quickchef-theme", "dark");
    }
    updateThemeIcon(!isDark);
}

function updateThemeIcon(isDark) {
    const btn = document.getElementById("btn-theme-toggle");
    btn.innerHTML = isDark ? "&#9788;" : "&#9790;";
}

export function startSlideshow(container) {
    stopSlideshow();
    const slides = container.querySelectorAll(".landing-slide, .bg-slide");
    if (slides.length < 2) return;

    slides[0].style.backgroundImage = `url(${BG_IMAGES[0]})`;
    slides[0].classList.add("active");
    state.bgIndex = 0;

    state.slideshowInterval = setInterval(() => {
        state.bgIndex = (state.bgIndex + 1) % BG_IMAGES.length;
        const current = container.querySelector(".landing-slide.active, .bg-slide.active");
        const next = current === slides[0] ? slides[1] : slides[0];

        next.style.backgroundImage = `url(${BG_IMAGES[state.bgIndex]})`;
        next.classList.add("active");
        current.classList.remove("active");
    }, 2000);
}

export function stopSlideshow() {
    if (state.slideshowInterval) {
        clearInterval(state.slideshowInterval);
        state.slideshowInterval = null;
    }
}
