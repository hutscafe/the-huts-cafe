import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { starterMenu } from "./menu-data.js";

const $ = (selector) => document.querySelector(selector);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let liveMenu = [];
let stopMenu = null;
let stopSettings = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function message(selector, text, error = false) {
  const element = $(selector);
  element.textContent = text;
  element.style.color = error ? "#a62920" : "#17623f";
}

$("#adminLoginBtn").onclick = async () => {
  message("#adminLoginError", "");
  try {
    await signInWithEmailAndPassword(
      auth,
      $("#adminEmail").value.trim(),
      $("#adminPassword").value,
    );
  } catch {
    message("#adminLoginError", "Email ya password galat hai", true);
  }
};

$("#adminLogout").onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
  $("#adminLogin").classList.toggle("hidden", Boolean(user));
  $("#adminDashboard").classList.add("hidden");
  stopMenu?.();
  stopSettings?.();
  if (!user) return;

  try {
    await getDoc(doc(db, "admin", "access"));
    $("#adminDashboard").classList.remove("hidden");
    startAdminData();
  } catch {
    $("#adminLogin").classList.remove("hidden");
    message(
      "#adminLoginError",
      "Is account ko Vasuki Admin access nahi hai.",
      true,
    );
    await signOut(auth);
  }
});

function startAdminData() {
  stopMenu = onSnapshot(
    collection(db, "menu"),
    (snapshot) => {
      liveMenu = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
      renderMenu();
    },
    () =>
      message(
        "#menuAdminStatus",
        "Access denied: Firestore Rules me apna admin email set karein.",
        true,
      ),
  );

  stopSettings = onSnapshot(doc(db, "settings", "public"), (snapshot) => {
    const settings = snapshot.data() || {};
    $("#heroImageUrl").value = settings.heroImage || "";
    $("#logoImageUrl").value = settings.logoImage || "";
    $("#paymentQrUrl").value = settings.paymentQr || "";
    updatePreviews();
  });
}

function renderMenu() {
  const query = $("#adminSearch").value.trim().toLowerCase();
  const filtered = liveMenu.filter(
    (item) =>
      item.name?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query),
  );

  $("#adminMenuList").innerHTML = filtered
    .map(
      (item) => `
        <article class="admin-item" data-item="${escapeHtml(item.id)}">
          <div class="admin-item-head">
            <img src="${escapeHtml(item.image || "assets/cafe-logo.png")}" alt="">
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml(item.category)} · ₹${Number(item.price) || 0} · ${
                item.available === false ? "Hidden" : "Live"
              }</p>
            </div>
            <div class="admin-actions">
              <button data-edit="${escapeHtml(item.id)}">Edit</button>
              <button class="danger" data-delete="${escapeHtml(item.id)}">Delete</button>
            </div>
          </div>
          <div class="admin-edit-grid hidden">
            <label>Name<input data-field="name" value="${escapeHtml(item.name)}"></label>
            <label>Category<input data-field="category" value="${escapeHtml(item.category)}"></label>
            <label>Price ₹<input data-field="price" type="number" min="0" value="${Number(item.price) || 0}"></label>
            <label>Image URL<input data-field="image" type="url" value="${escapeHtml(item.image || "")}"></label>
            <label>Status
              <select data-field="available">
                <option value="true" ${item.available !== false ? "selected" : ""}>Live</option>
                <option value="false" ${item.available === false ? "selected" : ""}>Hidden</option>
              </select>
            </label>
            <button class="primary" data-save="${escapeHtml(item.id)}">Save changes</button>
          </div>
        </article>
      `,
    )
    .join("");
}

