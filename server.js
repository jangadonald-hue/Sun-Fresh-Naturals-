const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
// Serve static files from 'public' at both the root and '/public' prefix
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Helper to read DB
const readDB = () => {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = { inventory: {}, orders: [], products: [], reviews: [] };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        // Ensure all arrays exist
        if (!parsed.products) parsed.products = [];
        if (!parsed.reviews) parsed.reviews = [];
        return parsed;
    } catch (err) {
        console.error("Error reading DB:", err);
        return { inventory: {}, orders: [], products: [], reviews: [] };
    }
};

// Helper to write DB
const writeDB = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error("Error writing DB:", err);
    }
};

// Helper to map product names to inventory IDs
const nameToIdMap = {
    "extra pure solar-dried coconut oil": "coconut-oil",
    "moringa & botanical vitality powder": "moringa-vitality",
    "extra pure curry leaves powder": "curry-leaves",
    "solar-dried guava leaves powder": "guava-leaves",
    "neem-leaf vitality powder": "neem-powder",
    "neem leaf vitality powder": "neem-powder",
    "organic betel leaves powder": "betel-leaves",
    "organic mango powder": "mango-powder",
    "organic mint leaves & powder": "mint-powder",
    "organic mint powder": "mint-powder",
    "organic coriander powder": "coriander-powder",
    "organic sorrel leaves powder": "sorrel-powder",
    "pure amla powder": "amla-powder",
    "organic spinach leaves": "spinach-leaves",
    "pure tomato powder": "tomato-powder",
    "drumstick leaf powder": "drumstick-powder",
    "menthi / fenugreek leaves": "fenugreek-leaves"
};

const getProductIdByName = (name) => {
    if (!name) return null;
    const cleanName = name.split(' - ')[0].toLowerCase().trim();
    if (nameToIdMap[cleanName]) return nameToIdMap[cleanName];
    for (const [key, value] of Object.entries(nameToIdMap)) {
        if (cleanName.includes(key) || key.includes(cleanName)) {
            return value;
        }
    }
    return null;
};

const extractQuantity = (name) => {
    const match = name.match(/Pack of (\d+)/i);
    if (match) {
        return parseInt(match[1]) || 1;
    }
    return 1;
};

// --- API ROUTES ---

// Get all inventory
app.get('/api/inventory', (req, res) => {
    const db = readDB();
    res.json(db.inventory);
});

// Update stock
app.post('/api/inventory/update', (req, res) => {
    const { productId, newStock } = req.body;
    const db = readDB();
    if (db.inventory[productId]) {
        db.inventory[productId].stock = parseInt(newStock);
        writeDB(db);
        res.json({ success: true, message: 'Stock updated' });
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

// Update inventory threshold
app.post('/api/inventory/threshold', (req, res) => {
    const { productId, threshold } = req.body;
    const db = readDB();
    if (db.inventory[productId]) {
        db.inventory[productId].threshold = parseInt(threshold);
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

// --- ORDER MANAGEMENT ---

// Get all orders
app.get('/api/orders', (req, res) => {
    const db = readDB();
    res.json(db.orders || []);
});

// Update order status (pipeline)
app.post('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['received', 'confirmed', 'packed', 'out_for_delivery', 'delivered'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    const db = readDB();
    const order = (db.orders || []).find(o => o.id === id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.status = status;
    if (status === 'delivered') order.deliveredAt = new Date().toISOString();
    writeDB(db);
    res.json({ success: true, order });
});

// Create new order
app.post('/api/orders/create', (req, res) => {
    const orderData = req.body;
    if (!orderData) return res.status(400).json({ error: 'Order data required' });

    const db = readDB();
    const newOrder = {
        id: 'ORD-' + Date.now(),
        date: new Date().toISOString(),
        status: 'confirmed',
        ...orderData
    };

    // Automatically update stock levels
    if (orderData.items && Array.isArray(orderData.items)) {
        orderData.items.forEach(item => {
            if (item.id && db.inventory[item.id]) {
                const qty = parseInt(item.quantity) || 1;
                db.inventory[item.id].stock = Math.max(0, db.inventory[item.id].stock - qty);
            }
        });
    } else if (orderData.products) {
        // Fallback: Parse from comma-separated product names
        const productList = orderData.products.split(',').map(p => p.trim());
        productList.forEach(prod => {
            const id = getProductIdByName(prod);
            if (id && db.inventory[id]) {
                const qty = extractQuantity(prod);
                db.inventory[id].stock = Math.max(0, db.inventory[id].stock - qty);
            }
        });
    }

    db.orders = db.orders || [];
    db.orders.unshift(newOrder); // Newest first
    writeDB(db);

    res.json({ success: true, orderId: newOrder.id });
});

// Delete an order
app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const before = (db.orders || []).length;
    db.orders = (db.orders || []).filter(o => o.id !== id);
    if (db.orders.length === before) return res.status(404).json({ error: 'Order not found' });
    writeDB(db);
    res.json({ success: true });
});

// --- PRODUCT MANAGEMENT (Catalog) ---

// Get all products
app.get('/api/products', (req, res) => {
    const db = readDB();
    res.json(db.products || []);
});

// Add product
app.post('/api/products', (req, res) => {
    const { name, price, description, image, stock, threshold, category } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
    const db = readDB();
    const id = 'PROD-' + Date.now();
    const product = { id, name, price, description: description || '', image: image || '', stock: parseInt(stock) || 0, threshold: parseInt(threshold) || 5, category: category || 'General', createdAt: new Date().toISOString() };
    db.products = db.products || [];
    db.products.push(product);
    // Also add to inventory
    const invKey = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!db.inventory[invKey]) {
        db.inventory[invKey] = { stock: parseInt(stock) || 0, threshold: parseInt(threshold) || 5 };
    }
    writeDB(db);
    res.json({ success: true, product });
});

// Edit product
app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const db = readDB();
    const idx = (db.products || []).findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Product not found' });
    db.products[idx] = { ...db.products[idx], ...updates };
    writeDB(db);
    res.json({ success: true, product: db.products[idx] });
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const before = (db.products || []).length;
    db.products = (db.products || []).filter(p => p.id !== id);
    if (db.products.length === before) return res.status(404).json({ error: 'Product not found' });
    writeDB(db);
    res.json({ success: true });
});

// --- REVIEWS ---

// Get all reviews
app.get('/api/reviews', (req, res) => {
    const db = readDB();
    res.json(db.reviews || []);
});

// Add review (from main site)
app.post('/api/reviews', (req, res) => {
    const { name, product, rating, comment } = req.body;
    if (!name || !rating) return res.status(400).json({ error: 'Name and rating required' });
    const db = readDB();
    const review = { id: 'REV-' + Date.now(), name, product: product || '', rating: parseInt(rating), comment: comment || '', date: new Date().toISOString(), approved: false };
    db.reviews = db.reviews || [];
    db.reviews.unshift(review);
    writeDB(db);
    res.json({ success: true, review });
});

// Approve review
app.post('/api/reviews/:id/approve', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const review = (db.reviews || []).find(r => r.id === id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    review.approved = true;
    writeDB(db);
    res.json({ success: true });
});

// Delete review
app.delete('/api/reviews/:id', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const before = (db.reviews || []).length;
    db.reviews = (db.reviews || []).filter(r => r.id !== id);
    if (db.reviews.length === before) return res.status(404).json({ error: 'Review not found' });
    writeDB(db);
    res.json({ success: true });
});

