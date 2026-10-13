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

// ================================
// INITIALIZATION
// ================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = (id) => document.getElementById(id);

// Authentication elements
const authScreen = $(“authScreen”);
const authForm = $(“authForm”);
const authTitle = $(“authTitle”);
const authDescription = $(“authDescription”);
const authMessage = $(“authMessage”);
const authSubmit = $(“authSubmit”);

const loginTab = $(“loginTab”);
const registerTab = $(“registerTab”);

const usernameGroup = $(“usernameGroup”);
const usernameInput = $(“username”);
const emailInput = $(“email”);
const passwordInput = $(“password”);

const mathQuestion = $(“mathQuestion”);
const mathAnswer = $(“mathAnswer”);

// Chat elements
const appScreen = $(“appScreen”);
const messageForm = $(“messageForm”);
const messageInput = $(“messageInput”);
const messagesContainer = $(“messages”);
const logoutButton = $(“logoutButton”);
const characterCount = $(“characterCount”);
const sendButton = $(“sendButton”);
const toast = $(“toast”);

// Application state
let authMode = “login”;
let currentUser = null;
let currentProfile = null;
let messagesStarted = false;
let expectedMathAnswer = 0;
let toastTimer = null;

console.log(“AnonChat JavaScript berhasil dimuat.”);

// ================================
// MESSAGES & NOTIFICATIONS
// ================================

function showError(message) {
if (authMessage) {
authMessage.textContent = message;
authMessage.className = “form-message error”;
} else {
alert(message);
}
}

function clearError() {
if (!authMessage) return;

authMessage.textContent = “”;
authMessage.className = “form-message”;
}

function showToast(message) {
if (!toast) {
alert(message);
return;
}

toast.textContent = message;
toast.classList.add(“show”);

clearTimeout(toastTimer);

toastTimer = setTimeout(() => {
toast.classList.remove(“show”);
}, 3000);
}

// ================================
// MATH VERIFICATION
// ================================

function createMathQuestion() {
const firstNumber = Math.floor(Math.random() * 8) + 2;
const secondNumber = Math.floor(Math.random() * 8) + 1;

expectedMathAnswer = firstNumber + secondNumber;

if (mathQuestion) {
mathQuestion.textContent =
${firstNumber} + ${secondNumber};
}

if (mathAnswer) {
mathAnswer.value = “”;
}

console.log(“Soal matematika baru dibuat.”);
}

// ================================
// LOGIN & REGISTER TABS
// ================================

function setAuthMode(mode) {
authMode = mode;
clearError();

if (usernameGroup) {
usernameGroup.classList.toggle(
“hidden”,
mode !== “register”
);
}

if (usernameInput) {
usernameInput.required = mode === “register”;
}

if (authTitle) {
authTitle.textContent =
mode === “register”
? “Buat akun”
: “Welcome back”;
}

if (authDescription) {
authDescription.textContent =
mode === “register”
? “Buat akun dan bergabung dengan komunitas.”
: “Masuk dan lanjutkan percakapanmu.”;
}

if (authSubmit) {
authSubmit.textContent =
mode === “register”
? “Daftar ke AnonChat”
: “Masuk ke AnonChat”;
}

if (passwordInput) {
passwordInput.autocomplete =
mode === “register”
? “new-password”
: “current-password”;
}

loginTab?.classList.toggle(
“active”,
mode === “login”
);

registerTab?.classList.toggle(
“active”,
mode === “register”
);

createMathQuestion();

console.log(“Mode autentikasi:”, mode);
}

loginTab?.addEventListener(“click”, (event) => {
event.preventDefault();
setAuthMode(“login”);
});

registerTab?.addEventListener(“click”, (event) => {
event.preventDefault();
setAuthMode(“register”);
});

// ================================
// PROFILE
// ================================

async function loadProfile(user) {
const profileRef = ref(db, users/${user.uid});
const snapshot = await get(profileRef);

if (snapshot.exists()) {
const profile = snapshot.val();

if (
  !profile ||
  typeof profile.username !== "string" ||
  !profile.username.trim()
) {
  throw new Error("Profil tidak memiliki username yang valid.");
}
return profile;

}

// Pulihkan profil dasar jika belum ada.
const fallbackProfile = {
username: user.email?.split(”@”)[0] || “Anonim”,
email: user.email || “”,
createdAt: Date.now()
};

await set(profileRef, fallbackProfile);

return fallbackProfile;
}

// ================================
// SCREEN MANAGEMENT
// ================================

function showChat(user, profile) {
currentUser = user;
currentProfile = profile;

if (authScreen) {
authScreen.hidden = true;
}

if (appScreen) {
appScreen.hidden = false;
}

startMessagesListener();
}

function showAuth() {
currentUser = null;
currentProfile = null;

if (authScreen) {
authScreen.hidden = false;
}

if (appScreen) {
appScreen.hidden = true;
}
}

// ================================
// AUTH FORM
// ================================

