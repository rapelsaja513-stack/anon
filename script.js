import { initializeApp } from
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  updateProfile
} from
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  set,
  push,
  query,
  limitToLast,
  onChildAdded
} from
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

import { firebaseConfig } from "./firebase-config.js";


/* =====================================================
   KONFIGURASI
===================================================== */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/*
  GANTI NILAI DI BAWAH DENGAN UID AKUN ADMIN MILIKMU.

  Contoh:
  const ADMIN_UIDS = [
    "uid-yang-kamu-salin-dari-firebase"
  ];

  Jangan isi dengan email atau username.
*/
const ADMIN_UIDS = [
  "GANTI_DENGAN_UID_ADMIN"
];


/* =====================================================
   ELEMENT HTML
===================================================== */

const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");

const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authDescription = document.getElementById("authDescription");

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");

const usernameGroup = document.getElementById("usernameGroup");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const mathQuestion = document.getElementById("mathQuestion");
const mathAnswer = document.getElementById("mathAnswer");

const authMessage = document.getElementById("authMessage");
const authSubmit = document.getElementById("authSubmit");

const logoutButton = document.getElementById("logoutButton");

const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const characterCount = document.getElementById("characterCount");

const messagesContainer = document.getElementById("messages");
const emptyState = document.getElementById("emptyState");

const toast = document.getElementById("toast");


/* =====================================================
   STATE
===================================================== */

let authMode = "login";
let expectedMathAnswer = 0;

let currentUser = null;
let currentProfile = null;

let stopMessagesListener = null;
let toastTimer = null;


/* =====================================================
   UTILITIES
===================================================== */

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function showAuthMessage(message, success = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("success", success);
}

function setButtonLoading(loading, text) {
  authSubmit.disabled = loading;
  authSubmit.textContent = loading ? "Memproses..." : text;
}