// --- AUTH & OTP ---
let tempOTPs = {};
const ADMIN_MOBILE = "9542137161";
const ADMIN_EMAIL = "adminsfn@gmail.com";

app.post('/api/auth/send-otp', (req, res) => {
    const { mobile, email, isAdminLogin } = req.body;
    
    if (isAdminLogin) {
        const normalizedMobile = mobile ? mobile.replace(/\D/g, '').slice(-10) : "";
        if (normalizedMobile !== ADMIN_MOBILE || email !== ADMIN_EMAIL) {
            return res.status(403).json({ success: false, message: 'Unauthorized Admin Credentials' });
        }
    }

    if (!mobile) return res.status(400).json({ error: 'Mobile number required' });

    const isSequential = (str) => {
        const seq = "01234567890123456789";
        const revSeq = "98765432109876543210";
        return seq.includes(str) || revSeq.includes(str) || /^(\d)\1+$/.test(str);
    };

    let otp;
    do {
        otp = Math.floor(100000 + Math.random() * 900000).toString();
    } while (isSequential(otp));

    const normalizedMobile = mobile.replace(/\D/g, '').slice(-10);
    tempOTPs[normalizedMobile] = otp;

    console.log(`\x1b[33m[SMS GATEWAY]\x1b[0m Sending OTP ${otp} to +91 ${normalizedMobile}`);
    
    res.json({ success: true, message: 'OTP sent successfully', debugOtp: otp });
});

app.post('/api/auth/verify-otp', (req, res) => {
    const { mobile, otp, isAdminLogin } = req.body;
    const normalizedMobile = mobile ? mobile.replace(/\D/g, '').slice(-10) : "";
    
    if (tempOTPs[normalizedMobile] && tempOTPs[normalizedMobile] === otp) {
        delete tempOTPs[normalizedMobile];
        
        let response = { success: true, message: 'Verified' };
        if (isAdminLogin) {
            response.isAdmin = true;
            response.token = "ADMIN-SESSION-" + Date.now(); // Simple token for demo
        }
        
        res.json(response);
    } else {
        res.status(401).json({ success: false, message: 'Invalid OTP' });
    }
});

app.listen(PORT, () => {
    console.log(`\x1b[32m[SERVER RUNNING]\x1b[0m http://localhost:${PORT}`);
    console.log(`\x1b[36m[MAIN SITE]\x1b[0m     http://localhost:${PORT}/index.html`);
    console.log(`\x1b[35m[ADMIN PORTAL]\x1b[0m   http://localhost:${PORT}/admin.html`);
});
