const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function createHash(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

class SupplyChainBlockchain {
  constructor() {
    this.products = new Map();
    this.chain = [this.createGenesisBlock()];
    this.seedDemoData();
  }

  createGenesisBlock() {
    const timestamp = new Date().toISOString();
    const payload = {
      index: 0,
      timestamp,
      previousHash: "0",
      type: "GENESIS",
      productId: "SYSTEM",
      data: { message: "Supply chain ledger initialized" }
    };

    return {
      ...payload,
      hash: this.calculateBlockHash(payload)
    };
  }

  calculateBlockHash(payload) {
    return createHash(JSON.stringify(payload));
  }

  addBlock(type, productId, data) {
    const previousBlock = this.chain[this.chain.length - 1];
    const payload = {
      index: this.chain.length,
      timestamp: new Date().toISOString(),
      previousHash: previousBlock.hash,
      type,
      productId,
      data
    };

    const block = {
      ...payload,
      hash: this.calculateBlockHash(payload)
    };

    this.chain.push(block);
    return block;
  }

  validateChain() {
    for (let index = 0; index < this.chain.length; index += 1) {
      const block = this.chain[index];
      const payload = {
        index: block.index,
        timestamp: block.timestamp,
        previousHash: block.previousHash,
        type: block.type,
        productId: block.productId,
        data: block.data
      };

      if (this.calculateBlockHash(payload) !== block.hash) {
        return false;
      }

      if (index === 0) {
        if (block.previousHash !== "0") {
          return false;
        }
        continue;
      }

      if (block.previousHash !== this.chain[index - 1].hash) {
        return false;
      }
    }

    return true;
  }

  ensureProduct(productId) {
    const product = this.products.get(productId);
    if (!product) {
      throw new Error("Mahsulot topilmadi");
    }
    return product;
  }

  registerProduct(input) {
    const productId = input.productId || `PRD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    if (this.products.has(productId)) {
      throw new Error("Bu productId allaqachon mavjud");
    }

    const now = new Date().toISOString();
    const authenticitySignature = createHash(
      `${productId}:${input.name}:${input.manufacturer}:${input.batchNumber}:${now}`
    );

    const product = {
      productId,
      name: input.name,
      description: input.description || "",
      manufacturer: input.manufacturer,
      batchNumber: input.batchNumber,
      currentOwner: input.manufacturer,
      currentLocation: input.originLocation,
      status: "Registered",
      authenticitySignature,
      createdAt: now,
      updatedAt: now,
      lastScanAt: now,
      history: [
        {
          timestamp: now,
          action: "REGISTERED",
          actor: input.manufacturer,
          from: null,
          to: input.manufacturer,
          location: input.originLocation,
          status: "Registered",
          note: input.description || "Mahsulot tizimga birinchi marta kiritildi"
        }
      ]
    };

    this.products.set(productId, product);
    this.addBlock("REGISTER_PRODUCT", productId, {
      name: product.name,
      manufacturer: product.manufacturer,
      batchNumber: product.batchNumber,
      owner: product.currentOwner,
      location: product.currentLocation,
      authenticitySignature
    });

    return product;
  }

  updateLocation(productId, input) {
    const product = this.ensureProduct(productId);
    const now = new Date().toISOString();

    product.currentLocation = input.location;
    product.lastScanAt = now;
    product.updatedAt = now;
    if (input.status) {
      product.status = input.status;
    }

    product.history.push({
      timestamp: now,
      action: "LOCATION_UPDATED",
      actor: input.actor || product.currentOwner,
      from: null,
      to: product.currentOwner,
      location: input.location,
      status: product.status,
      note: input.note || "Real vaqt kuzatuv nuqtasi yangilandi"
    });

    this.addBlock("UPDATE_LOCATION", productId, {
      actor: input.actor || product.currentOwner,
      location: input.location,
      status: product.status,
      note: input.note || ""
    });

    return product;
  }

  updateStatus(productId, input) {
    const product = this.ensureProduct(productId);
    const now = new Date().toISOString();

    product.status = input.status;
    product.updatedAt = now;

    product.history.push({
      timestamp: now,
      action: "STATUS_UPDATED",
      actor: input.actor || product.currentOwner,
      from: null,
      to: product.currentOwner,
      location: product.currentLocation,
      status: input.status,
      note: input.note || "Yetkazib berish holati yangilandi"
    });

    this.addBlock("UPDATE_STATUS", productId, {
      actor: input.actor || product.currentOwner,
      status: input.status,
      note: input.note || ""
    });

    return product;
  }

  transferOwnership(productId, input) {
    const product = this.ensureProduct(productId);
    const now = new Date().toISOString();
    const previousOwner = product.currentOwner;

    product.currentOwner = input.newOwner;
    product.updatedAt = now;
    if (input.location) {
      product.currentLocation = input.location;
    }
    if (input.status) {
      product.status = input.status;
    }

    product.history.push({
      timestamp: now,
      action: "OWNERSHIP_TRANSFERRED",
      actor: input.actor || previousOwner,
      from: previousOwner,
      to: input.newOwner,
      location: product.currentLocation,
      status: product.status,
      note: input.note || "Mahsulot egasi o'zgartirildi"
    });

    this.addBlock("TRANSFER_OWNERSHIP", productId, {
      actor: input.actor || previousOwner,
      previousOwner,
      newOwner: input.newOwner,
      location: product.currentLocation,
      status: product.status,
      note: input.note || ""
    });

    return product;
  }

  verifyAuthenticity(productId, signature) {
    const product = this.ensureProduct(productId);
    const relatedBlocks = this.chain.filter((block) => block.productId === productId);
    const areProductBlocksPresent = relatedBlocks.length > 0;
    const isChainValid = this.validateChain();

    const isSignatureValid = !signature || signature === product.authenticitySignature;

    return {
      productId,
      isAuthentic: areProductBlocksPresent && isChainValid && isSignatureValid,
      isChainValid,
      isSignatureValid,
      authenticitySignature: product.authenticitySignature,
      product
    };
  }

  getAuditReport(productId) {
    const product = this.ensureProduct(productId);
    const blocks = this.chain.filter((block) => block.productId === productId);
    const verification = this.verifyAuthenticity(productId);

    return {
      product,
      verification,
      blocks,
      checkpoints: product.history
    };
  }

  listProducts() {
    return Array.from(this.products.values()).sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  getChainSummary() {
    return {
      totalBlocks: this.chain.length,
      totalProducts: this.products.size,
      latestBlock: this.chain[this.chain.length - 1]
    };
  }

  seedDemoData() {
    const phone = this.registerProduct({
      productId: "PRD-PHONE-001",
      name: "Smart Sensor Phone X1",
      description: "Haroratga sezgir elektron mahsulot",
      manufacturer: "Andijon Devices Factory",
      batchNumber: "BATCH-EL-2026-01",
      originLocation: "Andijon, Uzbekistan"
    });

    this.updateLocation(phone.productId, {
      actor: "Andijon Devices Factory",
      location: "Toshkent Saralash Ombori",
      status: "In Transit",
      note: "Yuk mashinasiga yuklandi"
    });
    this.transferOwnership(phone.productId, {
      actor: "Andijon Devices Factory",
      newOwner: "Central Asia Distribution LLC",
      location: "Toshkent Saralash Ombori",
      status: "At Warehouse",
      note: "Distribyutorga topshirildi"
    });
    this.updateStatus(phone.productId, {
      actor: "Central Asia Distribution LLC",
      status: "Out for Delivery",
      note: "Retailer tomon jo'natildi"
    });
    this.transferOwnership(phone.productId, {
      actor: "Central Asia Distribution LLC",
      newOwner: "Retail Hub Tashkent",
      location: "Retail Hub Tashkent",
      status: "Delivered",
      note: "Sotuvchiga yetkazildi"
    });

    const food = this.registerProduct({
      productId: "PRD-FOOD-101",
      name: "Organic Olive Oil",
      description: "Premium eksport mahsuloti",
      manufacturer: "Samarkand Agro Export",
      batchNumber: "BATCH-FO-2026-14",
      originLocation: "Samarqand, Uzbekistan"
    });

    this.updateLocation(food.productId, {
      actor: "Samarkand Agro Export",
      location: "Jizzax Logistics Hub",
      status: "In Transit",
      note: "GPS scan orqali lokatsiya olindi"
    });
  }
}

const ledger = new SupplyChainBlockchain();

async function handleApi(req, res, url) {
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "Supply Chain Blockchain Logistics",
      time: new Date().toISOString()
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/dashboard") {
    sendJson(res, 200, {
      products: ledger.listProducts(),
      chain: ledger.getChainSummary()
    });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/products") {
    const body = await parseRequestBody(req);
    const required = ["name", "manufacturer", "batchNumber", "originLocation"];
    const missing = required.filter((field) => !body[field]);
    if (missing.length) {
      sendJson(res, 400, { error: `Majburiy maydonlar yetishmayapti: ${missing.join(", ")}` });
      return true;
    }

    const product = ledger.registerProduct(body);
    sendJson(res, 201, { message: "Mahsulot ro'yxatdan o'tdi", product });
    return true;
  }

  const locationMatch = pathname.match(/^\/api\/products\/([^/]+)\/location$/);
  if (req.method === "POST" && locationMatch) {
    const body = await parseRequestBody(req);
    if (!body.location) {
      sendJson(res, 400, { error: "location maydoni majburiy" });
      return true;
    }

    const product = ledger.updateLocation(locationMatch[1], body);
    sendJson(res, 200, { message: "Lokatsiya yangilandi", product });
    return true;
  }

  const statusMatch = pathname.match(/^\/api\/products\/([^/]+)\/status$/);
  if (req.method === "POST" && statusMatch) {
    const body = await parseRequestBody(req);
    if (!body.status) {
      sendJson(res, 400, { error: "status maydoni majburiy" });
      return true;
    }

    const product = ledger.updateStatus(statusMatch[1], body);
    sendJson(res, 200, { message: "Status yangilandi", product });
    return true;
  }

  const transferMatch = pathname.match(/^\/api\/products\/([^/]+)\/transfer$/);
  if (req.method === "POST" && transferMatch) {
    const body = await parseRequestBody(req);
    if (!body.newOwner) {
      sendJson(res, 400, { error: "newOwner maydoni majburiy" });
      return true;
    }

    const product = ledger.transferOwnership(transferMatch[1], body);
    sendJson(res, 200, { message: "Egalik o'tkazildi", product });
    return true;
  }

  const verifyMatch = pathname.match(/^\/api\/products\/([^/]+)\/verify$/);
  if (req.method === "POST" && verifyMatch) {
    const body = await parseRequestBody(req);
    const result = ledger.verifyAuthenticity(verifyMatch[1], body.signature);
    sendJson(res, 200, result);
    return true;
  }

  const auditMatch = pathname.match(/^\/api\/products\/([^/]+)\/audit$/);
  if (req.method === "GET" && auditMatch) {
    const report = ledger.getAuditReport(auditMatch[1]);
    sendJson(res, 200, report);
    return true;
  }

  const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (req.method === "GET" && productMatch) {
    const report = ledger.getAuditReport(productMatch[1]);
    sendJson(res, 200, report);
    return true;
  }

  return false;
}

function serveStaticFile(req, res, url) {
  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const resolvedPath = path.join(PUBLIC_DIR, filePath);

  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Access denied" });
    return;
  }

  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(res, 404, { error: "File topilmadi" });
        return;
      }
      sendJson(res, 500, { error: "Static file o'qishda xatolik" });
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const handled = await handleApi(req, res, url);
      if (handled) {
        return;
      }
      serveStaticFile(req, res, url);
    } catch (error) {
      const status = error.message === "Mahsulot topilmadi" ? 404 : 400;
      sendJson(res, status, { error: error.message || "Kutilmagan xatolik" });
    }
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Supply Chain Blockchain server running on http://localhost:${PORT}`);
  });
}

module.exports = {
  createServer,
  ledger
};
