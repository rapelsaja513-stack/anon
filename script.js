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
onChildAdded
} from “https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js”;

import { firebaseConfig } from “./firebase-config.js”;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = (id) => document.getElementById(id);

const authScreen = $(“authScreen”);
const appScreen = $(“appScreen”);
const authForm = $(“authForm”);

const emailInput = $(“email”);
const passwordInput = $(“password”);
const usernameInput = $(“username”);
const usernameGroup = $(“usernameGroup”);

const loginTab = $(“loginTab”);
const registerTab = $(“registerTab”);
const authTitle = $(“authTitle”);
const authDescription = $(“authDescription”);
const authSubmit = $(“authSubmit”);
const authMessage = $(“authMessage”);

const mathQuestion = $(“mathQuestion”);
const mathAnswer = $(“mathAnswer”);

const messageForm = $(“messageForm”);
const messageInput = $(“messageInput”);
const messagesContainer = $(“messages”);
const logoutButton = $(“logoutButton”);
const characterCount = $(“characterCount”);
const sendButton = $(“sendButton”);
const emptyState = $(“emptyState”);
const toast = $(“toast”);

let authMode = “login”;
let currentUser = null;
let currentProfile = null;
let messagesStarted = false;
let expectedMathAnswer = 0;
let toastTimer;

function showMessage(message, type = “error”) {
if (!authMessage) return;

authMessage.textContent = message;
authMessage.className = form-message ${type};
}

function clearMessage() {
if (!authMessage) return;

authMessage.textContent = “”;
authMessage.className = “form-message”;
}

function showToast(message) {
if (!toast) {
console.log(message);
return;
}

toast.textContent = message;
toast.classList.add(“show”);

clearTimeout(toastTimer);
toastTimer = setTimeout(() => {
toast.classList.remove(“show”);
}, 3000);
}

function createMathQuestion() {
const a = Math.floor(Math.random() * 8) + 2;
const b = Math.floor(Math.random() * 8) + 1;

expectedMathAnswer = a + b;

if (mathQuestion) {
mathQuestion.textContent = ${a} + ${b};
}

if (mathAnswer) {
mathAnswer.value = “”;
}
}

function setAuthMode(mode) {
authMode = mode;
clearMessage();

if (usernameGroup) {
usernameGroup.classList.toggle(“hidden”, mode !== “register”);
}

if (usernameInput) {
usernameInput.required = mode === “register”;
}

if (authTitle) {
authTitle.textContent =
mode === “register” ? “Create your account” : “Welcome back”;
}

if (authDescription) {
authDescription.textContent =
mode === “register”
? “Buat akun dan bergabung dengan komunitas.”
: “Masuk dan lanjutkan percakapanmu.”;
}

if (authSubmit) {
authSubmit.textContent =
mode === “register” ? “Daftar ke AnonChat” : “Masuk ke AnonChat”;
}

if (passwordInput) {
passwordInput.autocomplete =
mode === “register” ? “new-password” : “current-password”;
}

loginTab?.classList.toggle(“active”, mode === “login”);
registerTab?.classList.toggle(“active”, mode === “register”);

createMathQuestion();
}

loginTab?.addEventListener(“click”, () => {
setAuthMode(“login”);
});

registerTab?.addEventListener(“click”, () => {
setAuthMode(“register”);
});

createMathQuestion();
setAuthMode(“login”);

async function loadProfile(user) {
const profileRef = ref(db, users/${user.uid});
const snapshot = await get(profileRef);

if (snapshot.exists()) {
return snapshot.val();
}

// Jangan membuat profil otomatis dengan username palsu.
// Jika profil belum ada, buat profil dasar yang bisa dipulihkan.
const profile = {
username: user.email?.split(”@”)[0] || “Anonim”,
email: user.email || “”,
createdAt: Date.now()
};

await set(profileRef, profile);

return profile;
}

function showChat(user, profile) {
currentUser = user;
currentProfile = profile;

if (authScreen) authScreen.hidden = true;
if (appScreen) appScreen.hidden = false;

startMessagesListener();
}

function showAuth() {
currentUser = null;
currentProfile = null;

if (authScreen) authScreen.hidden = false;
if (appScreen) appScreen.hidden = true;
}

