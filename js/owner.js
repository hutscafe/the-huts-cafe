import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const TABLE_COUNT = 10;
const $ = (selector) => document.querySelector(selector);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let orders = [];
let activeTab = "orders";
let checkoutOrder = null;
let paymentMode = "Cash";
let ordersLoaded = false;
let audioContext = null;
let alertsEnabled = false;
let reportRange = "daily";
let unsubscribeOrders = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value?.toDate) return "Just now";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(value.toDate());
}

function updateClock() {
  $("#liveClock").textContent =
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "full",
      timeStyle: "medium",
    }).format(new Date()) + " · LIVE";
}

updateClock();
setInterval(updateClock, 1000);

// -------------------- INSTALLABLE OWNER APP --------------------

let installPrompt = null;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(console.warn);
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  $("#installApp").classList.add("install-ready");
});

window.addEventListener("appinstalled", () => {
  $("#installApp").textContent = "✓ App Installed";
  $("#installApp").disabled = true;
  installPrompt = null;
});

$("#installApp").onclick = async () => {
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    return;
  }

  alert(
    /iphone|ipad|ipod/i.test(navigator.userAgent)
      ? "Safari ka Share button dabayein, phir Add to Home Screen select karein."
      : "Chrome menu (⋮) kholkar Install app ya Add to Home screen select karein.",
  );
};

// -------------------- RESTRICTED OWNER LOGIN --------------------

$("#loginBtn").onclick = async () => {
  $("#loginError").textContent = "";

  try {
    await signInWithEmailAndPassword(
      auth,
      $("#ownerEmail").value.trim(),
      $("#ownerPassword").value,
    );
  } catch {
    $("#loginError").textContent = "Email ya password galat hai";
  }
};

$("#logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  $("#loginView").classList.toggle("hidden", Boolean(user));
  $("#dashboard").classList.toggle("hidden", !user);

  if (user) {
    startLiveOrders();
  } else {
    unsubscribeOrders?.();
    unsubscribeOrders = null;
  }
});

function startLiveOrders() {
  unsubscribeOrders?.();
  ordersLoaded = false;

  unsubscribeOrders = onSnapshot(
    query(collection(db, "orders"), orderBy("createdAt", "desc")),
    (snapshot) => {
      const newOrders = snapshot
        .docChanges()
        .filter(
          (change) =>
            change.type === "added" && change.doc.data().status === "New",
        );

      orders = snapshot.docs.map((orderDocument) => ({
        id: orderDocument.id,
        ...orderDocument.data(),
      }));

      render();

      if (ordersLoaded) {
        newOrders.forEach((change) => {
          notifyNewOrder({
            id: change.doc.id,
            ...change.doc.data(),
          });
        });
      }

      ordersLoaded = true;
    },
    () => {
      $("#panel").innerHTML =
        '<p class="panel-message">Orders load nahi hue. Internet ya login check karein.</p>';
    },
  );
}

// -------------------- ORDER ALERTS --------------------

$("#enableAlerts").onclick = async () => {
  try {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }

    audioContext =
      audioContext || new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    alertsEnabled = true;
    $("#enableAlerts").textContent = "🔔 Alerts ON";
    playOrderChime();
  } catch {
    $("#enableAlerts").textContent = "Alerts blocked";
  }
};

function playOrderChime() {
  if (!alertsEnabled || !audioContext) return;

  [880, 1175, 880].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime + index * 0.22;

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.28, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.2);
  });
}

function notifyNewOrder(order) {
  playOrderChime();
  document.title = `🔔 Table ${order.table} - New Order`;
  setTimeout(() => {
    document.title = "The Huts Order Operations";
  }, 8000);

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("The Huts Cafe - New Order", {
      body: `Table ${String(order.table).padStart(2, "0")} · ${order.items.reduce((sum, item) => sum + item.qty, 0)} item(s) · ₹${order.total}`,
      tag: `order-${order.id}`,
      renotify: true,
    });
  }
}

// -------------------- NAVIGATION --------------------

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.onclick = () => {
    activeTab = button.dataset.tab;

    document.querySelectorAll("[data-tab]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    $("#pageTitle").textContent = button.textContent
      .trim()
      .replace(/^[^ ]+ /, "");
    render();
  };
});

function render() {
  if (activeTab === "orders") renderOrders();
  if (activeTab === "tables") renderTables();
  if (activeTab === "reports") renderReports();
}

// -------------------- ORDERS --------------------

