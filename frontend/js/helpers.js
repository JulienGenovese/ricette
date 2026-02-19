import { TOAST_ICONS } from "./constants.js";
import { state } from "./state.js";

export function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

export function formatQty(qty) {
    if (qty === null || qty === undefined) return "";
    return parseFloat(qty.toFixed(2)).toString();
}

export function roundScaledQty(qty, unit) {
    if (qty === null || qty === undefined || qty === 0) return qty;
    if (unit) {
        return Math.round(qty / 10) * 10 || Math.round(qty);
    }
    return Math.round(qty * 2) / 2 || 0.5;
}

export function showLoading(visible) {
    const skeleton = document.getElementById("skeleton-loading");
    skeleton.classList.toggle("hidden", !visible);
    document.getElementById("btn-generate").disabled = visible;
    if (visible) {
        document.getElementById("empty-state").classList.add("hidden");
    }
}

export function showError(message) {
    const el = document.getElementById("error");
    el.textContent = message;
    el.classList.remove("hidden");
}

export function hideError() {
    document.getElementById("error").classList.add("hidden");
}

export function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add("show"));
    });

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

export function updateExcludedCount() {
    const el = document.getElementById("excluded-count");
    if (state.excludedRecipes.size > 0) {
        el.textContent = `${state.excludedRecipes.size} ricett${state.excludedRecipes.size === 1 ? "a" : "e"} esclus${state.excludedRecipes.size === 1 ? "a" : "e"}`;
    } else {
        el.textContent = "";
    }
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function launchConfetti() {
    const canvas = document.getElementById("confetti-canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#e17055", "#fdcb6e", "#6c5ce7", "#00b894", "#a29bfe", "#55efc4"];
    const particles = [];

    for (let i = 0; i < 80; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 8 + 4,
            h: Math.random() * 4 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 3,
            vy: Math.random() * 3 + 2,
            rot: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 10,
        });
    }

    let frame = 0;
    function animate() {
        if (frame > 120) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.rot += p.rotSpeed;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rot * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, 1 - frame / 120);
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }

        frame++;
        requestAnimationFrame(animate);
    }

    animate();
}
