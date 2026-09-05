import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { INITIAL_STORES, INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_ORDERS, INITIAL_CASH_TRANSACTIONS, DEFAULT_ADMIN_SETTINGS, INITIAL_MOTOBOYS } from "./src/initialData";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Persistent storage file
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "cardapio_data.json");

interface AppData {
  stores: any[];
  categories: any[];
  products: any[];
  orders: any[];
  cashTransactions: any[];
  adminSettings: any;
  motoboys: any[];
}

function deduplicateOrders(orders: any[]): any[] {
  if (!Array.isArray(orders)) return [];
  const seenIds = new Set<string>();
  const seenStoreCodes = new Set<string>();
  const unique: any[] = [];

  for (const o of orders) {
    if (!o || !o.id) continue;
    const storeCodeKey = o.storeId && o.code ? `${o.storeId}_${o.code}` : null;
    if (seenIds.has(o.id)) continue;
    if (storeCodeKey && seenStoreCodes.has(storeCodeKey)) continue;

    seenIds.add(o.id);
    if (storeCodeKey) seenStoreCodes.add(storeCodeKey);
    unique.push(o);
  }
  return unique;
}

function loadData(): AppData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        stores: parsed.stores || INITIAL_STORES,
        categories: parsed.categories || INITIAL_CATEGORIES,
        products: parsed.products || INITIAL_PRODUCTS,
        orders: deduplicateOrders(parsed.orders || INITIAL_ORDERS),
        cashTransactions: parsed.cashTransactions || INITIAL_CASH_TRANSACTIONS,
        adminSettings: parsed.adminSettings || DEFAULT_ADMIN_SETTINGS,
        motoboys: parsed.motoboys || INITIAL_MOTOBOYS
      };
    }
  } catch (e) {
    console.error("Error reading data file, using defaults:", e);
  }

  const defaultData: AppData = {
    stores: INITIAL_STORES,
    categories: INITIAL_CATEGORIES,
    products: INITIAL_PRODUCTS,
    orders: deduplicateOrders(INITIAL_ORDERS),
    cashTransactions: INITIAL_CASH_TRANSACTIONS,
    adminSettings: DEFAULT_ADMIN_SETTINGS,
    motoboys: INITIAL_MOTOBOYS
  };

  saveData(defaultData);
  return defaultData;
}

function saveData(data: AppData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (data && Array.isArray(data.orders)) {
      data.orders = deduplicateOrders(data.orders);
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving data file:", e);
  }
}

let appData = loadData();

// SSE Clients for instant real-time push to all connected browsers/devices
interface SSEClient {
  id: number;
  res: express.Response;
}

let sseClients: SSEClient[] = [];
let nextClientId = 1;

function broadcastOrders(orders: any[], newOrder?: any) {
  const payload = JSON.stringify({
    type: "ORDERS_UPDATED",
    orders,
    newOrder,
    timestamp: Date.now()
  });

  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch (err) {
      // ignore dropped client
    }
  });
}

function broadcastData(data: AppData) {
  const payload = JSON.stringify({
    type: "DATA_UPDATED",
    stores: data.stores,
    categories: data.categories,
    products: data.products,
    adminSettings: data.adminSettings,
    motoboys: data.motoboys,
    orders: data.orders,
    timestamp: Date.now()
  });

  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch (err) {
      // ignore dropped client
    }
  });
}