$("#adminSearch").oninput = renderMenu;

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.adminTab) {
    document
      .querySelectorAll("[data-admin-tab]")
      .forEach((tab) => tab.classList.toggle("active", tab === button));
    $("#menuAdminPanel").classList.toggle(
      "hidden",
      button.dataset.adminTab !== "menu",
    );
    $("#brandingAdminPanel").classList.toggle(
      "hidden",
      button.dataset.adminTab !== "branding",
    );
  }

  if (button.dataset.edit) {
    button
      .closest(".admin-item")
      .querySelector(".admin-edit-grid")
      .classList.toggle("hidden");
  }

  if (button.dataset.save) await saveItem(button);

  if (
    button.dataset.delete &&
    confirm("Is food item ko permanently delete karna hai?")
  ) {
    try {
      await deleteDoc(doc(db, "menu", button.dataset.delete));
      message("#menuAdminStatus", "Food item delete ho gaya.");
    } catch {
      message(
        "#menuAdminStatus",
        "Delete nahi hua. Admin Rules check karein.",
        true,
      );
    }
  }
});

async function saveItem(button) {
  const card = button.closest(".admin-item");
  const value = (field) => card.querySelector(`[data-field="${field}"]`).value;
  const price = Number(value("price"));
  if (!value("name").trim() || !value("category").trim() || price < 0) {
    return message(
      "#menuAdminStatus",
      "Name, category aur valid price zaroori hai.",
      true,
    );
  }
  try {
    await setDoc(
      doc(db, "menu", button.dataset.save),
      {
        name: value("name").trim(),
        category: value("category").trim(),
        price,
        image: value("image").trim(),
        available: value("available") === "true",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    message("#menuAdminStatus", "Changes live ho gaye.");
  } catch {
    message(
      "#menuAdminStatus",
      "Save nahi hua. Admin Rules check karein.",
      true,
    );
  }
}

$("#addFood").onclick = async () => {
  const id = `food-${Date.now()}`;
  try {
    await setDoc(doc(db, "menu", id), {
      name: "New Food Item",
      category: "New Category",
      price: 0,
      image: "",
      available: false,
      order: liveMenu.length + 1,
      updatedAt: serverTimestamp(),
    });
    message(
      "#menuAdminStatus",
      "New hidden item add hua. Edit karke Live karein.",
    );
  } catch {
    message(
      "#menuAdminStatus",
      "Item add nahi hua. Admin Rules check karein.",
      true,
    );
  }
};

$("#seedMenu").onclick = async () => {
  if (!confirm("Starter menu Firebase me load/update karna hai?")) return;
  try {
    const batch = writeBatch(db);
    starterMenu.forEach((item, index) => {
      const { id, ...data } = item;
      batch.set(
        doc(db, "menu", id),
        { ...data, order: index, updatedAt: serverTimestamp() },
        { merge: true },
      );
    });
    await batch.commit();
    message(
      "#menuAdminStatus",
      "Complete starter menu Firebase me load ho gaya.",
    );
  } catch {
    message(
      "#menuAdminStatus",
      "Menu load nahi hua. Admin Rules check karein.",
      true,
    );
  }
};

function safePreview(image, url) {
  image.src = url || "assets/cafe-logo.png";
}

function updatePreviews() {
  safePreview($("#heroPreview"), $("#heroImageUrl").value.trim());
  safePreview($("#logoPreview"), $("#logoImageUrl").value.trim());
  safePreview($("#qrPreview"), $("#paymentQrUrl").value.trim());
}

["heroImageUrl", "logoImageUrl", "paymentQrUrl"].forEach((id) => {
  $(`#${id}`).addEventListener("input", updatePreviews);
});

$("#saveBranding").onclick = async () => {
  try {
    await setDoc(
      doc(db, "settings", "public"),
      {
        heroImage: $("#heroImageUrl").value.trim(),
        logoImage: $("#logoImageUrl").value.trim(),
        paymentQr: $("#paymentQrUrl").value.trim(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    message("#brandingStatus", "Branding images live update ho gayi.");
  } catch {
    message(
      "#brandingStatus",
      "Save nahi hua. Admin Rules check karein.",
      true,
    );
  }
};