authForm?.addEventListener(“submit”, async (event) => {
event.preventDefault();
clearError();

const email = emailInput?.value.trim() || “”;
const password = passwordInput?.value || “”;
const username = usernameInput?.value.trim() || “”;
const answerText = mathAnswer?.value.trim() || “”;

if (!email || !password) {
showError(“Email dan password wajib diisi.”);
return;
}

if (password.length < 6) {
showError(“Password minimal 6 karakter.”);
return;
}

if (authMode === “register”) {
if (username.length < 3 || username.length > 24) {
showError(“Username harus terdiri dari 3–24 karakter.”);
return;
}
}

if (!answerText || Number(answerText) !== expectedMathAnswer) {
showError(“Jawaban matematika salah. Silakan coba lagi.”);
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
  // Buat akun baru.
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  // Simpan profil pengguna.
  await set(
    ref(db, `users/${credential.user.uid}`),
    {
      username: username,
      email: credential.user.email || email,
      createdAt: Date.now()
    }
  );
  showToast("Registrasi berhasil!");
} else {
  // Login dengan akun yang sudah ada.
  await signInWithEmailAndPassword(
    auth,
    email,
    password
  );
}

} catch (error) {
console.error(“Authentication error:”, error);

const errorMessages = {
  "auth/email-already-in-use":
    "Email sudah terdaftar. Silakan login.",
  "auth/invalid-email":
    "Format email tidak valid.",
  "auth/weak-password":
    "Password terlalu lemah. Gunakan minimal 6 karakter.",
  "auth/invalid-credential":
    "Email atau password salah.",
  "auth/user-not-found":
    "Akun tidak ditemukan. Silakan daftar dahulu.",
  "auth/wrong-password":
    "Password salah.",
  "auth/operation-not-allowed":
    "Aktifkan Email/Password di Firebase Authentication.",
  "auth/network-request-failed":
    "Koneksi internet bermasalah.",
  "PERMISSION_DENIED":
    "Firebase Rules menolak akses. Periksa Rules database."
};
showError(
  errorMessages[error.code] ||
  `Terjadi kesalahan: ${error.message || error.code}`
);
createMathQuestion();

} finally {
if (authSubmit) {
authSubmit.disabled = false;
authSubmit.textContent =
authMode === “register”
? “Daftar ke AnonChat”
: “Masuk ke AnonChat”;
}
}
});

// ================================
// AUTH SESSION
// ================================

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
showError(
  `Gagal memuat profil: ${
    error.code || error.message || "Periksa Firebase Rules."
  }`
);

}
});

// ================================
// REALTIME MESSAGES
// ================================

function startMessagesListener() {
if (messagesStarted || !messagesContainer) {
return;
}

messagesStarted = true;

onChildAdded(
ref(db, “messages”),
(snapshot) => {
const message = snapshot.val();

  if (!message) return;
  const emptyState = $("emptyState");
  if (emptyState?.isConnected) {
    emptyState.remove();
  }
  const item = document.createElement("div");
  item.className = "message-item";
  if (currentUser && message.uid === currentUser.uid) {
    item.classList.add("own-message");
  }
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = (
    message.username || "A"
  ).charAt(0).toUpperCase();
  const content = document.createElement("div");
  content.className = "message-content";
  const meta = document.createElement("div");
  meta.className = "message-meta";
  const username = document.createElement("span");
  username.className = "message-username";
  username.textContent = message.username || "Anonim";
  const time = document.createElement("span");
  time.className = "message-time";
  if (typeof message.createdAt === "number") {
    time.textContent = new Date(
      message.createdAt
    ).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  const text = document.createElement("p");
  text.className = "message-text";
  text.textContent = message.text || "";
  meta.append(username, time);
  content.append(meta, text);
  item.append(avatar, content);
  messagesContainer.appendChild(item);
  messagesContainer.scrollTop =
    messagesContainer.scrollHeight;
},
(error) => {
  console.error("Messages listener error:", error);
  showToast(
    "Gagal memuat pesan. Periksa Firebase Rules."
  );
}

);
}

// ================================
// SEND MESSAGE
// ================================

messageForm?.addEventListener(“submit”, async (event) => {
event.preventDefault();

if (!currentUser || !currentProfile) {
showToast(“Silakan login terlebih dahulu.”);
return;
}

const text = messageInput?.value.trim() || “”;

if (!text) return;

if (text.length > 500) {
showToast(“Pesan maksimal 500 karakter.”);
return;
}

try {
if (sendButton) {
sendButton.disabled = true;
}

await push(ref(db, "messages"), {
  uid: currentUser.uid,
  username: currentProfile.username || "Anonim",
  text: text,
  createdAt: Date.now(),
  serverCreatedAt: Date.now()
});
messageInput.value = "";
if (characterCount) {
  characterCount.textContent = "0/500";
}

} catch (error) {
console.error(“Send message error:”, error);

showToast(
  "Pesan gagal dikirim. Periksa Firebase Rules."
);

} finally {
if (sendButton) {
sendButton.disabled = false;
}
}
});

// ================================
// CHARACTER COUNTER
// ================================

messageInput?.addEventListener(“input”, () => {
if (characterCount) {
characterCount.textContent =
${messageInput.value.length}/500;
}
});

// ================================
// LOGOUT
// ================================

logoutButton?.addEventListener(“click”, async () => {
try {
await signOut(auth);
showToast(“Kamu berhasil logout.”);
} catch (error) {
console.error(“Logout error:”, error);
showToast(“Gagal logout. Coba lagi.”);
}
});

// ================================
// INITIAL SETUP
// ================================

setAuthMode(“login”);