// ---------------- API ROUTES ----------------

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// SSE Stream for instant sub-second order push
app.get("/api/orders/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const clientId = nextClientId++;
  const client: SSEClient = { id: clientId, res };
  sseClients.push(client);

  // Send current state immediately upon connecting
  res.write(`data: ${JSON.stringify({
    type: "INIT",
    orders: appData.orders,
    stores: appData.stores,
    categories: appData.categories,
    products: appData.products,
    adminSettings: appData.adminSettings,
    motoboys: appData.motoboys,
    timestamp: Date.now()
  })}\n\n`);

  req.on("close", () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// Periodic SSE Keep-Alive ping to prevent Cloud Run / Nginx reverse proxy timeouts
setInterval(() => {
  sseClients.forEach(client => {
    try {
      client.res.write(`: ping ${Date.now()}\n\n`);
    } catch (err) {}
  });
}, 15000);

// Get stores, categories and products
app.get("/api/stores", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.json({
    stores: appData.stores || [],
    categories: appData.categories || [],
    products: appData.products || [],
    timestamp: Date.now()
  });
});

// Dedicated registration endpoint for new store establishments
app.post("/api/stores/register", (req, res) => {
  const { newStore, defaultCategory, defaultProduct } = req.body;
  if (!newStore || !newStore.name || !newStore.slug) {
    return res.status(400).json({ error: "Dados do estabelecimento incompletos." });
  }

  // Reload current data from disk to ensure safety
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.stores)) appData.stores = parsed.stores;
      if (Array.isArray(parsed.categories)) appData.categories = parsed.categories;
      if (Array.isArray(parsed.products)) appData.products = parsed.products;
    }
  } catch (e) {}

  // Sanitize slug or generate from name
  let cleanSlug = (newStore.slug || newStore.name || '')
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!cleanSlug) {
    cleanSlug = `loja-${Date.now().toString().slice(-4)}`;
  }

  // Auto-resolve slug collision by appending number if already taken
  let finalSlug = cleanSlug;
  let slugIndex = 2;
  while (appData.stores.some(s => s.id !== newStore.id && s.slug && s.slug.toLowerCase() === finalSlug.toLowerCase())) {
    finalSlug = `${cleanSlug}-${slugIndex}`;
    slugIndex++;
  }

  // Auto-resolve ownerLogin collision
  let rawLogin = (newStore.ownerLogin || finalSlug.replace(/-/g, ''))
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
  if (!rawLogin) rawLogin = `user${Date.now().toString().slice(-4)}`;

  let finalLogin = rawLogin;
  let loginIndex = 2;
  while (appData.stores.some(s => s.id !== newStore.id && s.ownerLogin && s.ownerLogin.toLowerCase() === finalLogin.toLowerCase())) {
    finalLogin = `${rawLogin}${loginIndex}`;
    loginIndex++;
  }

  const cleanPhone = (newStore.phone || '').replace(/\D/g, '');
  const registeredStore = {
    ...newStore,
    id: newStore.id || `store-${Date.now()}`,
    slug: finalSlug,
    ownerLogin: finalLogin,
    phone: cleanPhone,
    isActive: true,
    isApproved: false, // Inicia como Pendente para o Administrador Geral liberar
    isBlocked: false,
    daysOnline: newStore.daysOnline || 30,
    planExpiresAt: newStore.planExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: newStore.createdAt || new Date().toISOString()
  };

  // Replace if exists with same id or append
  appData.stores = [...appData.stores.filter(s => s.id !== registeredStore.id), registeredStore];

  if (defaultCategory) {
    const catExists = appData.categories.some(c => c.id === defaultCategory.id);
    if (!catExists) {
      appData.categories = [...appData.categories, defaultCategory];
    }
  }

  if (defaultProduct) {
    const prodExists = appData.products.some(p => p.id === defaultProduct.id);
    if (!prodExists) {
      appData.products = [...appData.products, defaultProduct];
    }
  }

  saveData(appData);
  broadcastData(appData);

  // Broadcast specific NEW_STORE_REGISTERED event to all connected clients
  const newStoreMsg = JSON.stringify({
    type: "NEW_STORE_REGISTERED",
    store: registeredStore,
    stores: appData.stores,
    categories: appData.categories,
    products: appData.products,
    timestamp: Date.now()
  });
  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${newStoreMsg}\n\n`);
    } catch (e) {}
  });

  console.log(`[STORE REGISTERED] Novo estabelecimento cadastrado: ${registeredStore.name} (${registeredStore.slug})`);

  res.status(201).json({
    success: true,
    store: registeredStore,
    stores: appData.stores,
    categories: appData.categories,
    products: appData.products
  });
});

// Delete store endpoint (super admin deletes a store and all associated catalog)
app.delete("/api/stores/:id", (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "ID do estabelecimento não fornecido." });
  }

  const deletedStore = appData.stores.find(s => s.id === id || s.slug === id);
  appData.stores = appData.stores.filter(s => s.id !== id && s.slug !== id);
  appData.categories = appData.categories.filter(c => c.storeId !== id);
  appData.products = appData.products.filter(p => p.storeId !== id);

  saveData(appData);

  // Broadcast deletion to all SSE clients instantly
  const deleteMsg = JSON.stringify({
    type: "STORE_DELETED",
    storeId: id,
    storeSlug: deletedStore?.slug,
    stores: appData.stores,
    categories: appData.categories,
    products: appData.products,
    timestamp: Date.now()
  });

  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${deleteMsg}\n\n`);
    } catch (e) {}
  });

  broadcastData(appData);

  console.log(`[STORE DELETED] Estabelecimento ${id} (${deletedStore?.name || ''}) excluído com sucesso.`);
  res.json({
    success: true,
    storeId: id,
    stores: appData.stores,
    categories: appData.categories,
    products: appData.products
  });
});