function cleanUsername(value) {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function isValidUsername(value) {
  return /^[a-zA-Z0-9_ ]{3,24}$/.test(value);
}

function isAdmin(uid) {
  return ADMIN_UIDS.includes(uid) &&
    !ADMIN_UIDS.includes("GANTI_DENGAN_UID_ADMIN");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

function formatTime(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  return new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function showAuthScreen() {
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

function showAppScreen() {
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
}


/* =====================================================
   MATHEMATICS CAPTCHA
===================================================== */

function generateMathQuestion() {
  const firstNumber = Math.floor(Math.random() * 9) + 1;
  const secondNumber = Math.floor(Math.random() * 9) + 1;

  const useSubtraction = Math.random() >= 0.5;

  let a = firstNumber;
  let b = secondNumber;
  let operator = "+";

  if (useSubtraction) {
    if (a < b) {
      [a, b] = [b, a];
    }

    operator = "-";
    expectedMathAnswer = a - b;
  } else {
    expectedMathAnswer = a + b;
  }

  mathQuestion.textContent = `${a} ${operator} ${b}`;
  mathAnswer.value = "";
}

function validateMathAnswer() {
  if (
    mathAnswer.value.trim() === "" ||
    Number(mathAnswer.value) !== expectedMathAnswer
  ) {
    generateMathQuestion();
    mathAnswer.focus();

    showAuthMessage(
      "Jawaban matematika salah. Coba jawab soal yang baru."
    );

    return false;
  }

  return true;
}


/* =====================================================
   LOGIN / REGISTER UI
===================================================== */

function setAuthMode(mode) {
  authMode = mode;

  const isRegister = mode === "register";

  loginTab.classList.toggle("active", !isRegister);
  registerTab.classList.toggle("active", isRegister);

  usernameGroup.classList.toggle("hidden", !isRegister);
  usernameInput.required = isRegister;

  passwordInput.autocomplete = isRegister
    ? "new-password"
    : "current-password";

  authTitle.textContent = isRegister
    ? "Create your account"
    : "Welcome back";

  authDescription.textContent = isRegister
    ? "Buat akun untuk bergabung dengan komunitas."
    : "Masuk dan lanjutkan percakapanmu.";

  authSubmit.textContent = isRegister
    ? "Buat akun"
    : "Masuk ke AnonChat";

  showAuthMessage("");
  generateMathQuestion();
}

loginTab.addEventListener("click", () => {
  setAuthMode("login");
});

registerTab.addEventListener("click", () => {
  setAuthMode("register");
});


/* =====================================================
   AUTH FORM SUBMISSION
===================================================== */

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateMathAnswer()) {
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  const username = cleanUsername(usernameInput.value);

  if (authMode === "register") {
    if (!isValidUsername(username)) {
      showAuthMessage(
        "Username harus 3–24 karakter dan hanya boleh berisi huruf, angka, spasi, atau underscore."
      );

      return;
    }
  }

  if (password.length < 6) {
    showAuthMessage("Password minimal 6 karakter.");
    return;
  }

  setButtonLoading(true, "");

  try {
    /*
      Firebase Auth menyimpan sesi login secara lokal
      agar pengguna tidak harus login berulang kali.
    */
    await setPersistence(auth, browserLocalPersistence);

    if (authMode === "register") {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await updateProfile(credential.user, {
        displayName: username
      });

      /*
        Akun baru selalu dibuat sebagai user biasa.
        Status admin tidak diberikan melalui form.
      */
      await set(ref(db, `users/${credential.user.uid}`), {
        username: username,
        role: "user"
      });

      showAuthMessage("Akun berhasil dibuat.", true);

      showToast("Selamat datang di AnonChat!");

    } else {
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      showToast("Login berhasil!");
    }

  } catch (error) {
    console.error("Authentication error:", error);

    const messages = {
      "auth/email-already-in-use":
        "Email ini sudah terdaftar. Silakan login.",

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

      "auth/too-many-requests":
        "Terlalu banyak percobaan. Coba lagi nanti.",

      "auth/network-request-failed":
        "Koneksi bermasalah. Periksa internetmu.",

      "auth/operation-not-allowed":
        "Login email/password belum diaktifkan di Firebase."
    };

    showAuthMessage(
      messages[error.code] ||
      "Terjadi kesalahan. Periksa konfigurasi Firebase dan Rules."
    );

    generateMathQuestion();

  } finally {
    setButtonLoading(
      false,
      authMode === "register" ? "Buat akun" : "Masuk ke AnonChat"
    );
  }
});


/* =====================================================
   SESSION RESTORATION
===================================================== */

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  currentProfile = null;

  if (stopMessagesListener) {
    stopMessagesListener();
    stopMessagesListener = null;
  }

  messagesContainer.replaceChildren();

  if (!user) {
    showAuthScreen();
    return;
  }

  try {
    const profileRef = ref(db, `users/${user.uid}`);
    const snapshot = await get(profileRef);

    if (!snapshot.exists()) {
      /*
        Jika akun lama belum mempunyai profil,
        buat profil standar. Tidak memberikan admin.
      */
      const fallbackUsername = cleanUsername(
        user.displayName ||
        user.email?.split("@")[0] ||
        "Anonymous"
      ).slice(0, 24);

      await set(profileRef, {
        username: fallbackUsername,
        role: "user"
      });

      currentProfile = {
        username: fallbackUsername,
        role: "user"
      };

    } else {
      currentProfile = snapshot.val();
    }

    if (!currentProfile?.username) {
      throw new Error("Profil tidak memiliki username.");
    }

    showAppScreen();
    startMessagesListener();

  } catch (error) {
    console.error("Profile error:", error);

    showAuthScreen();

    showAuthMessage(
      "Gagal memuat profil. Periksa Firebase Realtime Database Rules."
    );
  }
});


/* =====================================================
   REALTIME MESSAGES
===================================================== */

