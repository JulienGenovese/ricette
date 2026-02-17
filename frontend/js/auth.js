/**
 * Firebase Authentication module for QuickChef.
 * Handles login, registration, token management, and auth state.
 */

import { state } from "./state.js";
import { API } from "./api.js";
import { showToast } from "./helpers.js";
import { navigateTo } from "./navigation.js";

/** Initialize auth state listener. Called once from app.js DOMContentLoaded. */
export function initAuth() {
    if (!window.firebaseAuth) return;

    window.firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
            const token = await firebaseUser.getIdToken();
            state.authToken = token;
            state.currentUser = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
            };

            try {
                const syncData = await API.syncUser();
                state.currentUser.gdprConsent = syncData.gdpr_consent;
                state.currentUser.preferences = syncData.preferences;

                if (!syncData.gdpr_consent) {
                    showGdprModal();
                }
            } catch (e) {
                console.error("User sync failed:", e);
            }

            updateAuthUI(true);
        } else {
            state.authToken = null;
            state.currentUser = null;
            updateAuthUI(false);
        }
    });

    window.firebaseAuth.onIdTokenChanged(async (user) => {
        if (user) {
            state.authToken = await user.getIdToken();
        }
    });
}

/** Update navbar UI based on auth state */
function updateAuthUI(isLoggedIn) {
    const loginBtn = document.getElementById("auth-login-btn");
    const userMenu = document.getElementById("user-menu");

    if (isLoggedIn && state.currentUser) {
        loginBtn?.classList.add("hidden");
        userMenu?.classList.remove("hidden");

        const avatar = document.getElementById("user-avatar");
        if (avatar) {
            if (state.currentUser.photoURL) {
                const img = document.createElement("img");
                img.src = state.currentUser.photoURL;
                img.alt = "Avatar";
                img.className = "avatar-img";
                avatar.textContent = "";
                avatar.appendChild(img);
            } else {
                const initial = (state.currentUser.displayName || state.currentUser.email || "U")[0].toUpperCase();
                avatar.textContent = initial;
            }
        }

        const header = document.getElementById("user-dropdown-header");
        if (header) {
            header.textContent = state.currentUser.displayName || state.currentUser.email;
        }
    } else {
        loginBtn?.classList.remove("hidden");
        userMenu?.classList.add("hidden");
    }
}

/** Email/password login */
export async function loginWithEmail() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    if (!email || !password) {
        showAuthError("Inserisci email e password");
        return;
    }

    try {
        await window.firebaseAuth.signInWithEmailAndPassword(email, password);
        navigateTo("menu");
        showToast("Accesso effettuato!", "success");
    } catch (e) {
        showAuthError(firebaseErrorMessage(e.code));
    }
}

/** Email/password registration */
export async function registerWithEmail() {
    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("register-password-confirm").value;
    const gdprCheckbox = document.getElementById("register-gdpr");

    if (!email || !password) {
        showAuthError("Inserisci email e password");
        return;
    }
    if (password !== confirmPassword) {
        showAuthError("Le password non coincidono");
        return;
    }
    if (password.length < 6) {
        showAuthError("La password deve avere almeno 6 caratteri");
        return;
    }
    if (!gdprCheckbox.checked) {
        showAuthError("Devi accettare la privacy policy per registrarti");
        return;
    }

    try {
        const cred = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
        if (name) {
            await cred.user.updateProfile({ displayName: name });
        }
        navigateTo("preferences");
        showToast("Registrazione completata!", "success");
    } catch (e) {
        showAuthError(firebaseErrorMessage(e.code));
    }
}

/** Google OAuth login */
export async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await window.firebaseAuth.signInWithPopup(provider);
        navigateTo("menu");
        showToast("Accesso con Google effettuato!", "success");
    } catch (e) {
        console.error("Google login error:", e.code, e.message);
        if (e.code !== "auth/popup-closed-by-user") {
            showAuthError(firebaseErrorMessage(e.code));
        }
    }
}

/** Logout */
export async function logoutUser() {
    await window.firebaseAuth.signOut();
    state.authToken = null;
    state.currentUser = null;
    navigateTo("landing");
    showToast("Disconnesso", "info");
}

/** Tab switching between login/register */
export function showAuthTab(tab) {
    const loginForm = document.getElementById("auth-login");
    const registerForm = document.getElementById("auth-register");
    const tabs = document.querySelectorAll(".auth-tab");

    tabs.forEach((t) => t.classList.remove("active"));
    if (tab === "login") {
        loginForm.classList.remove("hidden");
        registerForm.classList.add("hidden");
        tabs[0].classList.add("active");
    } else {
        loginForm.classList.add("hidden");
        registerForm.classList.remove("hidden");
        tabs[1].classList.add("active");
    }
    hideAuthError();
}