authForm?.addEventListener(“submit”, async (event) => {
event.preventDefault();
clearMessage();

const email = emailInput?.value.trim();
const password = passwordInput?.value;
const username = usernameInput?.value.trim();
const answer = Number(mathAnswer?.value);

if (!email || !password) {
showMessage(“Email dan password wajib diisi.”);
return;
}

if (password.length < 6) {
showMessage(“Password minimal 6 karakter.”);
return;
}

if (authMode === “register”) {
if (!username || username.length < 3 || username.length > 24) {
showMessage(“Username harus terdiri dari 3–24 karakter.”);
return;
}
}

if (!mathAnswer?.value.trim() || answer !== expectedMathAnswer) {
showMessage(“Jawaban matematika salah. Coba lagi.”);
createMathQuestion();
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
  showMessage("Registrasi berhasil!", "success");
} else {
  await signInWithEmailAndPassword(auth, email, password);
}

} catch (error) {
console.error(“Authentication error:”, error);

const errorMessages = {
  "auth/email-already-in-use": "Email sudah terdaftar. Silakan login.",
  "auth/invalid-email": "Format email tidak valid.",
  "auth/weak-password": "Password terlalu lemah. Gunakan minimal 6 karakter.",
  "auth/invalid-credential": "Email atau password salah.",
  "auth/user-not-found": "Akun tidak ditemukan. Silakan daftar dahulu.",
  "auth/wrong-password": "Password salah.",
  "auth/operation-not-allowed": "Aktifkan Email/Password di Firebase Authentication.",
  "auth/network-request-failed": "Koneksi internet bermasalah."
};
showMessage(
  errorMessages[error.code] ||
    `Gagal: ${error.message || "Terjadi kesalahan."}`
);
createMathQuestion();

} finally {
if (authSubmit) {
authSubmit.disabled = false;
authSubmit.textContent =
authMode === “register” ? “Daftar ke AnonChat” : “Masuk ke AnonChat”;
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

showAuth();
showMessage(
  `Profil gagal dimuat: ${error.code || error.message || "Periksa Firebase Rules."}`
);

}
});

function startMessagesListener() {
if (messagesStarted || !messagesContainer) return;

messagesStarted = true;

onChildAdded(
ref(db, “messages”),
(snapshot) => {
const message = snapshot.val();

  if (!message) return;
  if (emptyState?.isConnected) {
    emptyState.remove();
  }
  const messageElement = document.createElement("article");
  messageElement.className = "message";
  const usernameElement = document.createElement("strong");
  usernameElement.textContent = message.username || "Anonim";
  const textElement = document.createElement("p");
  textElement.textContent = message.text || "";
  messageElement.append(usernameElement, textElement);
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
},
(error) => {
  console.error("Message listener error:", error);
  showToast("Gagal memuat pesan. Periksa Firebase Rules.");
}

);
}

messageForm?.addEventListener(“submit”, async (event) => {
event.preventDefault();

if (!currentUser || !currentProfile) {
showToast(“Silakan login terlebih dahulu.”);
return;
}

const text = messageInput?.value.trim();

if (!text) return;

if (text.length > 500) {
showToast(“Pesan maksimal 500 karakter.”);
return;
}

try {
if (sendButton) sendButton.disabled = true;

await push(ref(db, "messages"), {
  username: currentProfile.username || "Anonim",
  text,
  createdAt: Date.now(),
  serverCreatedAt: Date.now()
});
messageInput.value = "";
if (characterCount) {
  characterCount.textContent = "0/500";
}

} catch (error) {
console.error(“Send message error:”, error);
showToast(“Pesan gagal dikirim. Periksa Firebase Rules.”);
} finally {
if (sendButton) sendButton.disabled = false;
}
});

messageInput?.addEventListener(“input”, () => {
if (characterCount) {
characterCount.textContent = ${messageInput.value.length}/500;
}
});

logoutButton?.addEventListener(“click”, async () => {
try {
await signOut(auth);
showToast(“Kamu berhasil logout.”);
} catch (error) {
console.error(“Logout error:”, error);
showToast(“Gagal logout. Coba lagi.”);
}
});
