import { initializeApp } from “https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js”;

import {
getAuth,
createUserWithEmailAndPassword,
signInWithEmailAndPassword,
setPersistence,
browserLocalPersistence,
onAuthStateChanged,
signOut
} from “https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js”;

import {
getDatabase,
ref,
get,
set,
push,
onChildAdded,
serverTimestamp
} from “https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js”;

import { firebaseConfig } from “./firebase-config.js”;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = (id) => document.getElementById(id);

const authScreen = $(“authScreen”);
const chatScreen = $(“chatScreen”);
const authForm = $(“authForm”);
const emailInput = $(“email”);
const passwordInput = $(“password”);
const usernameInput = $(“username”);
const usernameGroup = $(“usernameGroup”);
const loginTab = $(“loginTab”);
const registerTab = $(“registerTab”);
const authTitle = $(“authTitle”);
const authSubmit = $(“authSubmit”);
const authError = $(“authError”);
const chatForm = $(“chatForm”);
const messageInput = $(“messageInput”);
const messagesContainer = $(“messages”);
const logoutButton = $(“logoutButton”);

let authMode = “login”;
let currentUser = null;
let currentProfile = null;
let messagesStarted = false;

function showError(message) {
if (authError) {
authError.textContent = message;
authError.hidden = false;
} else {
alert(message);
}
}

function clearError() {
if (authError) {
authError.textContent = “”;
authError.hidden = true;
}
}

function setAuthMode(mode) {
authMode = mode;
clearError();

if (usernameGroup) {
usernameGroup.hidden = mode !== “register”;
}

if (authTitle) {
authTitle.textContent =
mode === “register” ? “Buat akun” : “Selamat datang”;
}

if (authSubmit) {
authSubmit.textContent =
mode === “register” ? “Daftar” : “Login”;
}

loginTab?.classList.toggle(“active”, mode === “login”);
registerTab?.classList.toggle(“active”, mode === “register”);
}

loginTab?.addEventListener(“click”, () => setAuthMode(“login”));
registerTab?.addEventListener(“click”, () => setAuthMode(“register”));

setAuthMode(“login”);

async function loadProfile(user) {
const profileRef = ref(db, users/${user.uid});
const snapshot = await get(profileRef);

if (snapshot.exists()) {
return snapshot.val();
}

// Buat profil dasar jika profil belum tersedia.
const fallbackProfile = {
username: user.displayName || user.email?.split(”@”)[0] || “Anonim”,
email: user.email || “”,
createdAt: Date.now()
};

await set(profileRef, fallbackProfile);
return fallbackProfile;
}

function showChat(user, profile) {
currentUser = user;
currentProfile = profile;

if (authScreen) authScreen.hidden = true;
if (chatScreen) chatScreen.hidden = false;

const usernameDisplay = $(“currentUsername”);
if (usernameDisplay) {
usernameDisplay.textContent = profile.username || “Anonim”;
}

startMessagesListener();
}

function showAuth() {
currentUser = null;
currentProfile = null;

if (authScreen) authScreen.hidden = false;
if (chatScreen) chatScreen.hidden = true;
}

authForm?.addEventListener(“submit”, async (event) => {
event.preventDefault();
clearError();

const email = emailInput?.value.trim();
const password = passwordInput?.value;
const username = usernameInput?.value.trim();

if (!email || !password) {
showError(“Email dan password wajib diisi.”);
return;
}

if (authMode === “register” && !username) {
showError(“Username wajib diisi.”);
return;
}

try {
if (authSubmit) {
authSubmit.disabled = true;
authSubmit.textContent = “Memproses…”;
}

await setPersistence(auth, browserLocalPersistence);
if (authMode === "register") {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  await set(ref(db, `users/${credential.user.uid}`), {
    username,
    email,
    createdAt: Date.now()
  });
} else {
  await signInWithEmailAndPassword(auth, email, password);
}

} catch (error) {
console.error(“Auth error:”, error);
showError(error.message || “Login atau registrasi gagal.”);
} finally {
if (authSubmit) {
authSubmit.disabled = false;
authSubmit.textContent =
authMode === “register” ? “Daftar” : “Login”;
}
}
});

onAuthStateChanged(auth, async (user) => {
if (!user) {
showAuth();
return;
}

try {
const profile = await loadProfile(user);
showChat(user, profile);
} catch (error) {
console.error(“Profile loading error:”, error);
showError(
“Profil gagal dimuat. Periksa akses Firebase Realtime Database.”
);
}
});

function startMessagesListener() {
if (messagesStarted || !messagesContainer) return;

messagesStarted = true;

const messagesRef = ref(db, “messages”);

onChildAdded(messagesRef, (snapshot) => {
const message = snapshot.val();
if (!message) return;

const messageElement = document.createElement("div");
messageElement.className = "message";
const usernameElement = document.createElement("strong");
usernameElement.textContent = message.username || "Anonim";
const textElement = document.createElement("p");
textElement.textContent = message.text || "";
messageElement.append(usernameElement, textElement);
messagesContainer.appendChild(messageElement);
messagesContainer.scrollTop = messagesContainer.scrollHeight;

}, (error) => {
console.error(“Messages listener error:”, error);
});
}

chatForm?.addEventListener(“submit”, async (event) => {
event.preventDefault();

if (!currentUser || !currentProfile) {
alert(“Silakan login terlebih dahulu.”);
return;
}

const text = messageInput?.value.trim();
if (!text) return;

if (text.length > 500) {
alert(“Pesan maksimal 500 karakter.”);
return;
}

try {
await push(ref(db, “messages”), {
username: currentProfile.username || “Anonim”,
text,
createdAt: Date.now(),
serverCreatedAt: Date.now()
});

messageInput.value = "";

} catch (error) {
console.error(“Send message error:”, error);
alert(“Pesan gagal dikirim. Periksa Firebase Rules.”);
}
});

logoutButton?.addEventListener(“click”, async () => {
try {
await signOut(auth);
} catch (error) {
console.error(“Logout error:”, error);
alert(“Gagal logout.”);
}
});