function renderOrders() {
  const activeOrders = orders.filter(
    (order) => !["Completed", "Cancelled"].includes(order.status),
  );
  const occupiedTables = new Set(activeOrders.map((order) => order.table)).size;
  const completedSales = orders
    .filter((order) => order.status === "Completed")
    .reduce((sum, order) => sum + order.total - (order.discount || 0), 0);

  const cards = activeOrders
    .map((order) => {
      const itemRows = order.items
        .map(
          (item) =>
            `<div><span>${item.qty}× ${escapeHtml(item.name)}</span><b>₹${item.qty * item.price}</b></div>`,
        )
        .join("");

      let primaryAction = "";
      if (order.status === "New") {
        primaryAction = `<button data-status="Preparing" data-id="${order.id}">Accept</button>`;
      } else if (order.status === "Preparing") {
        primaryAction = `<button data-status="Ready" data-id="${order.id}">Ready</button>`;
      } else {
        primaryAction = `<button data-checkout="${order.id}">Checkout</button>`;
      }

      return `
        <article class="order-card">
          <header>
            <b>TABLE ${String(order.table).padStart(2, "0")}</b>
            <em>${escapeHtml(order.status)}</em>
          </header>
          <small>${formatDate(order.createdAt)}</small>
          ${itemRows}
          ${order.note ? `<p>Note: ${escapeHtml(order.note)}</p>` : ""}
          <footer>
            <strong>₹${order.total}</strong>
            ${primaryAction}
            <button data-kot="${order.id}">KOT</button>
          </footer>
        </article>
      `;
    })
    .join("");

  $("#panel").innerHTML = `
    <div class="access-note">
      <b>Restricted Operations Access</b>
      <span>Menu, prices, QR settings and server controls are managed only by Vasuki NFC.</span>
    </div>
    <div class="stats">
      <article>Active<strong>${activeOrders.length}</strong></article>
      <article>Occupied<strong>${occupiedTables}/${TABLE_COUNT}</strong></article>
      <article>Sales<strong>₹${completedSales}</strong></article>
    </div>
    <div class="order-grid">${cards || "<p>No active orders</p>"}</div>
  `;
}

function renderTables() {
  const activeOrders = orders.filter(
    (order) => !["Completed", "Cancelled"].includes(order.status),
  );

  const tableCards = Array.from(
    { length: TABLE_COUNT },
    (_, index) => index + 1,
  )
    .map((tableNumber) => {
      const tableOrders = activeOrders.filter(
        (order) => order.table === tableNumber,
      );
      const tableTotal = tableOrders.reduce(
        (sum, order) => sum + order.total,
        0,
      );

      return `
        <article class="${tableOrders.length ? "busy" : ""}">
          <small>TABLE</small>
          <strong>${String(tableNumber).padStart(2, "0")}</strong>
          <span>${tableOrders.length ? `₹${tableTotal}` : "Available"}</span>
        </article>
      `;
    })
    .join("");

  $("#panel").innerHTML = `<div class="tables">${tableCards}</div>`;
}

// -------------------- REPORTS (READ-ONLY) --------------------

function orderDate(order) {
  return (
    order.completedAt?.toDate?.() || order.createdAt?.toDate?.() || new Date(0)
  );
}

function isInReportRange(order) {
  const date = orderDate(order);
  const now = new Date();
  const start = new Date(now);

  if (reportRange === "daily") {
    start.setHours(0, 0, 0, 0);
  }

  if (reportRange === "weekly") {
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
  }

  if (reportRange === "monthly") {
    start.setFullYear(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
  }

  return date >= start && date <= now;
}

function renderReports() {
  const reportOrders = orders.filter(
    (order) => order.status === "Completed" && isInReportRange(order),
  );
  const total = reportOrders.reduce(
    (sum, order) => sum + order.total - (order.discount || 0),
    0,
  );
  const cash = reportOrders
    .filter((order) => order.paymentMode === "Cash")
    .reduce((sum, order) => sum + order.total - (order.discount || 0), 0);
  const upi = reportOrders
    .filter((order) => order.paymentMode === "UPI")
    .reduce((sum, order) => sum + order.total - (order.discount || 0), 0);

  const now = new Date();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const dailySales = Array.from({ length: daysInMonth }, () => 0);

  reportOrders.forEach((order) => {
    const date = orderDate(order);
    if (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    ) {
      dailySales[date.getDate() - 1] += order.total - (order.discount || 0);
    }
  });

  const maximumSale = Math.max(1, ...dailySales);
  const graph =
    reportRange === "monthly"
      ? `
        <section class="sales-chart">
          <h3>Monthly Sales Graph</h3>
          <div class="chart-bars">
            ${dailySales
              .map(
                (value, index) => `
                  <div class="chart-day" title="${index + 1}: ₹${value}">
                    <span style="height:${Math.max(value ? 5 : 0, (value / maximumSale) * 100)}%"></span>
                    <small>${index % 5 === 0 || index === dailySales.length - 1 ? index + 1 : ""}</small>
                  </div>
                `,
              )
              .join("")}
          </div>
        </section>
      `
      : "";

  const billRows = reportOrders
    .map(
      (order) => `
        <div class="history-row report-row">
          <span>
            <b>${escapeHtml(order.memoNumber || `HUTS-${order.id.slice(-6).toUpperCase()}`)}</b>
            <small>Table ${order.table} · ${formatDate(order.completedAt || order.createdAt)}</small>
          </span>
          <b>₹${order.total - (order.discount || 0)}</b>
          <div><button data-bill="${order.id}">Bill</button></div>
        </div>
      `,
    )
    .join("");

  $("#panel").innerHTML = `
    <div class="report-toolbar">
      <div class="report-tabs">
        <button data-report-range="daily" class="${reportRange === "daily" ? "active" : ""}">Daily</button>
        <button data-report-range="weekly" class="${reportRange === "weekly" ? "active" : ""}">Weekly</button>
        <button data-report-range="monthly" class="${reportRange === "monthly" ? "active" : ""}">Monthly</button>
      </div>
      <span class="read-only-badge">Read-only reports</span>
    </div>
    <div class="stats">
      <article>Sales<strong>₹${total}</strong></article>
      <article>Cash<strong>₹${cash}</strong></article>
      <article>UPI<strong>₹${upi}</strong></article>
    </div>
    ${graph}
    <div class="report-list">
      ${billRows || "<p>No completed bills in this period.</p>"}
    </div>
  `;
}

// -------------------- RESTRICTED ACTIONS --------------------

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.reportRange) {
    reportRange = button.dataset.reportRange;
    renderReports();
    return;
  }

  if (button.dataset.status) {
    await updateDoc(doc(db, "orders", button.dataset.id), {
      status: button.dataset.status,
    });
  }

  if (button.dataset.checkout) {
    checkoutOrder = orders.find(
      (order) => order.id === button.dataset.checkout,
    );
    $("#checkoutTitle").textContent =
      `Table ${String(checkoutOrder.table).padStart(2, "0")}`;
    $("#discount").value = 0;
    updatePayable();
    $("#checkoutModal").classList.remove("hidden");
  }

  if (button.dataset.kot) {
    printReceipt(
      orders.find((order) => order.id === button.dataset.kot),
      "kot",
    );
  }

  if (button.dataset.bill) {
    printReceipt(
      orders.find((order) => order.id === button.dataset.bill),
      "bill",
    );
  }
});

