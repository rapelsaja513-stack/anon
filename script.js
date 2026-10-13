import { initializeApp } from “https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js”;

import {
getDatabase,
ref,
push,
onChildAdded,
query,
limitToLast
} from “https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js”;

import { firebaseConfig } from “./firebase-config.js”;

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const $ = (id) => document.getElementById(id);

const usernameScreen = $(“usernameScreen”);
const appScreen = $(“appScreen”);
const adminScreen = $(“adminScreen”);

const usernameForm = $(“usernameForm”);
const usernameInput = $(“usernameInput”);
const usernameError = $(“usernameError”);

const messageForm = $(“messageForm”);
const messageInput = $(“messageInput”);
const messages = $(“messages”);
const characterCount = $(“characterCount”);
const sendButton = $(“sendButton”);

const changeUsernameButton = $(“changeUsernameButton”);
const openAdminButton = $(“openAdminButton”);
const adminButton = $(“adminButton”);
const backButton = $(“backButton”);

const adminForm = $(“adminForm”);
const adminUsername = $(“adminUsername”);
const adminPassword = $(“adminPassword”);
const adminError = $(“adminError”);

const toast = $(“toast”);

let username = localStorage.getItem(“anonchat_username”) || “”;
let isAdmin = sessionStorage.getItem(“anonchat_admin”) === “true”;
let messageListenerStarted = false;
let toastTimer;

function showToast(message) {
toast.textContent = message;
toast.classList.add(“show”);

clearTimeout(toastTimer);

toastTimer = setTimeout(() => {
toast.classList.remove(“show”);
}, 3000);
}

function showScreen(screen) {
usernameScreen.classList.add(“hidden”);
appScreen.classList.add(“hidden”);
adminScreen.classList.add(“hidden”);

screen.classList.remove(“hidden”);
}

function validUsername(value) {
return /^[a-zA-Z0-9_]{3,24}$/.test(value);
}

function enterChat() {
showScreen(appScreen);
startMessageListener();
}

function requestUsername() {
showScreen(usernameScreen);
usernameInput.value = username;
usernameInput.focus();
}

usernameForm.addEventListener(“submit”, (event) => {
event.preventDefault();

const value = usernameInput.value.trim();

if (!validUsername(value)) {
usernameError.textContent =
“Gunakan 3–24 karakter: huruf, angka, atau underscore.”;
return;
}

username = value;
localStorage.setItem(“anonchat_username”, username);

usernameError.textContent = “”;
enterChat();
});

changeUsernameButton.addEventListener(“click”, () => {
requestUsername();
});

openAdminButton.addEventListener(“click”, () => {
showScreen(adminScreen);
});

adminButton.addEventListener(“click”, () => {
if (isAdmin) {
const shouldLogout = confirm(“Logout dari mode admin?”);

if (shouldLogout) {
  isAdmin = false;
  sessionStorage.removeItem("anonchat_admin");
  showToast("Mode admin dinonaktifkan.");
  enterChat();
}
return;

}

showScreen(adminScreen);
});

backButton.addEventListener(“click”, () => {
if (username) {
enterChat();
} else {
requestUsername();
}
});

// Login demo. admin.json bukan tempat penyimpanan rahasia.
adminForm.addEventListener(“submit”, async (event) => {
event.preventDefault();

adminError.textContent = “”;

try {
const response = await fetch(”./admin.json”, {
cache: “no-store”
});

if (!response.ok) {
  throw new Error("File admin.json tidak ditemukan.");
}
const credentials = await response.json();
const enteredUsername = adminUsername.value.trim();
const enteredPassword = adminPassword.value;
if (
  enteredUsername !== credentials.username ||
  enteredPassword !== credentials.password
) {
  adminError.textContent = "Username atau password admin salah.";
  return;
}
isAdmin = true;
sessionStorage.setItem("anonchat_admin", "true");
adminForm.reset();
showToast("Mode admin aktif.");
enterChat();

} catch (error) {
console.error(“Admin login error:”, error);
adminError.textContent =
“Gagal memuat konfigurasi admin. Periksa admin.json.”;
}
});

// Character counter
messageInput.addEventListener(“input”, () => {
characterCount.textContent = ${messageInput.value.length}/500;
});

// Realtime listener
function startMessageListener() {
if (messageListenerStarted) return;

messageListenerStarted = true;

const recentMessages = query(
ref(db, “messages”),
limitToLast(100)
);

onChildAdded(
recentMessages,
(snapshot) => {
const data = snapshot.val();

  if (!data || typeof data.text !== "string") return;
  const emptyState = $("emptyState");
  if (emptyState) {
    emptyState.remove();
  }
  const message = document.createElement("div");
  message.className = "message-item";
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = (data.username || "?").charAt(0).toUpperCase();
  const content = document.createElement("div");
  content.className = "message-content";
  const meta = document.createElement("div");
  meta.className = "message-meta";
  const name = document.createElement("span");
  name.className = "message-username";
  name.textContent = data.username || "Anonim";
  if (data.isAdmin === true) {
    name.classList.add("admin-rainbow");
    const badge = document.createElement("span");
    badge.className = "admin-badge";
    badge.textContent = "ADMIN";
    name.appendChild(badge);
  }
  const time = document.createElement("span");
  time.className = "message-time";
  if (typeof data.createdAt === "number") {
    time.textContent = new Date(data.createdAt).toLocaleTimeString(
      "id-ID",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );
  }
  const text = document.createElement("p");
  text.className = "message-text";
  text.textContent = data.text;
  meta.append(name, time);
  content.append(meta, text);
  message.append(avatar, content);
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
},
(error) => {
  console.error("Realtime listener error:", error);
  showToast("Gagal membaca pesan. Periksa Firebase Rules.");
}

);
}

// Send message
messageForm.addEventListener(“submit”, async (event) => {
event.preventDefault();

if (!username) {
requestUsername();
return;
}

const text = messageInput.value.trim();

if (!text) return;

if (text.length > 500) {
showToast(“Pesan maksimal 500 karakter.”);
return;
}

sendButton.disabled = true;

try {
await push(ref(db, “messages”), {
username,
text,
isAdmin,
createdAt: Date.now()
});

messageInput.value = "";
characterCount.textContent = "0/500";

} catch (error) {
console.error(“Send message error:”, error);
showToast(“Pesan gagal dikirim. Periksa Firebase Rules.”);
} finally {
sendButton.disabled = false;
}
});

// Initial state
if (username && validUsername(username)) {
enterChat();
} else {
requestUsername();
}
