44”}
import { initializeApp } from “https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js”;

import {
getAuth,
onAuthStateChanged,
signInAnonymously,
signInWithEmailAndPassword,
signOut
} from “https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js”;

import {
getDatabase,
ref,
push,
set,
remove,
onChildAdded,
onChildChanged,
onChildRemoved,
query,
limitToLast,
serverTimestamp,
get
} from “https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js”;

/*
PENTING:
Ganti nilai di bawah dengan konfigurasi Firebase project lu.
Ambil di Firebase Console > Project settings > Your apps.
*/
const firebaseConfig = {
apiKey: “GANTI_DENGAN_API_KEY_FIREBASE_LU”,
authDomain: “GANTI_DENGAN_PROJECT_ID.firebaseapp.com”,
databaseURL: “https://GANTI_DENGAN_PROJECT_ID-default-rtdb.firebaseio.com”,
projectId: “GANTI_DENGAN_PROJECT_ID”,
storageBucket: “GANTI_DENGAN_PROJECT_ID.firebasestorage.app”,
messagingSenderId: “GANTI_DENGAN_SENDER_ID”,
appId: “GANTI_DENGAN_APP_ID”
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = (id) => document.getElementById(id);

const usernameScreen = $(“usernameScreen”);
const chatScreen = $(“chatScreen”);
const adminScreen = $(“adminScreen”);
const rulesScreen = $(“rulesScreen”);

const usernameForm = $(“usernameForm”);
const usernameInput = $(“usernameInput”);
const messageForm = $(“messageForm”);
const messageInput = $(“messageInput”);
const messagesContainer = $(“messages”);
const loadingMessages = $(“loadingMessages”);
const characterCount = $(“characterCount”);
const connectionLabel = $(“connectionLabel”);

const adminLoginForm = $(“adminLoginForm”);
const adminEmail = $(“adminEmail”);
const adminPassword = $(“adminPassword”);
const adminError = $(“adminError”);
const adminLoginCard = $(“adminLoginCard”);
const adminDashboard = $(“adminDashboard”);

const adminProfileForm = $(“adminProfileForm”);
const adminDisplayName = $(“adminDisplayName”);
const adminTitle = $(“adminTitle”);
const adminBadgeIcon = $(“adminBadgeIcon”);
const adminColor = $(“adminColor”);
const adminNamePreview = $(“adminNamePreview”);
const profileStatus = $(“profileStatus”);

const toastContainer = $(“toastContainer”);

const DEFAULT_ADMIN_PROFILE = {
displayName: “Kagi”,
title: “FOUNDER”,
badgeIcon: “👑”,
color: “rainbow”
};

let currentUser = null;
let isAdmin = false;
let activeScreen = “username”;
let currentUsername = “”;
let adminProfile = { …DEFAULT_ADMIN_PROFILE };
let messagesStarted = false;
let messageListeners = [];
let connectionListener = null;
let profileListener = null;
let authTransition = false;
let currentMessageIds = new Set();

function showToast(message, type = “success”) {
const toast = document.createElement(“div”);
toast.className = toast ${type};
toast.textContent = message;
toastContainer.appendChild(toast);

setTimeout(() => toast.remove(), 3500);
}

function showScreen(screenName) {
activeScreen = screenName;

usernameScreen.classList.toggle(“hidden”, screenName !== “username”);
chatScreen.classList.toggle(“hidden”, screenName !== “chat”);
adminScreen.classList.toggle(“hidden”, screenName !== “admin”);
rulesScreen.classList.toggle(“hidden”, screenName !== “rules”);

$(“adminNav”).textContent = isAdmin ? “👑 Admin Panel” : “👑 Admin”;

if (screenName === “chat” && currentUser) {
updateMyProfile();
startMessageListeners();
}
}

function normalizeUsername(value) {
return value.trim().replace(/\s+/g, “ “);
}

function validUsername(value) {
return value.length > 0 && value.length <= 24;
}

function updateMyProfile() {
const shownName = isAdmin
? adminProfile.displayName
: currentUsername;

$(“myUsername”).textContent = shownName || “Pengguna”;
$(“myAvatar”).textContent = (shownName || “U”).charAt(0).toUpperCase();
$(“myRole”).textContent = isAdmin
? ${adminProfile.badgeIcon || "👑"} ${adminProfile.title || "ADMIN"}
: “Member”;
}

function colorClass(color) {
const allowed = [“rainbow”, “purple”, “blue”, “gold”, “pink”];
return allowed.includes(color) ? admin-${color} : “admin-rainbow”;
}

function makeAdminNameElement(profile) {
const wrapper = document.createElement(“span”);
wrapper.className = message-username ${colorClass(profile.color)};
wrapper.textContent = profile.displayName || “Admin”;
return wrapper;
}

function makeAdminTitleElement(profile) {
const badge = document.createElement(“span”);
badge.className = “admin-title-badge”;
badge.textContent =
${profile.badgeIcon || "👑"} ${profile.title || "ADMIN"};
return badge;
}

function updatePreview() {
const displayName = normalizeUsername(adminDisplayName.value) || “Kagi”;
const title = normalizeUsername(adminTitle.value) || “FOUNDER”;
const icon = adminBadgeIcon.value.trim() || “👑”;
const color = adminColor.value;

adminNamePreview.replaceChildren();

const name = document.createElement(“span”);
name.className = colorClass(color);
name.textContent = displayName;

const badge = document.createElement(“span”);
badge.className = “admin-title-badge”;
badge.textContent = ${icon} ${title};

adminNamePreview.append(name, document.createTextNode(” “), badge);
}

function setProfileForm(profile) {
adminDisplayName.value = profile.displayName || “Kagi”;
adminTitle.value = profile.title || “FOUNDER”;
adminBadgeIcon.value = profile.badgeIcon || “👑”;
adminColor.value = profile.color || “rainbow”;
updatePreview();
}

function updateMessageIdentity(messageElement, data) {
const meta = messageElement.querySelector(”.message-meta”);
const existingName = meta.querySelector(”.message-username”);
const existingBadge = meta.querySelector(”.admin-title-badge”);

if (existingName) existingName.remove();
if (existingBadge) existingBadge.remove();

if (data.isAdmin === true) {
const profile = {
displayName: data.adminDisplayName || “Admin”,
title: data.adminTitle || “ADMIN”,
badgeIcon: data.adminBadgeIcon || “👑”,
color: data.adminColor || “rainbow”
};

const name = makeAdminNameElement(profile);
const badge = makeAdminTitleElement(profile);
const time = meta.querySelector(".message-time");
meta.insertBefore(name, time || null);
meta.insertBefore(badge, time || null);

} else {
const name = document.createElement(“span”);
name.className = “message-username”;
name.textContent = data.username || “Pengguna”;

const time = meta.querySelector(".message-time");
meta.insertBefore(name, time || null);

}
}

function createMessageElement(messageId, data) {
const article = document.createElement(“article”);
article.className = “message”;
article.dataset.messageId = messageId;

const avatar = document.createElement(“div”);
avatar.className = “message-avatar”;

const content = document.createElement(“div”);
content.className = “message-content”;

const meta = document.createElement(“div”);
meta.className = “message-meta”;

const time = document.createElement(“span”);
time.className = “message-time”;

const timestamp = Number(data.createdAt || 0);
time.textContent = timestamp
? new Date(timestamp).toLocaleTimeString(“id-ID”, {
hour: “2-digit”,
minute: “2-digit”
})
: “baru saja”;

meta.appendChild(time);

const text = document.createElement(“p”);
text.className = “message-text”;
text.textContent = data.text || “”;

content.append(meta, text);
article.append(avatar, content);

if (data.isAdmin === true) {
avatar.textContent = (data.adminDisplayName || “A”)[0].toUpperCase();
avatar.style.background = “linear-gradient(135deg, #9333ea, #2563eb)”;
avatar.style.color = “#fff”;
} else {
avatar.textContent = (data.username || “U”)[0].toUpperCase();
}

updateMessageIdentity(article, data);

if (isAdmin) {
const deleteButton = document.createElement(“button”);
deleteButton.className = “delete-message-button”;
deleteButton.type = “button”;
deleteButton.textContent = “🗑 Hapus”;
deleteButton.title = “Hapus pesan ini”;

deleteButton.addEventListener("click", async () => {
  const confirmed = confirm(
    "Yakin ingin menghapus pesan ini? Tindakan ini tidak bisa dibatalkan."
  );
  if (!confirmed) return;
  deleteButton.disabled = true;
  try {
    await remove(ref(db, `messages/${messageId}`));
    showToast("Pesan berhasil dihapus.");
  } catch (error) {
    console.error(error);
    showToast("Gagal menghapus pesan. Periksa Firebase Rules.", "error");
    deleteButton.disabled = false;
  }
});
meta.appendChild(deleteButton);

}

return article;
}

function renderExistingMessage(messageId, data) {
if (!data || !data.text) return;

const existing = messagesContainer.querySelector(
[data-message-id="${CSS.escape(messageId)}"]
);

if (existing) {
const replacement = createMessageElement(messageId, data);
existing.replaceWith(replacement);
return;
}

const empty = messagesContainer.querySelector(”.empty-state”);
if (empty) empty.remove();

const element = createMessageElement(messageId, data);
messagesContainer.appendChild(element);
currentMessageIds.add(messageId);

while (messagesContainer.querySelectorAll(”.message”).length > 100) {
const first = messagesContainer.querySelector(”.message”);
if (!first) break;
first.remove();
}

messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function startMessageListeners() {
if (!currentUser || messagesStarted) return;
messagesStarted = true;

messagesContainer.replaceChildren();
loadingMessages.classList.remove(“hidden”);
messagesContainer.appendChild(loadingMessages);
currentMessageIds.clear();

const messagesQuery = query(ref(db, “messages”), limitToLast(100));

const added = onChildAdded(
messagesQuery,
(snapshot) => {
loadingMessages.classList.add(“hidden”);
renderExistingMessage(snapshot.key, snapshot.val());
},
(error) => {
loadingMessages.classList.add(“hidden”);
console.error(error);
showToast(“Tidak bisa membaca pesan. Periksa Firebase Rules.”, “error”);
}
);

const changed = onChildChanged(messagesQuery, (snapshot) => {
renderExistingMessage(snapshot.key, snapshot.val());
});

const removed = onChildRemoved(messagesQuery, (snapshot) => {
const element = messagesContainer.querySelector(
[data-message-id="${CSS.escape(snapshot.key)}"]
);
if (element) element.remove();
currentMessageIds.delete(snapshot.key);

if (!messagesContainer.querySelector(".message")) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = "Belum ada pesan. Jadilah yang pertama ngobrol! ✨";
  messagesContainer.appendChild(empty);
}

});

messageListeners.push(added, changed, removed);
}

function stopMessageListeners() {
for (const unsubscribe of messageListeners) unsubscribe();
messageListeners = [];
messagesStarted = false;
}

function startConnectionListener() {
if (connectionListener) connectionListener();

const connectedRef = ref(db, “.info/connected”);
connectionListener = onValueCompat(connectedRef, (snapshot) => {
const connected = snapshot.val() === true;
connectionLabel.textContent = connected ? “Terhubung” : “Menyambungkan…”;
connectionLabel.style.color = connected ? “#49e0ae” : “#fcd34d”;
});
}

/*
Helper agar status koneksi tetap bisa dipantau.
*/
import {
onValue as onValueCompat
} from “https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js”;

async function saveAdminMessage(text) {
const profile = { …adminProfile };

await push(ref(db, “messages”), {
username: profile.displayName,
text,
createdAt: Date.now(),
serverCreatedAt: serverTimestamp(),
isAdmin: true,
adminDisplayName: profile.displayName,
adminTitle: profile.title,
adminBadgeIcon: profile.badgeIcon,
adminColor: profile.color
});
}

async function saveMemberMessage(text) {
await push(ref(db, “messages”), {
username: currentUsername,
text,
createdAt: Date.now(),
serverCreatedAt: serverTimestamp()
});
}

usernameForm.addEventListener(“submit”, async (event) => {
event.preventDefault();

const name = normalizeUsername(usernameInput.value);
if (!validUsername(name)) {
showToast(“Nama harus berisi 1–24 karakter.”, “error”);
return;
}

if (!currentUser) {
showToast(“Sedang menghubungkan akun. Coba lagi sebentar.”, “error”);
return;
}

currentUsername = name;
localStorage.setItem(“anonchat_username”, name);
updateMyProfile();
showScreen(“chat”);
showToast(Selamat datang, ${name}!);
});

messageInput.addEventListener(“input”, () => {
characterCount.textContent = ${messageInput.value.length} / 500;
});

messageForm.addEventListener(“submit”, async (event) => {
event.preventDefault();

const text = messageInput.value.trim();
if (!text || text.length > 500) return;

if (!currentUser) {
showToast(“Kamu belum terhubung ke chat.”, “error”);
return;
}

const sendButton = messageForm.querySelector(“button”);
sendButton.disabled = true;

try {
if (isAdmin) {
await saveAdminMessage(text);
} else {
if (!currentUsername) {
showToast(“Pilih nama pengguna terlebih dahulu.”, “error”);
showScreen(“username”);
return;
}

  await saveMemberMessage(text);
}
messageInput.value = "";
characterCount.textContent = "0 / 500";

} catch (error) {
console.error(error);
showToast(
“Pesan gagal dikirim. Periksa koneksi, login, dan Firebase Rules.”,
“error”
);
} finally {
sendButton.disabled = false;
}
});

$(“adminNav”).addEventListener(“click”, () => {
showScreen(“admin”);

if (isAdmin) {
adminLoginCard.classList.add(“hidden”);
adminDashboard.classList.remove(“hidden”);
} else {
adminLoginCard.classList.remove(“hidden”);
adminDashboard.classList.add(“hidden”);
}
});

$(“backToChatButton”).addEventListener(“click”, () => {
if (currentUser) showScreen(“chat”);
else showScreen(“username”);
});

$(“rulesNav”).addEventListener(“click”, () => showScreen(“rules”));
$(“rulesBackButton”).addEventListener(“click”, () => {
if (currentUser) showScreen(“chat”);
else showScreen(“username”);
});

$(“moderateChatButton”).addEventListener(“click”, () => showScreen(“chat”));

$(“changeNameButton”).addEventListener(“click”, () => {
if (isAdmin) {
showScreen(“admin”);
adminLoginCard.classList.add(“hidden”);
adminDashboard.classList.remove(“hidden”);
return;
}

const newName = prompt(“Masukkan nama baru:”, currentUsername);
if (newName === null) return;

const normalized = normalizeUsername(newName);

if (!validUsername(normalized)) {
showToast(“Nama harus berisi 1–24 karakter.”, “error”);
return;
}

currentUsername = normalized;
localStorage.setItem(“anonchat_username”, normalized);
updateMyProfile();
showToast(“Nama pengguna diperbarui.”);
});

$(“leaveChatButton”).addEventListener(“click”, async () => {
const confirmed = confirm(“Keluar dari chat?”);
if (!confirmed) return;

stopMessageListeners();

if (isAdmin) {
showScreen(“admin”);
return;
}

currentUsername = “”;
showScreen(“username”);
});

adminLoginForm.addEventListener(“submit”, async (event) => {
event.preventDefault();
adminError.textContent = “”;

const email = adminEmail.value.trim();
const password = adminPassword.value;

try {
const result = await signInWithEmailAndPassword(auth, email, password);
const tokenResult = await result.user.getIdTokenResult(true);

if (tokenResult.claims.admin !== true) {
  adminError.textContent =
    "Login berhasil, tetapi akun ini belum mempunyai hak admin. Pastikan custom claim admin: true sudah diberikan, lalu login ulang.";
  showToast("Akun belum memiliki hak admin.", "error");
  return;
}
currentUser = result.user;
isAdmin = true;
currentUsername = "";
localStorage.removeItem("anonchat_username");
await loadAdminProfile();
adminLoginCard.classList.add("hidden");
adminDashboard.classList.remove("hidden");
$("dashboardAdminName").textContent = adminProfile.displayName;
updateMyProfile();
showScreen("admin");
showToast("Login admin berhasil! 👑");

} catch (error) {
console.error(error);

const messages = {
  "auth/invalid-credential": "Email atau password salah.",
  "auth/invalid-email": "Format email tidak valid.",
  "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti."
};
adminError.textContent =
  messages[error.code] || `Login gagal: ${error.message}`;
showToast("Login admin gagal.", "error");

}
});

async function loadAdminProfile() {
const profileRef = ref(db, “settings/adminProfile”);

try {
const snapshot = await get(profileRef);
adminProfile = snapshot.exists()
? { …DEFAULT_ADMIN_PROFILE, …snapshot.val() }
: { …DEFAULT_ADMIN_PROFILE };

setProfileForm(adminProfile);
updateMyProfile();
$("dashboardAdminName").textContent = adminProfile.displayName;

} catch (error) {
console.error(error);
adminProfile = { …DEFAULT_ADMIN_PROFILE };
setProfileForm(adminProfile);
showToast(
“Profil default digunakan. Periksa izin membaca profil admin.”,
“error”
);
}
}

adminProfileForm.addEventListener(“input”, updatePreview);

adminProfileForm.addEventListener(“submit”, async (event) => {
event.preventDefault();
profileStatus.textContent = “”;

if (!isAdmin || !currentUser) {
showToast(“Kamu harus login sebagai admin.”, “error”);
return;
}

const displayName = normalizeUsername(adminDisplayName.value);
const title = normalizeUsername(adminTitle.value);
const badgeIcon = adminBadgeIcon.value.trim() || “👑”;
const color = adminColor.value;

if (!validUsername(displayName)) {
profileStatus.textContent = “Nama admin harus berisi 1–24 karakter.”;
return;
}

if (!title || title.length > 24) {
profileStatus.textContent = “Title harus berisi 1–24 karakter.”;
return;
}

const allowedColors = [“rainbow”, “purple”, “blue”, “gold”, “pink”];
if (!allowedColors.includes(color)) {
profileStatus.textContent = “Pilihan warna tidak valid.”;
return;
}

const newProfile = {
displayName,
title,
badgeIcon: badgeIcon.slice(0, 8),
color
};

try {
await set(ref(db, “settings/adminProfile”), newProfile);

adminProfile = newProfile;
setProfileForm(adminProfile);
$("dashboardAdminName").textContent = adminProfile.displayName;
updateMyProfile();
profileStatus.textContent =
  "Identitas admin berhasil disimpan dan akan digunakan untuk pesan berikutnya.";
showToast("Identitas admin berhasil disimpan!");

} catch (error) {
console.error(error);
profileStatus.textContent =
“Gagal menyimpan profil. Periksa Firebase Rules dan hak admin.”;
showToast(“Profil admin gagal disimpan.”, “error”);
}
});

$(“adminLogoutButton”).addEventListener(“click”, async () => {
try {
stopMessageListeners();
await signOut(auth);

currentUser = null;
isAdmin = false;
currentUsername = "";
localStorage.removeItem("anonchat_username");
adminLoginForm.reset();
adminError.textContent = "";
adminLoginCard.classList.remove("hidden");
adminDashboard.classList.add("hidden");
showScreen("username");
showToast("Kamu berhasil logout.");

} catch (error) {
console.error(error);
showToast(“Logout gagal.”, “error”);
}
});

onAuthStateChanged(auth, async (user) => {
if (authTransition) return;

currentUser = user;
isAdmin = false;

if (!user) {
try {
await signInAnonymously(auth);
} catch (error) {
console.error(error);
connectionLabel.textContent = “Belum terhubung”;
showToast(
“Gagal masuk sebagai pengguna. Aktifkan Anonymous Authentication di Firebase.”,
“error”
);
}
return;
}

if (!user.isAnonymous) {
try {
const tokenResult = await user.getIdTokenResult(true);

  if (tokenResult.claims.admin === true) {
    isAdmin = true;
    await loadAdminProfile();
    adminLoginCard.classList.add("hidden");
    adminDashboard.classList.remove("hidden");
    showScreen("admin");
  } else {
    /*
      Akun email/password tanpa claim admin tidak boleh memakai panel admin.
      Jangan langsung menghapus sesi secara otomatis agar pengguna bisa
      membaca pesan error pada formulir login.
    */
    adminLoginCard.classList.remove("hidden");
    adminDashboard.classList.add("hidden");
    showScreen("admin");
    adminError.textContent =
      "Akun ini belum memiliki hak admin. Gunakan akun admin yang sudah diverifikasi.";
  }
} catch (error) {
  console.error(error);
  showScreen("admin");
}
return;

}

isAdmin = false;
currentUsername = localStorage.getItem(“anonchat_username”) || “”;
updateMyProfile();

if (currentUsername) {
usernameInput.value = currentUsername;
showScreen(“chat”);
} else {
showScreen(“username”);
}
});

startConnectionListene