// -------------------- CHECKOUT AND PRINTING --------------------

document.querySelectorAll("[data-pay]").forEach((button) => {
  button.onclick = () => {
    paymentMode = button.dataset.pay;
    document.querySelectorAll("[data-pay]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
  };
});

$("#discount").oninput = updatePayable;

function updatePayable() {
  if (!checkoutOrder) return;

  const discount = Number($("#discount").value || 0);
  $("#payable").textContent = `₹${Math.max(0, checkoutOrder.total - discount)}`;
}

$("[data-checkout-close]").onclick = () => {
  $("#checkoutModal").classList.add("hidden");
};

$("#completePayment").onclick = async () => {
  if (!checkoutOrder) return;

  const discount = Math.min(
    checkoutOrder.total,
    Math.max(0, Number($("#discount").value || 0)),
  );
  const now = new Date();
  const memoNumber =
    `HUTS-${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}-` +
    `${String(now.getHours()).padStart(2, "0")}` +
    `${String(now.getMinutes()).padStart(2, "0")}` +
    `${String(now.getSeconds()).padStart(2, "0")}-` +
    `${checkoutOrder.id.slice(-3).toUpperCase()}`;

  await updateDoc(doc(db, "orders", checkoutOrder.id), {
    status: "Completed",
    discount,
    paymentMode,
    memoNumber,
    completedAt: serverTimestamp(),
  });

  checkoutOrder = {
    ...checkoutOrder,
    status: "Completed",
    discount,
    paymentMode,
    memoNumber,
  };

  $("#checkoutModal").classList.add("hidden");
  printReceipt(checkoutOrder, "bill");
};

function printReceipt(order, mode) {
  if (!order) return;

  const memoNumber =
    order.memoNumber || `HUTS-${order.id.slice(-6).toUpperCase()}`;
  const lines = order.items
    .map(
      (item) => `
        <div>
          <span>${item.qty} x ${escapeHtml(item.name)}</span>
          ${mode === "bill" ? `<b>₹${item.qty * item.price}</b>` : ""}
        </div>
      `,
    )
    .join("");

  $("#receipt").innerHTML = `
    <h1>THE HUTS CAFE</h1>
    <p>${mode === "kot" ? "KITCHEN ORDER TICKET" : "BILL MEMO"}</p>
    ${mode === "bill" ? "<p>Near Murliwala Garden, Agra Road, Jaipur</p>" : ""}
    <hr>
    <div>
      <span>${mode === "kot" ? `KOT: ${order.id.slice(-6).toUpperCase()}` : `Memo No: ${memoNumber}`}</span>
      <b>Table ${order.table}</b>
    </div>
    <p>${formatDate(order.completedAt || order.createdAt)}</p>
    <hr>
    ${lines}
    ${order.note ? `<p><b>NOTE: ${escapeHtml(order.note)}</b></p>` : ""}
    ${
      mode === "bill"
        ? `
          <hr>
          <div><span>Subtotal</span><b>₹${order.total}</b></div>
          <div><span>Discount</span><b>-₹${order.discount || 0}</b></div>
          <div>
            <span>${order.paymentMode || ""}</span>
            <b>TOTAL ₹${order.total - (order.discount || 0)}</b>
          </div>
          <p>Thank you! Visit again.</p>
          <p class="receipt-brand">Smart Menu Technology by Vasuki NFC</p>
        `
        : ""
    }
  `;

  window.print();
}