// Approve store endpoint (liberar link do estabelecimento)
app.patch("/api/stores/:id/approve", (req, res) => {
  const { id } = req.params;
  let approvedStore: any = null;

  appData.stores = appData.stores.map(s => {
    if (s.id === id || s.slug === id) {
      approvedStore = {
        ...s,
        isApproved: true,
        isBlocked: false
      };
      return approvedStore;
    }
    return s;
  });

  if (!approvedStore) {
    return res.status(404).json({ error: "Estabelecimento não encontrado." });
  }

  saveData(appData);

  const approveMsg = JSON.stringify({
    type: "STORE_APPROVED",
    store: approvedStore,
    stores: appData.stores,
    timestamp: Date.now()
  });

  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${approveMsg}\n\n`);
    } catch (e) {}
  });

  broadcastData(appData);

  console.log(`[STORE APPROVED] Estabelecimento ${approvedStore.name} aprovado.`);
  res.json({ success: true, store: approvedStore, stores: appData.stores });
});

// Get orders
app.get("/api/orders", (req, res) => {
  res.json({ orders: appData.orders, timestamp: Date.now() });
});

// Post new order (from customer or test)
app.post("/api/orders", (req, res) => {
  const newOrder = req.body;
  if (!newOrder || !newOrder.id) {
    return res.status(400).json({ error: "Invalid order payload" });
  }

  // Prepend new order if not already in list (prevent any duplicates by ID or store+code)
  const exists = appData.orders.some(o => 
    o.id === newOrder.id || 
    (o.storeId && newOrder.storeId && o.storeId === newOrder.storeId && o.code && newOrder.code && o.code === newOrder.code)
  );

  if (!exists) {
    appData.orders = deduplicateOrders([newOrder, ...appData.orders]);
    saveData(appData);
    broadcastOrders(appData.orders, newOrder);
  }

  res.status(201).json({ success: true, order: newOrder, orders: appData.orders });
});

// Update order status or bulk orders
app.put("/api/orders", (req, res) => {
  const { orders } = req.body;
  if (Array.isArray(orders)) {
    appData.orders = deduplicateOrders(orders);
    saveData(appData);
    broadcastOrders(appData.orders);
    return res.json({ success: true, orders: appData.orders });
  }
  res.status(400).json({ error: "Invalid orders array" });
});

// Update single order status
app.patch("/api/orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status, cancellationReason } = req.body;

  let found = false;
  appData.orders = appData.orders.map(order => {
    if (order.id === id) {
      found = true;
      return {
        ...order,
        status: status || order.status,
        cancellationReason: cancellationReason !== undefined ? cancellationReason : order.cancellationReason
      };
    }
    return order;
  });

  if (found) {
    saveData(appData);
    broadcastOrders(appData.orders);
    res.json({ success: true, orders: appData.orders });
  } else {
    res.status(404).json({ error: "Order not found" });
  }
});

// Full database sync
app.get("/api/data", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.json(appData);
});

// Dedicated Admin Settings endpoint
app.get("/api/admin-settings", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.json(appData.adminSettings || DEFAULT_ADMIN_SETTINGS);
});

app.post("/api/admin-settings", (req, res) => {
  const { adminLogin, adminPass, superAdminWhatsapp } = req.body;
  let cleanPhone = (superAdminWhatsapp || '').replace(/\D/g, '');
  if (cleanPhone && !cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
    cleanPhone = '55' + cleanPhone;
  }

  appData.adminSettings = {
    adminLogin: adminLogin || appData.adminSettings?.adminLogin || 'admin',
    adminPass: adminPass || appData.adminSettings?.adminPass || 'admin',
    superAdminWhatsapp: cleanPhone || appData.adminSettings?.superAdminWhatsapp || '5594992944888'
  };

  saveData(appData);
  broadcastData(appData);
  res.json({ success: true, adminSettings: appData.adminSettings });
});

app.post("/api/data", (req, res) => {
  const { stores, categories, products, adminSettings, orders, cashTransactions, motoboys } = req.body;
  if (stores) appData.stores = stores;
  if (categories) appData.categories = categories;
  if (products) appData.products = products;
  if (adminSettings) {
    let cleanPhone = (adminSettings.superAdminWhatsapp || '').replace(/\D/g, '');
    if (cleanPhone && !cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
      cleanPhone = '55' + cleanPhone;
    }
    appData.adminSettings = {
      ...adminSettings,
      superAdminWhatsapp: cleanPhone || adminSettings.superAdminWhatsapp || '5594992944888'
    };
  }
  if (orders) appData.orders = deduplicateOrders(orders);
  if (cashTransactions) appData.cashTransactions = cashTransactions;
  if (motoboys) appData.motoboys = motoboys;

  saveData(appData);
  broadcastData(appData);
  res.json({ success: true, timestamp: Date.now() });
});

// ---------------- SOCIAL THUMBNAIL / OPEN GRAPH INJECTION ----------------

function getStoreForRequest(req: express.Request): any | null {
  const storeParam = (req.query.store as string) || '';
  const pathMatch = req.path.match(/^\/(?:loja|cardapio)\/([^/?#]+)/i);
  const targetSlug = storeParam || (pathMatch ? pathMatch[1] : null);

  if (targetSlug && appData && Array.isArray(appData.stores)) {
    const clean = decodeURIComponent(targetSlug).toLowerCase().trim();
    return appData.stores.find(s => 
      (s.slug && s.slug.toLowerCase() === clean) ||
      (s.id && s.id.toLowerCase() === clean)
    ) || null;
  }
  return null;
}

function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function injectStoreMetaTags(html: string, store: any): string {
  const storeName = escapeHtml(store.name || "Cardápio Digital");
  const storeDescription = escapeHtml(
    store.address 
      ? `${store.name} - ${store.address}. Faça seu pedido pelo nosso cardápio online com entrega rápida!` 
      : `${store.name} - Cardápio online e pedidos direto no WhatsApp!`
  );
  const logo = store.logoUrl || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80";

  let updated = html;

  // Replace default title
  updated = updated.replace(/<title>.*?<\/title>/gi, `<title>${storeName} - Cardápio Online</title>`);

  // Strip pre-existing generic open-graph tags
  updated = updated.replace(/<meta property="og:[^"]*" content="[^"]*"\s*\/?>/gi, '');
  updated = updated.replace(/<meta name="twitter:[^"]*" content="[^"]*"\s*\/?>/gi, '');

  const tagsToInject = `
    <!-- Dynamic Store Thumbnail & Open Graph Meta Tags -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${storeName} - Cardápio Online" />
    <meta property="og:description" content="${storeDescription}" />
    <meta property="og:image" content="${logo}" />
    <meta property="og:image:secure_url" content="${logo}" />
    <meta property="og:image:width" content="600" />
    <meta property="og:image:height" content="600" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${storeName} - Cardápio Online" />
    <meta name="twitter:description" content="${storeDescription}" />
    <meta name="twitter:image" content="${logo}" />
    <link rel="icon" type="image/png" href="${logo}" />
  `;

  if (updated.includes("</head>")) {
    updated = updated.replace("</head>", `${tagsToInject}\n  </head>`);
  }

  return updated;
}

// ---------------- VITE MIDDLEWARE / STATIC SERVING ----------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    // Custom middleware to intercept HTML requests and inject store thumbnail preview
    app.use(async (req, res, next) => {
      const isHtmlReq = (req.headers.accept && req.headers.accept.includes("text/html")) || req.path === '/' || req.path.startsWith('/loja');
      const store = getStoreForRequest(req);

      if (isHtmlReq && store) {
        try {
          const rawHtml = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf-8");
          const transformedHtml = await vite.transformIndexHtml(req.originalUrl, rawHtml);
          const finalHtml = injectStoreMetaTags(transformedHtml, store);
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.status(200).send(finalHtml);
        } catch (e) {
          next(e);
        }
      } else {
        vite.middlewares(req, res, next);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", (req, res) => {
      const store = getStoreForRequest(req);
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, "utf-8");
        if (store) {
          html = injectStoreMetaTags(html, store);
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(html);
      }
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Cardápio Web Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
