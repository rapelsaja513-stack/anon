import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  query,
  limitToLast
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const $ = (id) => document.getElementById(id);
const usernameScreen = $("usernameScreen");
const appScreen = $("appScreen");
const adminScreen = $("adminScreen");
const usernameForm = $("usernameForm");
const usernameInput = $("usernameInput");
const usernameError = $("usernameError");
const messageForm = $("messageForm");
const messageInput = $("messageInput");
const messages = $("messages");
const characterCount = $("characterCount");
const sendButton = $("sendButton");
const changeUsernameButton = $("changeUsernameButton");
const openAdminButton = $("openAdminButton");
const adminButton = $("adminButton");
const backButton = $("backButton");
const adminForm = $("adminForm");
const adminUsername = $("adminUsername");
const adminPassword = $("adminPassword");
const adminError = $("adminError");
const toast = $("toast");
let username = localStorage.getItem("anonchat_username") || "";
let isAdmin = sessionStorage.getItem("anonchat_admin") === "true";
let adminConfig = null;
let messageListenerStarted = false;
let toastTimer;
function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
function showScreen(screen) {
  if (!screen) return;
  usernameScreen?.classList.add("hidden");
  appScreen?.classList.add("hidden");
  adminScreen?.classList.add("hidden");
  screen.classList.remove("hidden");
}
function validUsername(value) {
  return /^[a-zA-Z0-9_]{3,24}$/.test(value);
}
function enterChat() {
  if (!username || !validUsername(username)) {
    requestUsername();
    return;
  }
  showScreen(appScreen);
  startMessageListener();
}
function requestUsername() {
  showScreen(usernameScreen);
  if (usernameInput) {
    usernameInput.value = username;
    usernameInput.focus();
  }
}
usernameForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = usernameInput.value.trim();
  if (!validUsername(value)) {
    usernameError.textContent =
      "Gunakan 3–24 karakter: huruf, angka, atau underscore.";
    return;
  }
  username = value;
  localStorage.setItem("anonchat_username", username);
  usernameError.textContent = "";
  enterChat();
});
changeUsernameButton?.addEventListener("click", () => {
  requestUsername();
});
openAdminButton?.addEventListener("click", () => {
  showScreen(adminScreen);
});
adminButton?.addEventListener("click", () => {
  if (isAdmin) {
    const shouldLogout = confirm("Logout dari mode admin?");
    if (shouldLogout) {
      isAdmin = false;
      adminConfig = null;
      sessionStorage.removeItem("anonchat_admin");
      sessionStorage.removeItem("anonchat_admin_config");
      showToast("Mode admin dinonaktifkan.");
      enterChat();
    }
    return;
  }
  showScreen(adminScreen);
});
backButton?.addEventListener("click", () => {
  if (username && validUsername(username)) {
    enterChat();
  } else {
    requestUsername();
  }
});
// Login admin
adminForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminError.textContent = "";
  try {
    const response = await fetch("./admin.json", {
      cache: "no-store"
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
    adminConfig = credentials;
    isAdmin = true;
    sessionStorage.setItem("anonchat_admin", "true");
    sessionStorage.setItem(
      "anonchat_admin_config",
      JSON.stringify(credentials)
    );
    adminForm.reset();
    showToast("Mode admin aktif.");
    if (!username || !validUsername(username)) {
      requestUsername();
    } else {
      enterChat();
    }
  } catch (error) {
    console.error("Admin login error:", error);
    adminError.textContent =
      "Gagal memuat konfigurasi admin. Periksa admin.json.";
  }
});
// Pulihkan konfigurasi admin selama sesi browser masih aktif
if (isAdmin) {
  try {
    adminConfig = JSON.parse(
      sessionStorage.getItem("anonchat_admin_config") || "null"
    );
  } catch {
    adminConfig = null;
  }
}
// Character counter
messageInput?.addEventListener("input", () => {
  if (characterCount) {
    characterCount.textContent = `${messageInput.value.length}/500`;
  }
});
// Realtime listener
function startMessageListener() {
  if (messageListenerStarted || !messages) return;
  messageListenerStarted = true;
  const recentMessages = query(
    ref(db, "messages"),
    limitToLast(100)
  );
  onChildAdded(
    recentMessages,
    (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data.text !== "string") return;
      $("emptyState")?.remove();
      const message = document.createElement("div");
      message.className = "message-item";
      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      const displayedName =
        data.isAdmin === true && data.displayName
          ? data.displayName
          : data.username || "Anonim";
      avatar.textContent = displayedName.charAt(0).toUpperCase();
      const content = document.createElement("div");
      content.className = "message-content";
      const meta = document.createElement("div");
      meta.className = "message-meta";
      const name = document.createElement("span");
      name.className = "message-username";
      name.textContent = displayedName;
      if (data.isAdmin === true) {
        name.classList.add("admin-rainbow");
        const badge = document.createElement("span");
        badge.className = "admin-badge";
        const icon = data.badgeIcon || "👑";
        const badgeText = data.badgeText || "ADMIN";
        badge.textContent = `${icon} ${badgeText}`;
        name.appendChild(badge);
      }
      const time = document.createElement("span");
      time.className = "message-time";
      if (typeof data.createdAt === "number") {
        time.textContent = new Date(
          data.createdAt
        ).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit"
        });
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
      messageListenerStarted = false;
    }
  );
}
// Kirim pesan
messageForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!username || !validUsername(username)) {
    requestUsername();
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
    const messageData = {
      username,
      text,
      isAdmin: Boolean(isAdmin),
      createdAt: Date.now()
    };
    if (isAdmin && adminConfig) {
      messageData.displayName = adminConfig.displayName || username;
      messageData.badgeText = adminConfig.badgeText || "ADMIN";
      messageData.badgeIcon = adminConfig.badgeIcon || "👑";
    }
    await push(ref(db, "messages"), messageData);
    messageInput.value = "";
    if (characterCount) {
      characterCount.textContent = "0/500";
    }
  } catch (error) {
    console.error("Send message error:", error);
    showToast("Pesan gagal dikirim. Periksa Firebase Rules.");
  } finally {
    sendButton.disabled = false;
  }
});
// Tentukan layar awal
if (username && validUsername(username)) {
  enterChat();
} else {
  requestUsername();
}
