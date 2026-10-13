import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  query,
  limitToLast,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const $ = (id) => document.getElementById(id);
const screens = {
  username: $("usernameScreen"),
  chat: $("chatScreen"),
  admin: $("adminScreen"),
  rules: $("rulesScreen")
};
const usernameForm = $("usernameForm");
const usernameInput = $("usernameInput");
const usernameError = $("usernameError");
const messageForm = $("messageForm");
const messageInput = $("messageInput");
const messages = $("messages");
const characterCount = $("characterCount");
const sendButton = $("sendButton");
const adminForm = $("adminForm");
const adminEmail = $("adminEmail");
const adminPassword = $("adminPassword");
const adminError = $("adminError");
const adminSettingsForm = $("adminSettingsForm");
const adminLoginCard = $("adminLoginCard");
const adminSettingsCard = $("adminSettingsCard");
const displayNameInput = $("displayNameInput");
const titleInput = $("titleInput");
const badgeIconInput = $("badgeIconInput");
const badgeColorInput = $("badgeColorInput");
const toast = $("toast");
let username = localStorage.getItem("anonchat_username") || "";
let currentUser = null;
let isAdmin = false;
let adminProfile = null;
let listenerStarted = false;
let toastTimer;
let chatReady = false;
const defaultAdminProfile = {
  displayName: "Kagi",
  title: "FOUNDER",
  badgeIcon: "👑",
  badgeColor: "rainbow"
};
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
function showScreen(name) {
  Object.values(screens).forEach((screen) => {
    screen.classList.add("hidden");
  });
  screens[name].classList.remove("hidden");
  $("pageTitle").textContent = {
    username: "Pilih Username",
    chat: "Ruang Chat",
    admin: "Panel Admin",
    rules: "Firebase Rules"
  }[name];
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.remove("active");
  });
  if (name === "chat") $("chatNav").classList.add("active");
  if (name === "admin") $("adminNav").classList.add("active");
  if (name === "rules") $("rulesNav").classList.add("active");
}
function validUsername(value) {
  return /^[a-zA-Z0-9_]{3,24}$/.test(value);
}
function updateUsernameLabel() {
  $("currentUsername").textContent = username || "Username";
}
function setConnectionStatus(text) {
  $("connectionStatus").textContent = text;
}
function showUsernameScreen() {
  showScreen("username");
  usernameInput.value = username;
  usernameInput.focus();
}
function enterChat() {
  if (!username || !validUsername(username)) {
    showUsernameScreen();
    return;
  }
  updateUsernameLabel();
  showScreen("chat");
  startMessageListener();
}
function updateAdminSettingsUI() {
  adminLoginCard.classList.toggle("hidden", isAdmin);
  adminSettingsCard.classList.toggle("hidden", !isAdmin);
  if (!isAdmin) return;
  displayNameInput.value = adminProfile.displayName;
  titleInput.value = adminProfile.title;
  badgeIconInput.value = adminProfile.badgeIcon;
  badgeColorInput.value = adminProfile.badgeColor;
}
function showFriendlyError(error) {
  console.error(error);
  const messages = {
    "auth/invalid-credential": "Email atau password admin salah.",
    "auth/invalid-email": "Format email tidak valid.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
    "auth/network-request-failed": "Koneksi internet bermasalah.",
    "auth/operation-not-allowed": "Metode autentikasi belum diaktifkan di Firebase."
  };
  return messages[error.code] || "Terjadi kesalahan. Periksa konfigurasi Firebase.";
}
// Username
usernameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = usernameInput.value.trim();
  if (!validUsername(value)) {
    usernameError.textContent =
      "Gunakan 3–24 karakter: huruf, angka, atau underscore.";
    return;
  }
  if (!currentUser) {
    showToast("Sedang menghubungkan ke Firebase. Coba lagi sebentar.");
    return;
  }
  username = value;
  localStorage.setItem("anonchat_username", username);
  usernameError.textContent = "";
  updateUsernameLabel();
  enterChat();
});
$("changeUsernameButton").addEventListener("click", () => {
  showUsernameScreen();
});
$("chatNav").addEventListener("click", () => {
  if (username) enterChat();
  else showUsernameScreen();
});
// Admin navigation
$("adminNav").addEventListener("click", () => {
  updateAdminSettingsUI();
  showScreen("admin");
});
$("rulesNav").addEventListener("click", () => {
  showScreen("rules");
});
// Login admin memakai akun Firebase Email/Password.
// Buat akun admin terlebih dahulu melalui Firebase Authentication.
adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminError.textContent = "";
  try {
    const result = await signInWithEmailAndPassword(
      auth,
      adminEmail.value.trim(),
      adminPassword.value
    );
    currentUser = result.user;
    // Penting: login email/password tidak otomatis memberi hak admin
    // pada Firebase Rules. Hak admin harus diverifikasi melalui custom
    // claims atau mekanisme server tepercaya.
    isAdmin = false;
    adminError.textContent =
      "Login Firebase berhasil, tetapi hak admin belum diverifikasi. Konfigurasikan custom claims admin terlebih dahulu.";
    showToast("Autentikasi berhasil; hak admin perlu diverifikasi.");
  } catch (error) {
    adminError.textContent = showFriendlyError(error);
  }
});
// Profil admin disimpan lokal untuk tampilan saja.
// Ini tidak memberikan hak admin pada database.
adminSettingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isAdmin) {
    showToast("Hak admin belum diverifikasi.");
    return;
  }
  adminProfile = {
    displayName: displayNameInput.value.trim().slice(0, 24),
    title: titleInput.value.trim().slice(0, 20),
    badgeIcon: badgeIconInput.value.trim().slice(0, 8) || "👑",
    badgeColor: badgeColorInput.value
  };
  localStorage.setItem(
    "anonchat_admin_profile",
    JSON.stringify(adminProfile)
  );
  showToast("Profil admin disimpan.");
});
$("adminLogoutButton").addEventListener("click", async () => {
  await signOut(auth);
  isAdmin = false;
  adminProfile = null;
  updateAdminSettingsUI();
  showToast("Logout berhasil.");
  enterChat();
});
// Character counter
messageInput.addEventListener("input", () => {
  characterCount.textContent = `${messageInput.value.length}/500`;
});
// Message rendering
function renderMessage(data) {
  const message = document.createElement("div");
  message.className = "message-item";
  const isAdminMessage = data.isAdmin === true;
  const displayedName = isAdminMessage && data.displayName
    ? data.displayName
    : data.username || "Anonim";
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = displayedName.charAt(0).toUpperCase();
  const content = document.createElement("div");
  content.className = "message-content";
  const meta = document.createElement("div");
  meta.className = "message-meta";
  const name = document.createElement("span");
  name.className = "message-username";
  name.textContent = displayedName;
  if (isAdminMessage) {
    name.classList.add("admin-rainbow");
    const badge = document.createElement("span");
    badge.className = "admin-badge";
    badge.dataset.color = data.badgeColor || "rainbow";
    badge.textContent = `${data.badgeIcon || "👑"} ${data.title || "ADMIN"}`;
    name.appendChild(badge);
  }
  const time = document.createElement("span");
  time.className = "message-time";
  if (typeof data.createdAt === "number") {
    time.textContent = new Date(data.createdAt).toLocaleTimeString(
      "id-ID",
      { hour: "2-digit", minute: "2-digit" }
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
}
function startMessageListener() {
  if (listenerStarted) return;
  listenerStarted = true;
  const recentMessages = query(
    ref(db, "messages"),
    limitToLast(100)
  );
  onChildAdded(recentMessages, (snapshot) => {
    const data = snapshot.val();
    if (!data || typeof data.text !== "string") return;
    $("emptyState")?.remove();
    renderMessage(data);
  }, (error) => {
    console.error("Message listener:", error);
    showToast("Gagal membaca pesan. Periksa Firebase Rules.");
    listenerStarted = false;
  });
}
// Send message
messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser || !username || !validUsername(username)) {
    showUsernameScreen();
    return;
  }
  const text = messageInput.value.trim();
  if (!text) return;
  if (text.length > 500) {
    showToast("Pesan maksimal 500 karakter.");
    return;
  }
  sendButton.disabled = true;
  try {
    const payload = {
      username,
      text,
      createdAt: Date.now(),
      serverCreatedAt: serverTimestamp()
    };
    // Field admin hanya boleh digunakan setelah hak admin
    // benar-benar diverifikasi di server.
    if (isAdmin && adminProfile) {
      payload.isAdmin = true;
      payload.displayName = adminProfile.displayName;
      payload.title = adminProfile.title;
      payload.badgeIcon = adminProfile.badgeIcon;
      payload.badgeColor = adminProfile.badgeColor;
    }
    await push(ref(db, "messages"), payload);
    messageInput.value = "";
    characterCount.textContent = "0/500";
    showToast("Pesan terkirim.");
  } catch (error) {
    console.error("Send message error:", error);
    showToast("Pesan gagal dikirim. Periksa Firebase Rules dan autentikasi.");
  } finally {
    sendButton.disabled = false;
  }
});
// Restore local profile
try {
  const saved = JSON.parse(
    localStorage.getItem("anonchat_admin_profile") || "null"
  );
  if (saved) {
    adminProfile = { ...defaultAdminProfile, ...saved };
  } else {
    adminProfile = { ...defaultAdminProfile };
  }
} catch {
  adminProfile = { ...defaultAdminProfile };
}
// Authentication bootstrap
onAuthStateChanged(auth, async (user) => {
  try {
    if (user) {
      currentUser = user;
      // Untuk sesi email/password, jangan otomatis mengubah akun
      // menjadi anonim. Hak admin memerlukan verifikasi khusus.
      if (user.isAnonymous) {
        setConnectionStatus("Terhubung sebagai anonim");
      } else {
        setConnectionStatus("Login Firebase aktif");
      }
      $("authStatus").textContent = "Terautentikasi";
      $("databaseStatus").textContent = "Siap";
      if (username && validUsername(username)) {
        enterChat();
      } else {
        showUsernameScreen();
      }
      chatReady = true;
      return;
    }
    const result = await signInAnonymously(auth);
    currentUser = result.user;
    setConnectionStatus("Terhubung sebagai anonim");
    $("authStatus").textContent = "Terautentikasi";
    $("databaseStatus").textContent = "Siap";
    if (username && validUsername(username)) {
      enterChat();
    } else {
      showUsernameScreen();
    }
    chatReady = true;
  } catch (error) {
    console.error("Authentication bootstrap:", error);
    setConnectionStatus("Koneksi bermasalah");
    $("authStatus").textContent = "Gagal";
    $("databaseStatus").textContent = "Periksa konfigurasi";
    showToast(showFriendlyError(error));
  }
});