/** GDPR consent modal */
function showGdprModal() {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
        <div class="modal-overlay">
            <div class="modal glass">
                <h2>Privacy e Trattamento Dati</h2>
                <p>Per utilizzare QuickChef con un account, dobbiamo conservare i tuoi dati
                   (email, piani salvati, ricette, preferenze) su server sicuri in Europa (EU).</p>
                <p>Puoi esportare o eliminare i tuoi dati in qualsiasi momento dal menu utente.</p>
                <div class="modal-actions">
                    <button class="btn-primary" onclick="acceptGdpr()">Acconsento</button>
                    <button class="btn-ghost" onclick="declineGdpr()">Non acconsento</button>
                </div>
            </div>
        </div>`;
}

export async function acceptGdpr() {
    try {
        await API.acceptGdpr();
        state.currentUser.gdprConsent = true;
        document.getElementById("modal-root").innerHTML = "";
        showToast("Consenso registrato", "success");
    } catch (e) {
        showToast("Errore nel salvare il consenso", "error");
    }
}

export async function declineGdpr() {
    document.getElementById("modal-root").innerHTML = "";
    await logoutUser();
    showToast("Per usare un account e' necessario acconsentire al trattamento dati", "warning");
}

/** GDPR: export user data */
export async function exportUserData() {
    try {
        const data = await API.exportUserData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "quickchef-my-data.json";
        a.click();
        URL.revokeObjectURL(url);
        showToast("Dati esportati!", "success");
    } catch (e) {
        showToast("Errore nell'esportazione dei dati", "error");
    }
}

/** GDPR: delete account confirmation */
export function confirmDeleteAccount() {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
        <div class="modal-overlay">
            <div class="modal glass">
                <h2>Elimina Account</h2>
                <p>Questa azione e' irreversibile. Tutti i tuoi dati, piani salvati e ricette
                   saranno eliminati permanentemente.</p>
                <div class="modal-actions">
                    <button class="btn-primary" style="background: var(--danger, #e74c3c)" onclick="deleteAccountConfirmed()">Elimina tutto</button>
                    <button class="btn-ghost" onclick="closeModal()">Annulla</button>
                </div>
            </div>
        </div>`;
}

export async function deleteAccountConfirmed() {
    try {
        await API.deleteAccount();
        await window.firebaseAuth.signOut();
        state.authToken = null;
        state.currentUser = null;
        document.getElementById("modal-root").innerHTML = "";
        navigateTo("landing");
        showToast("Account eliminato con successo", "info");
    } catch (e) {
        showToast("Errore nell'eliminazione dell'account", "error");
    }
}

/** User dropdown toggle */
export function toggleUserDropdown() {
    document.getElementById("user-dropdown")?.classList.toggle("hidden");
}

// --- Helpers ---

function showAuthError(msg) {
    const el = document.getElementById("auth-error");
    if (el) {
        el.textContent = msg;
        el.classList.remove("hidden");
    }
}

function hideAuthError() {
    document.getElementById("auth-error")?.classList.add("hidden");
}

function firebaseErrorMessage(code) {
    const messages = {
        "auth/email-already-in-use": "Questa email e' gia' registrata",
        "auth/invalid-email": "Email non valida",
        "auth/user-not-found": "Nessun account con questa email",
        "auth/wrong-password": "Password errata",
        "auth/invalid-credential": "Email o password errata",
        "auth/weak-password": "Password troppo debole (minimo 6 caratteri)",
        "auth/too-many-requests": "Troppi tentativi. Riprova piu' tardi",
        "auth/network-request-failed": "Errore di rete. Controlla la connessione",
        "auth/popup-closed-by-user": "Finestra di login chiusa",
        "auth/popup-blocked": "Il popup e' stato bloccato dal browser. Consenti i popup per questo sito",
        "auth/operation-not-allowed": "Questo metodo di accesso non e' ancora abilitato. Contatta l'amministratore",
        "auth/unauthorized-domain": "Questo dominio non e' autorizzato per l'accesso. Contatta l'amministratore",
        "auth/cancelled-popup-request": "Operazione annullata",
        "auth/internal-error": "Errore interno di autenticazione. Riprova",
    };
    return messages[code] || `Errore di autenticazione (${code})`;
}