function startMessagesListener() {
  if (!currentUser || !currentProfile) {
    return;
  }

  if (stopMessagesListener) {
    stopMessagesListener();
    stopMessagesListener = null;
  }

  messagesContainer.replaceChildren();

  const messagesQuery = query(
    ref(db, "messages"),
    limitToLast(100)
  );

  let hasMessages = false;

  stopMessagesListener = onChildAdded(
    messagesQuery,
    (snapshot) => {
      const message = snapshot.val();

      if (
        !message ||
        typeof message.text !== "string" ||
        typeof message.username !== "string"
      ) {
        return;
      }

      hasMessages = true;

      const emptyElement = document.getElementById("emptyState");

      if (emptyElement) {
        emptyElement.remove();
      }

      renderMessage(message);
    },
    (error) => {
      console.error("Message listener error:", error);
      showToast("Tidak dapat memuat chat. Periksa Database Rules.");
    }
  );

  if (!hasMessages) {
    const empty = document.createElement("div");

    empty.id = "emptyState";
    empty.className = "empty-state";

    empty.innerHTML = `
      <div class="empty-icon">✦</div>
      <h3>Mulai percakapan</h3>
      <p>Jadilah orang pertama yang mengirim pesan.</p>
    `;

    messagesContainer.appendChild(empty);
  }
}

function renderMessage(message) {
  const item = document.createElement("article");
  item.className = "message-item";

  if (message.uid === currentUser?.uid) {
    item.classList.add("own-message");
  }

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = (
    message.username.trim().charAt(0) || "A"
  ).toUpperCase();

  const content = document.createElement("div");
  content.className = "message-content";

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const name = document.createElement("span");
  name.className = "message-username";
  name.textContent = message.username;

  meta.appendChild(name);

  /*
    Badge admin muncul hanya jika pesan membawa role admin
    yang telah divalidasi Firebase Rules.
  */
  if (message.role === "admin") {
    const badge = document.createElement("span");
    badge.className = "admin-badge";
    badge.innerHTML = "<span>✦ ADMIN</span>";
    meta.appendChild(badge);
  }

  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = formatTime(message.createdAt);

  meta.appendChild(time);

  const text = document.createElement("p");
  text.className = "message-text";

  /*
    textContent mencegah pesan pengguna
    diperlakukan sebagai HTML.
  */
  text.textContent = message.text;

  content.append(meta, text);
  item.append(avatar, content);

  messagesContainer.appendChild(item);

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}


/* =====================================================
   SEND MESSAGE
===================================================== */

messageInput.addEventListener("input", () => {
  characterCount.textContent =
    `${messageInput.value.length}/500`;
});

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser || !currentProfile) {
    showToast("Silakan login terlebih dahulu.");
    return;
  }

  const text = messageInput.value.trim();

  if (!text) {
    return;
  }

  if (text.length > 500) {
    showToast("Pesan maksimal 500 karakter.");
    return;
  }

  sendButton.disabled = true;

  try {
    const trustedAdmin = isAdmin(currentUser.uid);

    const messageRef = push(ref(db, "messages"));

    await set(messageRef, {
      uid: currentUser.uid,
      username: currentProfile.username,
      role: trustedAdmin ? "admin" : "user",
      text: text,
      createdAt: Date.now()
    });

    messageInput.value = "";
    characterCount.textContent = "0/500";
    messageInput.focus();

  } catch (error) {
    console.error("Send message error:", error);

    showToast(
      "Pesan gagal dikirim. Periksa Firebase Realtime Database Rules."
    );

  } finally {
    sendButton.disabled = false;
  }
});


/* =====================================================
   LOGOUT
===================================================== */

logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showToast("Kamu sudah logout.");
  } catch (error) {
    console.error("Logout error:", error);
    showToast("Gagal logout. Coba lagi.");
  }
});


/* =====================================================
   INITIALIZATION
===================================================== */

setAuthMode("login");
