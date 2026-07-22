import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { starterMenu } from "./menu-data.js";
const $ = (s) => document.querySelector(s);
let db = null,
  menu = [...starterMenu],
  cart = {},
  category = "All";
const table = Math.min(
    25,
    Math.max(1, Number(new URLSearchParams(location.search).get("table")) || 1),
  ),
  repeatKey = `theHutsLastOrderTable${table}`;
$("#tableLabel").textContent = `Table ${String(table).padStart(2, "0")}`;
function lastOrder() {
  try {
    return JSON.parse(localStorage.getItem(repeatKey) || "null");
  } catch {
    return null;
  }
}
function renderRepeat() {
  const last = lastOrder();
  $("#repeatOrder").classList.toggle("hidden", !last?.items?.length);
}
const categoryIcons = {
  Coffee: "☕",
  Beverages: "🥤",
  Shakes: "🥛",
  Burgers: "🍔",
  "Sandwiches & Wraps": "🌯",
  Momos: "🥟",
  Pizza: "🍕",
  Pasta: "🍝",
  "Quick Bites": "🍟",
  Soups: "🥣",
  Desserts: "🍨",
};

const icon = (categoryName) => categoryIcons[categoryName] || "🍽️";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function foodImage(item) {
  const fallback = `<span class="food-fallback">${icon(item.category)}</span>`;
  if (!item.image) return fallback;

  return `<img
    src="${escapeHtml(item.image)}"
    alt="${escapeHtml(item.name)}"
    loading="lazy"
    referrerpolicy="no-referrer"
    onerror="this.hidden=true;this.nextElementSibling.hidden=false"
  ><span class="food-fallback" hidden>${icon(item.category)}</span>`;
}
function render() {
  const q = $("#search").value.toLowerCase(),
    cats = ["All", ...new Set(menu.map((i) => i.category))];
  $("#categories").innerHTML = cats
    .map(
      (c) =>
        `<button class="${c === category ? "active" : ""}" data-cat="${c}">${c}</button>`,
    )
    .join("");
  const shown = menu.filter(
    (i) =>
      i.available !== false &&
      (category === "All" || i.category === category) &&
      i.name.toLowerCase().includes(q),
  );
  $("#categoryTitle").textContent =
    category === "All" ? "Our favourites" : category;
  $("#itemCount").textContent = `${shown.length} items`;
  $("#menuGrid").innerHTML = shown
    .map(
      (i) =>
        `<article class="food-card"><div class="food-art">${foodImage(i)}${i.tag ? `<em>${escapeHtml(i.tag)}</em>` : ""}</div><div><small>▣ PURE VEG</small><h3>${escapeHtml(i.name)}</h3><p>Freshly prepared with our signature cafe flavours.</p><footer><strong>₹${i.price}</strong>${cart[i.id] ? `<div class="stepper"><button data-minus="${i.id}">−</button><b>${cart[i.id]}</b><button data-plus="${i.id}">+</button></div>` : `<button data-add="${i.id}">＋ ADD</button>`}</footer></div></article>`,
    )
    .join("");
  renderCartButton();
}
function renderCartButton() {
  const count = Object.values(cart).reduce((a, b) => a + b, 0),
    total = menu.reduce((s, i) => s + (cart[i.id] || 0) * i.price, 0);
  $("#viewCart").classList.toggle("hidden", !count);
  $("#viewCart").innerHTML =
    `<span>${count} item(s) · ₹${total}</span><b>View order →</b>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.cat) {
    category = b.dataset.cat;
    render();
  }
  for (const key of ["add", "plus", "minus"]) {
    if (b.dataset[key]) {
      const id = b.dataset[key];
      cart[id] = Math.max(0, (cart[id] || 0) + (key === "minus" ? -1 : 1));
      render();
    }
  }
  if (b.id === "viewCart") openCart();
  if (b.dataset.close !== undefined) $("#cartModal").classList.add("hidden");
});
$("#search").addEventListener("input", render);
$("#repeatOrder").onclick = () => {
  const last = lastOrder();
  if (!last?.items?.length) return;
  cart = {};
  last.items.forEach((i) => {
    if (menu.some((m) => m.id === i.id && m.available !== false))
      cart[i.id] = Math.max(1, Number(i.qty) || 1);
  });
  render();
  if (Object.keys(cart).length) openCart();
};
function openCart() {
  const rows = menu.filter((i) => cart[i.id]);
  $("#cartTable").textContent = `TABLE ${String(table).padStart(2, "0")}`;
  $("#cartLines").innerHTML = rows
    .map(
      (i) =>
        `<div class="cart-line"><span>${cart[i.id]}× ${i.name}</span><b>₹${cart[i.id] * i.price}</b></div>`,
    )
    .join("");
  const total = rows.reduce((s, i) => s + cart[i.id] * i.price, 0);
  $("#cartTotal").textContent = `₹${total}`;
  $("#placeOrder").disabled = false;
  $("#placeOrder").textContent = `Place order · ₹${total}`;
  $("#orderMessage").textContent = "";
  orderSending = false;
  $("#cartModal").classList.remove("hidden");
}
let orderSending = false;
$("#placeOrder").onclick = async () => {
  if (orderSending) return;
  const items = menu
      .filter((i) => cart[i.id])
      .map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        qty: cart[i.id],
      })),
    total = items.reduce((s, i) => s + i.price * i.qty, 0);
  if (!items.length) return;
  if (!db) {
    $("#orderMessage").textContent =
      "Live order connect nahi hai. Cafe owner se contact karein.";
    return;
  }
  orderSending = true;
  const orderBtn = $("#placeOrder");
  orderBtn.disabled = true;
  orderBtn.textContent = "Sending order…";
  $("#orderMessage").textContent = "Please wait, order send ho raha hai…";
  try {
    const placed = await addDoc(collection(db, "orders"), {
      table,
      items,
      total,
      note: $("#orderNote").value.trim(),
      status: "New",
      discount: 0,
      paymentMode: null,
      createdAt: serverTimestamp(),
    });
    localStorage.setItem(
      repeatKey,
      JSON.stringify({
        items: items.map((i) => ({ id: i.id, qty: i.qty })),
        savedAt: Date.now(),
      }),
    );
    cart = {};
    $("#orderNote").value = "";
    $("#orderMessage").textContent = "";
    $("#cartModal").classList.add("hidden");
    orderBtn.disabled = false;
    orderBtn.textContent = "Place order";
    orderSending = false;
    $("#successTable").textContent = `TABLE ${String(table).padStart(2, "0")}`;
    $("#successOrder").textContent =
      `Order #${placed.id.slice(-6).toUpperCase()}`;
    $("#successModal").classList.remove("hidden");
    render();
    renderRepeat();
  } catch (e) {
    $("#orderMessage").textContent =
      "Order send nahi hua. Internet check karke dobara try karein.";
    orderBtn.disabled = false;
    orderBtn.textContent = `Place order · ₹${total}`;
    orderSending = false;
  }
};
$("#doneOrder").onclick = () => {
  $("#successModal").classList.add("hidden");
  $("#placeOrder").disabled = false;
  orderSending = false;
};

// Food items ko Firebase setup se pehle bhi turant show karein.
render();
renderRepeat();
const firebaseReady =
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith("PASTE_") &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.startsWith("PASTE_");
if (firebaseReady) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    onSnapshot(
      collection(db, "menu"),
      (snap) => {
        const starterById = Object.fromEntries(
          starterMenu.map((item) => [item.id, item]),
        );
        const menuOrder = Object.fromEntries(
          starterMenu.map((item, index) => [item.id, index]),
        );
        menu = snap.empty
          ? [...starterMenu]
          : snap.docs
              .map((d) => {
                const liveItem = d.data();
                return {
                  id: d.id,
                  ...liveItem,
                  image: liveItem.image || starterById[d.id]?.image || "",
                };
              })
              .sort(
                (a, b) => (menuOrder[a.id] ?? 9999) - (menuOrder[b.id] ?? 9999),
              );
        render();
      },
      () => {
        menu = [...starterMenu];
        render();
      },
    );
  } catch (e) {
    console.warn("Firebase setup incomplete; starter menu is active.", e);
  }
}
