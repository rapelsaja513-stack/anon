}
import { initializeApp } from “https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js”;

import {
getDatabase,
ref,
push,
query,
limitToLast,
onValue,
onChildAdded,
serverTimestamp
} from “https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js”;

import { firebaseConfig } from “./firebase-config.js”;

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const messagesRef = ref(db, “messages”);
const latestMessagesQuery = query(messagesRef, limitToLast(100));

const messageList = document.getElementById(“messageList”);
const emptyState = document.getElementById(“emptyState”);
const messageForm = document.getElementById(“messageForm”);
const messageInput = document.getElementById(“messageInput”);
const sendButton = document.getElementById(“sendButton”);
const charCount = document.getElementById(“charCount”);
const notice = document.getElementById(“notice”);
const connectionStatus = document.getElementById(“connectionStatus”);

const currentUsername = document.getElementById(“currentUsername”);
const userAvatar = document.getElementById(“userAvatar”);
const changeNameBtn = document.getElementById(“changeNameBtn”);

const nameDialog = document.getElementById(“nameDialog”);
const nameForm = document.getElementById(“nameForm”);
const nameInput = document.getElementById(“nameInput”);
const cancelNameBtn = document.getElementById(“cancelNameBtn”);

const renderedMessages = new Set();

let sending = false;
let username = getSavedUsername();

document.getElementById(“year”).textContent = new Date().getFullYear();

function getSavedUsername() {
try {
return localStorage.getItem(“anonchat_username”) || “”;
} catch {
return “”;
}
}

function saveUsername(name) {
username = name;

try {
localStorage.setItem(“anonchat_username”, name);
} catch {
// Chat masih bisa digunakan jika penyimpanan lokal tidak tersedia.
}

updateIdentity();
}

function updateIdentity() {
const displayName = username || “Anonymous”;

currentUsername.textContent = displayName;
userAvatar.textContent = displayName.charAt(0).toUpperCase();
}

function showNotice(message) {
notice.textContent = message;
}

function setConnectionStatus(connected) {
connectionStatus.textContent = connected ? “Connected” : “Disconnected”;

const dot = document.querySelector(”.topbar-right .status-dot”);

dot.classList.toggle(“is-connected”, connected);
}

function updateCharacterCount() {
charCount.textContent = ${messageInput.value.length} / 500;
}

function formatTime(timestamp) {
if (!Number.isFinite(timestamp)) return “Just now”;

return new Date(timestamp).toLocaleTimeString(undefined, {
hour: “2-digit”,
minute: “2-digit”
});
}

function createMessageElement(message, id) {
const article = document.createElement(“article”);
article.className = “message”;
article.dataset.id = id;

const avatar = document.createElement(“div”);
avatar.className = “message-avatar”;
avatar.textContent = (message.username || “A”).charAt(0).toUpperCase();

const content = document.createElement(“div”);
content.className = “message-content”;

const meta = document.createElement(“div”);
meta.className = “message-meta”;

const name = document.createElement(“span”);
name.className = “message-name”;
name.textContent = message.username || “Anonymous”;

const time = document.createElement(“time”);
time.className = “message-time”;

const timestamp = Number(message.createdAt);
time.textContent = formatTime(timestamp);

if (Number.isFinite(timestamp)) {
time.dateTime = new Date(timestamp).toISOString();
}

const text = document.createElement(“p”);
text.className = “message-text”;

// Gunakan textContent agar teks pengguna tidak dijalankan sebagai HTML.
text.textContent = message.text || “”;

meta.append(name, time);
content.append(meta, text);
article.append(avatar, content);

return article;
}

function renderMessage(id, message) {
if (renderedMessages.has(id)) return;

if (
typeof message?.username !== “string” ||
typeof message?.text !== “string”
) {
return;
}

renderedMessages.add(id);
emptyState.hidden = true;

const element = createMessageElement(message, id);
messageList.appendChild(element);

// Maksimal 100 pesan ditampilkan di layar.
while (messageList.querySelectorAll(”.message”).length > 100) {
const firstMessage = messageList.querySelector(”.message”);

if (!firstMessage) break;
renderedMessages.delete(firstMessage.dataset.id);
firstMessage.remove();

}

messageList.scrollTop = messageList.scrollHeight;
}

function validateMessage(text) {
if (!username) {
return “Tetapkan nama samaran terlebih dahulu.”;
}

if (!text) {
return “Pesan tidak boleh kosong.”;
}

if (text.length > 500) {
return “Pesan maksimal 500 karakter.”;
}

if (text.length > 0 && !/\S/.test(text)) {
return “Pesan tidak boleh hanya berisi spasi.”;
}

return “”;
}

messageInput.addEventListener(“input”, () => {
updateCharacterCount();

messageInput.style.height = “auto”;
messageInput.style.height =
${Math.min(messageInput.scrollHeight, 120)}px;
});

messageInput.addEventListener(“keydown”, (event) => {
if (event.key === “Enter” && !event.shiftKey) {
event.preventDefault();
messageForm.requestSubmit();
}
});

messageForm.addEventListener(“submit”, async (event) => {
event.preventDefault();

if (sending) return;

const text = messageInput.value.trim();
const error = validateMessage(text);

if (error) {
showNotice(error);
return;
}

sending = true;
sendButton.disabled = true;
showNotice(””);

try {
await push(messagesRef, {
username,
text,
createdAt: Date.now(),
serverCreatedAt: serverTimestamp()
});

messageInput.value = "";
messageInput.style.height = "auto";
updateCharacterCount();
messageInput.focus();

} catch (error) {
console.error(“Failed to send message:”, error);

showNotice(
  "Pesan gagal dikirim. Periksa koneksi dan Firebase Rules."
);

} finally {
sending = false;
sendButton.disabled = false;
}
});

changeNameBtn.addEventListener(“click”, () => {
nameInput.value = username;
nameDialog.showModal();
nameInput.focus();
});

cancelNameBtn.addEventListener(“click”, () => {
nameDialog.close();
});

nameForm.addEventListener(“submit”, (event) => {
event.preventDefault();

const name = nameInput.value.trim();

if (!name || name.length > 24) {
return;
}

saveUsername(name);
nameDialog.close();
showNotice(””);
});

onValue(
ref(db, “.info/connected”),
(snapshot) => {
setConnectionStatus(snapshot.val() === true);
},
(error) => {
console.error(“Connection status error:”, error);
setConnectionStatus(false);
}
);

onChildAdded(latestMessagesQuery, (snapshot) => {
renderMessage(snapshot.key, snapshot.val());
}, (error) => {
console.error(“Message listener error:”, error);
showNotice(“Pesan tidak dapat dimuat. Periksa Firebase Rules.”);
});

updateIdentity();
updateCharacterCount();

if (!username) {
nameDialog.showModal();
nameInput.focus();
