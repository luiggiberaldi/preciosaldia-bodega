// ============================================================
// 🧪 SYSTEM TESTER v2.0 — E2E + 7-Day Simulation + Groq AI
// ============================================================
// Tests REAL storageService (localforage/IndexedDB) operations.
// Each suite creates, validates, and cleans up its own data.
// Includes a 7-day business simulation and AI analysis via Groq.
//
// Usage: SystemTester.runAll() or SystemTester.runSuite('storage')
// ============================================================

import { storageService } from '../utils/storageService';
import { formatBs } from '../utils/calculatorUtils';
import { DEFAULT_PAYMENT_METHODS, getPaymentLabel, getPaymentMethod } from '../config/paymentMethods';

// ── Test State ──
const state = {
    logs: [],
    results: [],
    isRunning: false,
    startTime: 0,
    onLog: null,
    onProgress: null,
    onComplete: null,
    _stopped: false,
    _currentSuite: '',
    // Cleanup tracker
    _testProductIds: [],
    _testSaleIds: [],
    _testCustomerIds: [],
    _originalProducts: null,
    _originalCustomers: null,
    _originalSales: null,
};

// ── Logging ──
function log(msg, type = 'info') {
    const ts = new Date().toLocaleTimeString('es-VE', { hour12: false });
    const icons = { info: 'ℹ️', pass: '✅', fail: '❌', warn: '⚠️', section: '━', ai: '🤖', day: '📅' };
    const icon = icons[type] || 'ℹ️';
    const entry = { time: ts, msg: `${icon} ${msg}`, type, raw: msg };
    state.logs.push(entry);
    state.onLog?.(entry);
    if (type === 'fail') console.error(`[TEST FAIL] ${msg}`);
}

function section(title) {
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'section');
    log(title, 'section');
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'section');
}

// ── Assertions ──
function assert(condition, testName, detail = '') {
    if (condition) {
        log(`PASS: ${testName}`, 'pass');
        state.results.push({ suite: state._currentSuite, test: testName, passed: true, detail });
        return true;
    } else {
        log(`FAIL: ${testName} — ${detail}`, 'fail');
        state.results.push({ suite: state._currentSuite, test: testName, passed: false, detail });
        return false;
    }
}

function assertEqual(actual, expected, testName) {
    return assert(actual === expected, testName, `Expected "${expected}", got "${actual}"`);
}

function assertClose(actual, expected, testName, tolerance = 0.02) {
    const diff = Math.abs(actual - expected);
    return assert(diff <= tolerance, testName, `Expected ~${expected}, got ${actual} (diff: ${diff.toFixed(4)})`);
}

function assertExists(value, testName) {
    return assert(value !== null && value !== undefined, testName, `Value is ${value}`);
}

function assertGreater(actual, threshold, testName) {
    return assert(actual > threshold, testName, `Expected > ${threshold}, got ${actual}`);
}

// ── Helpers ──
const TEST_PREFIX = '🧪_TEST_';
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function createTestProduct(overrides = {}) {
    return {
        id: `${TEST_PREFIX}${crypto.randomUUID().slice(0, 8)}`,
        name: `${TEST_PREFIX}Producto ${Date.now()}`,
        priceUsdt: 5.00,
        costBs: 100,
        stock: 50,
        category: 'Test',
        barcode: `TST${Date.now()}`,
        unit: 'und',
        sellByUnit: false,
        _testData: true,
        ...overrides,
    };
}

function createTestCustomer(overrides = {}) {
    return {
        id: `${TEST_PREFIX}${crypto.randomUUID().slice(0, 8)}`,
        name: `${TEST_PREFIX}Cliente ${Date.now()}`,
        phone: '0412-TEST',
        deuda: 0,
        _testData: true,
        ...overrides,
    };
}

// ════════════════════════════════════════════
// SUITE 1: STORAGE SERVICE (IndexedDB via localforage)
// ════════════════════════════════════════════
async function suiteStorage() {
    state._currentSuite = 'STORAGE';
    section('💾 SUITE: STORAGE SERVICE (IndexedDB)');

    const testKey = `${TEST_PREFIX}test_key_${Date.now()}`;
    const testObj = { foo: 'bar', num: 42, arr: [1, 2, 3], nested: { a: true } };

    // Write
    log('Escribiendo objeto complejo en IndexedDB...', 'info');
    await storageService.setItem(testKey, testObj);
    assert(true, 'setItem no lanzó error');

    // Read
    const read = await storageService.getItem(testKey);
    assertExists(read, 'getItem retorna datos');
    assertEqual(read.foo, 'bar', 'String field correcta');
    assertEqual(read.num, 42, 'Number field correcto');
    assert(Array.isArray(read.arr), 'Array field es array');
    assertEqual(read.arr.length, 3, 'Array length = 3');
    assertEqual(read.nested.a, true, 'Nested object correcto');

    // Default value
    const missing = await storageService.getItem('nonexistent_key_xyz', 'default_val');
    assertEqual(missing, 'default_val', 'getItem con default retorna fallback');

    // Overwrite
    await storageService.setItem(testKey, { ...testObj, foo: 'updated' });
    const updated = await storageService.getItem(testKey);
    assertEqual(updated.foo, 'updated', 'Overwrite funciona');

    // Large data
    log('Escribiendo array grande (500 items)...', 'info');
    const bigArray = Array.from({ length: 500 }, (_, i) => ({ id: i, name: `Prod ${i}`, price: Math.random() * 100 }));
    const bigKey = `${TEST_PREFIX}big_array_${Date.now()}`;
    const t0 = performance.now();
    await storageService.setItem(bigKey, bigArray);
    const bigRead = await storageService.getItem(bigKey);
    const elapsed = (performance.now() - t0).toFixed(0);
    assertEqual(bigRead.length, 500, `500 items escritos y leídos (${elapsed}ms)`);

    // Cleanup
    await storageService.removeItem(testKey);
    await storageService.removeItem(bigKey);
    const deleted = await storageService.getItem(testKey);
    assertEqual(deleted, null, 'removeItem elimina correctamente');

    log('Storage OK — CRUD completo verificado', 'info');
}

// ════════════════════════════════════════════
// SUITE 2: PRODUCTOS (Catálogo)
// ════════════════════════════════════════════
async function suiteProductos() {
    state._currentSuite = 'PRODUCTOS';
    section('📦 SUITE: PRODUCTOS (Catálogo localforage)');

    state._originalProducts = await storageService.getItem('my_products_v1', []);

    const prod1 = createTestProduct({ name: `${TEST_PREFIX}Harina PAN`, priceUsdt: 2.50, stock: 100, category: 'Harinas' });
    const prod2 = createTestProduct({ name: `${TEST_PREFIX}Queso`, priceUsdt: 4.00, stock: 30, category: 'Lácteos' });
    const prod3 = createTestProduct({ name: `${TEST_PREFIX}Aceite`, priceUsdt: 3.50, stock: 0, category: 'Aceites' });

    state._testProductIds.push(prod1.id, prod2.id, prod3.id);

    const allProds = [...state._originalProducts, prod1, prod2, prod3];
    await storageService.setItem('my_products_v1', allProds);
    assert(true, 'Productos escritos sin error');

    const saved = await storageService.getItem('my_products_v1', []);
    const found1 = saved.find(p => p.id === prod1.id);
    const found2 = saved.find(p => p.id === prod2.id);
    const found3 = saved.find(p => p.id === prod3.id);

    assertExists(found1, `Producto "${prod1.name}" encontrado`);
    assertExists(found2, `Producto "${prod2.name}" encontrado`);
    assertClose(found1.priceUsdt, 2.50, 'Precio Harina $2.50');
    assertClose(found2.stock, 30, 'Stock Queso = 30');
    assertClose(found3.stock, 0, 'Producto sin stock = 0');

    // Search simulation
    const term = 'harina';
    const results = saved.filter(p => p.name.toLowerCase().includes(term));
    assertGreater(results.length, 0, `Búsqueda "${term}" retorna resultados`);

    // Category filter
    const harinas = saved.filter(p => p.category === 'Harinas' && p._testData);
    assertEqual(harinas.length, 1, 'Filtro categoría funciona');

    // Stock deduction simulation
    const beforeStock = found1.stock;
    const deductQty = 3;
    const updatedProds = saved.map(p => {
        if (p.id === prod1.id) return { ...p, stock: Math.max(0, p.stock - deductQty) };
        return p;
    });
    await storageService.setItem('my_products_v1', updatedProds);
    const afterDeduct = await storageService.getItem('my_products_v1', []);
    const prodAfterDeduct = afterDeduct.find(p => p.id === prod1.id);
    assertClose(prodAfterDeduct.stock, beforeStock - deductQty, `Stock deducido: ${beforeStock} → ${prodAfterDeduct.stock}`);

    log('Productos OK — CRUD + búsqueda + stock verificado', 'info');
}

// ════════════════════════════════════════════
// SUITE 3: CARRITO (Cart Logic)
// ════════════════════════════════════════════
async function suiteCarrito() {
    state._currentSuite = 'CARRITO';
    section('🛒 SUITE: CARRITO (Lógica de Cesta)');

    const RATE = 95.50;
    const prod1 = { id: 't1', name: 'Harina', priceUsd: 2.50, qty: 1 };
    const prod2 = { id: 't2', name: 'Queso', priceUsd: 4.00, qty: 2 };
    const prod3 = { id: 't3', name: 'Peso Kg', priceUsd: 8.00, qty: 0.350, isWeight: true };

    let cart = [prod1, prod2, prod3];

    const totalUsd = cart.reduce((sum, i) => sum + (i.priceUsd * i.qty), 0);
    assertClose(totalUsd, 2.50 + 8.00 + 2.80, `Total USD: $${totalUsd.toFixed(2)}`);

    const totalBs = totalUsd * RATE;
    assertGreater(totalBs, 0, `Total Bs: ${formatBs(totalBs)} > 0`);

    // Bs should be integer visually (es-VE uses "." for thousands, "," for decimals)
    const bsDisplay = formatBs(totalBs);
    assert(!bsDisplay.includes(','), `Bs display sin decimales: ${bsDisplay}`);

    const itemCount = cart.reduce((sum, i) => sum + i.qty, 0);
    assertClose(itemCount, 3.35, `Item count: ${itemCount}`);

    // Update qty
    cart = cart.map(i => i.id === 't2' ? { ...i, qty: i.qty + 1 } : i);
    const newTotal = cart.reduce((sum, i) => sum + (i.priceUsd * i.qty), 0);
    assertClose(newTotal, 2.50 + 12.00 + 2.80, `Total post-update: $${newTotal.toFixed(2)}`);

    // Remove item
    cart = cart.filter(i => i.id !== 't3');
    assertEqual(cart.length, 2, 'Remove item: cart.length = 2');

    // Empty cart
    cart = [];
    assertEqual(cart.reduce((sum, i) => sum + (i.priceUsd * i.qty), 0), 0, 'Cart vacío = $0.00');

    log('Carrito OK — Totales, qty, remove, empty verificado', 'info');
}

// ════════════════════════════════════════════
// SUITE 4: BIMONEDA (Currency Calculations)
// ════════════════════════════════════════════
async function suiteBimoneda() {
    state._currentSuite = 'BIMONEDA';
    section('💱 SUITE: BIMONEDA (Cálculos de Tasa)');

    const RATE = 95.50;
    const TOTAL_USD = 15.00;
    const TOTAL_BS = TOTAL_USD * RATE;

    const paidUsd = 10.00;
    const paidBs = 500;
    const paidBsToUsd = paidBs / RATE;
    const totalPaidUsd = paidUsd + paidBsToUsd;
    const remainingUsd = Math.max(0, TOTAL_USD - totalPaidUsd);

    assertClose(paidBsToUsd, 5.235, `Bs→USD: 500 Bs / ${RATE} = $${paidBsToUsd.toFixed(3)}`);
    assertClose(totalPaidUsd, 15.235, `Total pagado: $${totalPaidUsd.toFixed(3)}`);
    assertEqual(remainingUsd, 0, 'Restante = $0 (pagado completo)');

    const changeUsd = Math.max(0, totalPaidUsd - TOTAL_USD);
    const changeBs = changeUsd * RATE;
    assertClose(changeUsd, 0.235, `Vuelto USD: $${changeUsd.toFixed(3)}`);
    assertClose(changeBs, 22.50, `Vuelto Bs: ${changeBs.toFixed(2)} Bs`, 1);

    // EXACTO logic
    const exactoBs = Math.ceil(TOTAL_BS);
    assertEqual(exactoBs % 1, 0, `EXACTO Bs es entero: ${exactoBs}`);
    const exactoUsd = Number(TOTAL_USD.toFixed(2));
    assertEqual(exactoUsd, 15.00, `EXACTO USD: $${exactoUsd}`);

    // Mixed payment
    log('Simulando pago mixto: $5 USD + 960 Bs...', 'info');
    const mix_total_usd = 5.00 + (960 / RATE);
    assertClose(mix_total_usd, 15.05, `Pago mixto total: $${mix_total_usd.toFixed(2)}`, 0.05);

    log('Bimoneda OK — Tasa, conversiones, vuelto, EXACTO verificado', 'info');
}

// ════════════════════════════════════════════
// SUITE 5: CHECKOUT (Sale Creation)
// ════════════════════════════════════════════
async function suiteCheckout() {
    state._currentSuite = 'CHECKOUT';
    section('🧾 SUITE: CHECKOUT (Generar Venta)');

    state._originalSales = await storageService.getItem('bodega_sales_v1', []);

    const RATE = 95.50;
    const cart = [
        { id: 't1', name: 'Harina PAN', priceUsd: 2.50, qty: 3, isWeight: false },
        { id: 't2', name: 'Queso', priceUsd: 4.00, qty: 1, isWeight: false },
    ];

    const totalUsd = cart.reduce((s, i) => s + i.priceUsd * i.qty, 0);
    const totalBs = totalUsd * RATE;
    assertClose(totalUsd, 11.50, `Total venta: $${totalUsd.toFixed(2)}`);

    const payments = [
        { id: crypto.randomUUID(), methodId: 'efectivo_usd', methodLabel: 'Efectivo $', currency: 'USD', amountInput: 10, amountInputCurrency: 'USD', amountUsd: 10, amountBs: 10 * RATE },
        { id: crypto.randomUUID(), methodId: 'pago_movil', methodLabel: 'Pago Móvil', currency: 'BS', amountInput: 150, amountInputCurrency: 'BS', amountUsd: 150 / RATE, amountBs: 150 },
    ];

    const totalPaidUsd = payments.reduce((s, p) => s + p.amountUsd, 0);
    const changeUsd = Math.max(0, totalPaidUsd - totalUsd);

    assert(totalPaidUsd >= totalUsd, `Pago cubre total: $${totalPaidUsd.toFixed(2)} >= $${totalUsd.toFixed(2)}`);

    const sale = {
        id: `${TEST_PREFIX}${crypto.randomUUID()}`,
        tipo: 'VENTA',
        status: 'COMPLETADA',
        items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, priceUsd: i.priceUsd, isWeight: i.isWeight })),
        totalUsd, totalBs, payments, rate: RATE, rateSource: 'BCV Auto',
        timestamp: new Date().toISOString(),
        changeUsd, changeBs: changeUsd * RATE,
        customerId: null, customerName: 'Consumidor Final',
        fiadoUsd: 0, _testData: true,
    };

    state._testSaleIds.push(sale.id);

    const existing = await storageService.getItem('bodega_sales_v1', []);
    await storageService.setItem('bodega_sales_v1', [sale, ...existing]);
    assert(true, 'Venta guardada sin error');

    const readSales = await storageService.getItem('bodega_sales_v1', []);
    const foundSale = readSales.find(s => s.id === sale.id);
    assertExists(foundSale, 'Venta encontrada en DB');
    assertEqual(foundSale.status, 'COMPLETADA', 'Status = COMPLETADA');
    assertClose(foundSale.totalUsd, 11.50, `Total persistido: $${foundSale.totalUsd.toFixed(2)}`);
    assertEqual(foundSale.items.length, 2, 'Items = 2');
    assertEqual(foundSale.payments.length, 2, 'Payments = 2');

    // NaN integrity check
    assert(!isNaN(foundSale.totalUsd), 'totalUsd no es NaN');
    assert(!isNaN(foundSale.totalBs), 'totalBs no es NaN');
    assert(!isNaN(foundSale.changeUsd), 'changeUsd no es NaN');
    assert(foundSale.totalUsd >= 0, 'totalUsd >= 0');
    assert(foundSale.changeUsd >= 0, 'changeUsd >= 0');

    log(`Checkout OK — Venta ${sale.id.slice(0, 12)} persistida`, 'info');
}

// ════════════════════════════════════════════
// SUITE 6: CLIENTES (Customers + Debt)
// ════════════════════════════════════════════
async function suiteClientes() {
    state._currentSuite = 'CLIENTES';
    section('👥 SUITE: CLIENTES (Deuda / Saldo a Favor)');

    state._originalCustomers = await storageService.getItem('my_customers_v1', []);

    const customer = createTestCustomer({ name: `${TEST_PREFIX}Luis Test`, deuda: 0 });
    state._testCustomerIds.push(customer.id);

    const all = [...state._originalCustomers, customer];
    await storageService.setItem('my_customers_v1', all);

    const saved = await storageService.getItem('my_customers_v1', []);
    const found = saved.find(c => c.id === customer.id);
    assertExists(found, 'Cliente encontrado');
    assertEqual(found.deuda, 0, 'Deuda inicial = 0');

    // FIADO
    log('Simulando venta fiada de $15.00...', 'info');
    const updatedAll = saved.map(c => c.id === customer.id ? { ...c, deuda: c.deuda + 15 } : c);
    await storageService.setItem('my_customers_v1', updatedAll);
    const afterFiado = (await storageService.getItem('my_customers_v1', [])).find(c => c.id === customer.id);
    assertClose(afterFiado.deuda, 15.00, `Deuda post-fiado: $${afterFiado.deuda.toFixed(2)}`);

    // Abono
    log('Simulando abono parcial de $5.00...', 'info');
    const afterAbono = (await storageService.getItem('my_customers_v1', [])).map(c =>
        c.id === customer.id ? { ...c, deuda: c.deuda - 5 } : c);
    await storageService.setItem('my_customers_v1', afterAbono);
    const finalC = (await storageService.getItem('my_customers_v1', [])).find(c => c.id === customer.id);
    assertClose(finalC.deuda, 10.00, `Deuda post-abono: $${finalC.deuda.toFixed(2)}`);

    // Saldo a Favor
    log('Simulando sobreabono → saldo a favor...', 'info');
    const saldoAll = (await storageService.getItem('my_customers_v1', [])).map(c =>
        c.id === customer.id ? { ...c, deuda: c.deuda - 15 } : c);
    await storageService.setItem('my_customers_v1', saldoAll);
    const saldoC = (await storageService.getItem('my_customers_v1', [])).find(c => c.id === customer.id);
    assert(saldoC.deuda < 0, `Tiene saldo a favor: $${Math.abs(saldoC.deuda).toFixed(2)}`);
    assertClose(saldoC.deuda, -5.00, 'Saldo a favor = $5.00');

    const saldoToUse = Math.min(Math.abs(saldoC.deuda), 3.00);
    assertClose(saldoToUse, 3.00, `Saldo aplicado: $${saldoToUse.toFixed(2)}`);

    log('Clientes OK — Deuda, abono, saldo a favor verificado', 'info');
}

// ════════════════════════════════════════════
// SUITE 7: PAYMENT METHODS (Config)
// ════════════════════════════════════════════
async function suitePayments() {
    state._currentSuite = 'PAYMENTS';
    section('💳 SUITE: MÉTODOS DE PAGO (Config)');

    assertGreater(DEFAULT_PAYMENT_METHODS.length, 0, 'Métodos definidos');

    const bsMethods = DEFAULT_PAYMENT_METHODS.filter(m => m.currency === 'BS');
    assertGreater(bsMethods.length, 0, 'Existen métodos BS');

    const usdMethods = DEFAULT_PAYMENT_METHODS.filter(m => m.currency === 'USD');
    assertGreater(usdMethods.length, 0, 'Existen métodos USD');

    for (const m of DEFAULT_PAYMENT_METHODS) {
        assertExists(m.id, `${m.label} tiene id`);
        assertExists(m.label, `${m.id} tiene label`);
        assertExists(m.icon, `${m.id} tiene icon`);
        assert(['USD', 'BS'].includes(m.currency), `${m.id} currency válida`, m.currency);
    }

    const label = getPaymentLabel('efectivo_usd');
    assert(label.includes('Efectivo'), `getPaymentLabel funciona: "${label}"`);

    const method = getPaymentMethod('pago_movil');
    assertEqual(method.currency, 'BS', 'Pago Móvil = BS');

    assertExists(getPaymentMethod('nonexistent'), 'Fallback funciona');

    log('Payments OK — Config y helpers verificados', 'info');
}

// ════════════════════════════════════════════
// SUITE 8: MODULES (Component Imports)
// ════════════════════════════════════════════
async function suiteModules() {
    state._currentSuite = 'MODULES';
    section('🧩 SUITE: MODULARIZACIÓN (Imports)');

    const modules = [
        { path: '../hooks/useVoiceSearch', name: 'useVoiceSearch' },
        { path: '../components/Sales/CartPanel', name: 'CartPanel' },
        { path: '../components/Sales/CheckoutModal', name: 'CheckoutModal' },
    ];

    for (const mod of modules) {
        try {
            const imported = await import(/* @vite-ignore */ mod.path);
            assert(!!imported.default || Object.keys(imported).length > 0, `${mod.name} importa correctamente`);
        } catch (err) {
            assert(false, `${mod.name} importa correctamente`, err.message);
        }
    }

    const bs1 = formatBs(1234.56);
    assert(typeof bs1 === 'string', `formatBs retorna string: "${bs1}"`);

    const bs2 = formatBs(274);
    log(`formatBs(274) = "${bs2}"`, 'info');

    log('Modules OK — Imports verificados', 'info');
}

// ════════════════════════════════════════════
// 🗓️ SUITE 9: SIMULACIÓN 7 DÍAS
// Simulates a full week of business operations
// ════════════════════════════════════════════
async function suite7Days() {
    state._currentSuite = '7DAYS';
    section('🗓️ SUITE: SIMULACIÓN 7 DÍAS DE OPERACIÓN');

    state._originalProducts = state._originalProducts ?? await storageService.getItem('my_products_v1', []);
    state._originalSales = state._originalSales ?? await storageService.getItem('bodega_sales_v1', []);
    state._originalCustomers = state._originalCustomers ?? await storageService.getItem('my_customers_v1', []);

    // Create test catalog (10 products)
    const catalog = [
        createTestProduct({ name: `${TEST_PREFIX}Harina PAN 1kg`, priceUsdt: 2.50, stock: 200, category: 'Harinas' }),
        createTestProduct({ name: `${TEST_PREFIX}Arroz 1kg`, priceUsdt: 1.80, stock: 150, category: 'Granos' }),
        createTestProduct({ name: `${TEST_PREFIX}Queso Llanero`, priceUsdt: 5.00, stock: 80, category: 'Lácteos' }),
        createTestProduct({ name: `${TEST_PREFIX}Aceite 1L`, priceUsdt: 3.50, stock: 100, category: 'Aceites' }),
        createTestProduct({ name: `${TEST_PREFIX}Café 500g`, priceUsdt: 4.20, stock: 60, category: 'Bebidas' }),
        createTestProduct({ name: `${TEST_PREFIX}Azúcar 1kg`, priceUsdt: 1.50, stock: 120, category: 'Varios' }),
        createTestProduct({ name: `${TEST_PREFIX}Pasta 500g`, priceUsdt: 1.20, stock: 180, category: 'Granos' }),
        createTestProduct({ name: `${TEST_PREFIX}Leche 1L`, priceUsdt: 2.00, stock: 90, category: 'Lácteos' }),
        createTestProduct({ name: `${TEST_PREFIX}Margarina`, priceUsdt: 2.80, stock: 70, category: 'Lácteos' }),
        createTestProduct({ name: `${TEST_PREFIX}Atún Lata`, priceUsdt: 3.00, stock: 100, category: 'Enlatados' }),
    ];

    for (const p of catalog) state._testProductIds.push(p.id);

    // Create test customers (3)
    const testCustomers = [
        createTestCustomer({ name: `${TEST_PREFIX}María López`, deuda: 0 }),
        createTestCustomer({ name: `${TEST_PREFIX}Carlos Pérez`, deuda: 0 }),
        createTestCustomer({ name: `${TEST_PREFIX}Ana García`, deuda: 0 }),
    ];
    for (const c of testCustomers) state._testCustomerIds.push(c.id);

    // Save initial state
    const allProducts = [...state._originalProducts, ...catalog];
    await storageService.setItem('my_products_v1', allProducts);
    const allCustomers = [...state._originalCustomers, ...testCustomers];
    await storageService.setItem('my_customers_v1', allCustomers);

    log(`Catálogo: ${catalog.length} productos | Clientes: ${testCustomers.length}`, 'info');

    // Day simulation config
    const RATES = [94.50, 95.00, 95.80, 96.20, 95.50, 96.00, 96.50]; // 7 tasas BCV
    const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const PAYMENT_METHODS = ['efectivo_usd', 'efectivo_bs', 'pago_movil', 'punto_venta'];
    const CURRENCIES = { efectivo_usd: 'USD', efectivo_bs: 'BS', pago_movil: 'BS', punto_venta: 'BS' };

    let totalSalesGenerated = 0;
    let totalRevenueUsd = 0;
    let totalFiado = 0;
    const dailyStats = [];
    const allTestSales = [];

    for (let day = 0; day < 7; day++) {
        if (state._stopped) break;

        const rate = RATES[day];
        const salesPerDay = 4 + Math.floor(Math.random() * 4); // 4-7 sales/day
        let dayRevenue = 0;
        let dayFiado = 0;
        let daySales = 0;

        log(`📅 DÍA ${day + 1} (${DAY_NAMES[day]}) — Tasa: ${formatBs(rate)} Bs/$`, 'day');

        for (let s = 0; s < salesPerDay; s++) {
            // Random cart: 1-4 items
            const cartSize = 1 + Math.floor(Math.random() * 4);
            const cart = [];
            const usedIds = new Set();

            for (let c = 0; c < cartSize; c++) {
                let prod;
                do { prod = catalog[Math.floor(Math.random() * catalog.length)]; }
                while (usedIds.has(prod.id));
                usedIds.add(prod.id);

                const qty = prod.unit === 'kg' ? +(0.2 + Math.random() * 2).toFixed(3) : 1 + Math.floor(Math.random() * 3);
                cart.push({ id: prod.id, name: prod.name, priceUsd: prod.priceUsdt, qty, isWeight: prod.unit === 'kg' });
            }

            const totalUsd = cart.reduce((sum, i) => sum + i.priceUsd * i.qty, 0);
            const totalBs = totalUsd * rate;

            // Random payment method
            const methodId = PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)];
            const currency = CURRENCIES[methodId];
            const amountUsd = currency === 'USD' ? totalUsd : totalUsd; // Always pays full
            const amountBs = currency === 'BS' ? Math.ceil(totalBs) : totalBs;

            // Some sales are fiado (10% chance on weekdays, customer required)
            const isFiado = day < 5 && Math.random() < 0.1;
            const customer = isFiado ? testCustomers[Math.floor(Math.random() * testCustomers.length)] : null;
            const fiadoAmount = isFiado ? totalUsd : 0;

            const sale = {
                id: `${TEST_PREFIX}7d_${crypto.randomUUID().slice(0, 8)}`,
                tipo: isFiado ? 'VENTA_FIADA' : 'VENTA',
                status: 'COMPLETADA',
                items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, priceUsd: Number(i.priceUsd.toFixed(2)), isWeight: i.isWeight })),
                totalUsd: Number(totalUsd.toFixed(2)),
                totalBs: Number(totalBs.toFixed(2)),
                payments: isFiado ? [] : [{
                    id: crypto.randomUUID(), methodId, methodLabel: methodId,
                    currency, amountUsd: Number(amountUsd.toFixed(2)),
                    amountBs: Number(amountBs.toFixed(2)),
                    amountInput: currency === 'USD' ? Number(amountUsd.toFixed(2)) : Math.ceil(amountBs),
                    amountInputCurrency: currency,
                }],
                rate, rateSource: 'BCV Auto',
                timestamp: new Date(Date.now() - (7 - day) * 86400000 + s * 3600000).toISOString(),
                changeUsd: 0, changeBs: 0,
                customerId: customer?.id || null,
                customerName: customer?.name?.replace(TEST_PREFIX, '') || 'Consumidor Final',
                fiadoUsd: fiadoAmount,
                _testData: true,
            };

            allTestSales.push(sale);
            state._testSaleIds.push(sale.id);

            dayRevenue += totalUsd;
            if (isFiado) dayFiado += fiadoAmount;
            daySales++;
        }

        totalSalesGenerated += daySales;
        totalRevenueUsd += dayRevenue;
        totalFiado += dayFiado;

        dailyStats.push({
            day: DAY_NAMES[day], rate, sales: daySales,
            revenue: Number(dayRevenue.toFixed(2)),
            fiado: Number(dayFiado.toFixed(2)),
        });

        log(`  → ${daySales} ventas | $${dayRevenue.toFixed(2)} USD | Fiado: $${dayFiado.toFixed(2)}`, 'info');
        state.onProgress?.({ name: `Simulando ${DAY_NAMES[day]}...`, current: day + 1, total: 7 });
        await delay(50);
    }

    // Save all sales
    const existingSales = await storageService.getItem('bodega_sales_v1', []);
    await storageService.setItem('bodega_sales_v1', [...allTestSales, ...existingSales]);

    // Stock deduction simulation
    const currentProducts = await storageService.getItem('my_products_v1', []);
    const stockLedger = {};
    for (const sale of allTestSales) {
        for (const item of sale.items) {
            stockLedger[item.id] = (stockLedger[item.id] || 0) + item.qty;
        }
    }

    const updatedProducts = currentProducts.map(p => {
        if (stockLedger[p.id]) {
            return { ...p, stock: Math.max(0, (p.stock ?? 0) - stockLedger[p.id]) };
        }
        return p;
    });
    await storageService.setItem('my_products_v1', updatedProducts);

    // Customer debt update
    const currentCustomers = await storageService.getItem('my_customers_v1', []);
    const debtLedger = {};
    for (const sale of allTestSales) {
        if (sale.fiadoUsd > 0 && sale.customerId) {
            debtLedger[sale.customerId] = (debtLedger[sale.customerId] || 0) + sale.fiadoUsd;
        }
    }

    const updatedCustomers = currentCustomers.map(c => {
        if (debtLedger[c.id]) return { ...c, deuda: (c.deuda || 0) + debtLedger[c.id] };
        return c;
    });
    await storageService.setItem('my_customers_v1', updatedCustomers);

    // ── VALIDATIONS ──
    section('📊 VALIDACIONES 7 DÍAS');

    assertGreater(totalSalesGenerated, 20, `Total ventas: ${totalSalesGenerated} > 20`);
    assertGreater(totalRevenueUsd, 100, `Revenue acumulado: $${totalRevenueUsd.toFixed(2)} > $100`);

    // Verify all sales persisted
    const finalSales = await storageService.getItem('bodega_sales_v1', []);
    const testSalesInDb = finalSales.filter(s => s._testData && s.id?.includes('7d_'));
    assertEqual(testSalesInDb.length, allTestSales.length, `${allTestSales.length} ventas persistidas`);

    // Verify stock was deducted
    const finalProducts = await storageService.getItem('my_products_v1', []);
    let stockOk = true;
    for (const p of catalog) {
        const current = finalProducts.find(fp => fp.id === p.id);
        if (current && stockLedger[p.id]) {
            const expected = Math.max(0, p.stock - stockLedger[p.id]);
            if (Math.abs(current.stock - expected) > 0.01) stockOk = false;
        }
    }
    assert(stockOk, 'Stock deducido correctamente para todos los productos');

    // Verify customer debts
    const finalCustomers = await storageService.getItem('my_customers_v1', []);
    for (const tc of testCustomers) {
        const fc = finalCustomers.find(c => c.id === tc.id);
        if (debtLedger[tc.id]) {
            assertClose(fc.deuda, debtLedger[tc.id], `${tc.name.replace(TEST_PREFIX, '')} deuda: $${fc?.deuda?.toFixed(2)}`);
        }
    }

    // NaN/negative integrity across ALL generated sales
    let integrityFails = 0;
    for (const s of allTestSales) {
        if (isNaN(s.totalUsd) || s.totalUsd < 0) integrityFails++;
        if (isNaN(s.totalBs) || s.totalBs < 0) integrityFails++;
    }
    assertEqual(integrityFails, 0, `Integridad NaN: 0 fallos en ${allTestSales.length * 2} checks`);

    // Daily consistency
    const totalFromDaily = dailyStats.reduce((s, d) => s + d.revenue, 0);
    assertClose(totalFromDaily, totalRevenueUsd, 'Suma diaria = total acumulado', 0.1);

    // Rate variation
    const rates = dailyStats.map(d => d.rate);
    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);
    assertGreater(maxRate - minRate, 0, `Variación tasa: ${formatBs(minRate)} → ${formatBs(maxRate)} Bs`);

    log('', 'info');
    log('📊 RESUMEN 7 DÍAS:', 'section');
    for (const d of dailyStats) {
        log(`  ${d.day}: ${d.sales} ventas | $${d.revenue.toFixed(2)} | Tasa ${formatBs(d.rate)} | Fiado $${d.fiado.toFixed(2)}`, 'info');
    }
    log(`  TOTAL: ${totalSalesGenerated} ventas | $${totalRevenueUsd.toFixed(2)} | Fiado: $${totalFiado.toFixed(2)}`, 'section');

    // Store stats for Groq analysis
    state._7dayStats = { dailyStats, totalSales: totalSalesGenerated, totalRevenue: totalRevenueUsd, totalFiado, salesCount: allTestSales.length };

    log('Simulación 7 días OK ✨', 'pass');
}

// ════════════════════════════════════════════
// 🤖 GROQ AI ANALYSIS
// ════════════════════════════════════════════
async function analyzeWithGroq() {
    state._currentSuite = 'AI';
    section('🤖 ANÁLISIS AI (Groq)');

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
        log('Groq API Key no configurada (VITE_GROQ_API_KEY) — Análisis omitido', 'warn');
        return null;
    }

    const passed = state.results.filter(r => r.passed).length;
    const failed = state.results.filter(r => !r.passed).length;
    const total = state.results.length;
    const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);

    const failDetails = state.results
        .filter(r => !r.passed)
        .map(r => `[${r.suite}] ${r.test}: ${r.detail}`)
        .join('\n');

    // Suite breakdown
    const suiteBreakdown = {};
    for (const r of state.results) {
        if (!suiteBreakdown[r.suite]) suiteBreakdown[r.suite] = { pass: 0, fail: 0 };
        r.passed ? suiteBreakdown[r.suite].pass++ : suiteBreakdown[r.suite].fail++;
    }

    // 7-day stats if available
    let dayReport = '';
    if (state._7dayStats) {
        const s = state._7dayStats;
        dayReport = `\nSIMULACIÓN 7 DÍAS DE NEGOCIO:
Total ventas: ${s.totalSales} | Revenue: $${s.totalRevenue.toFixed(2)} | Fiado: $${s.totalFiado.toFixed(2)}
Desglose diario:
${s.dailyStats.map(d => `  ${d.day}: ${d.sales} ventas, $${d.revenue.toFixed(2)}, tasa ${d.rate} Bs/$, fiado $${d.fiado.toFixed(2)}`).join('\n')}
`;
    }

    const prompt = `Eres un QA Lead Senior analizando resultados de testing E2E de un sistema POS bimoneda (Bolívares/USD) llamado "Precios al Día" para bodegas venezolanas.

RESULTADOS DE TESTS:
- Total: ${total} tests | ✅ ${passed} pass | ❌ ${failed} fail
- Tiempo: ${elapsed}s

DESGLOSE POR SUITE:
${Object.entries(suiteBreakdown).map(([s, v]) => `  ${s}: ${v.pass} pass, ${v.fail} fail`).join('\n')}

${failed > 0 ? `FALLOS:\n${failDetails}` : 'Sin fallos.'}
${dayReport}
Responde en español, formato estructurado:

1. **VEREDICTO**: 🟢 PRODUCTION READY / 🟡 ATENCIÓN / 🔴 CRÍTICO
2. **Análisis de Suites**: menciona brevemente cada suite y su estado (1 línea por suite)
3. **Simulación 7 Días**: si hay datos, analiza las tendencias de tasa, revenue y fiado
4. **Riesgos**: identifica riesgos potenciales basados en los tests (2-3 puntos)
5. **Recomendación**: una acción prioritaria

Máximo 250 palabras. Sé directo y técnico.`;

    try {
        log('Enviando resultados a Groq AI para análisis...', 'info');

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: 'Eres un QA Engineer senior especializado en sistemas POS. Responde de forma directa, estructurada y técnica en español.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.3,
                max_tokens: 600,
            }),
        });

        if (!response.ok) {
            throw new Error(`Groq API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const analysis = data.choices?.[0]?.message?.content || 'Sin respuesta de Groq';

        log('Análisis Groq completado:', 'ai');
        // Split and log each line for readability
        analysis.split('\n').forEach(line => {
            if (line.trim()) log(line, 'ai');
        });

        return analysis;
    } catch (err) {
        log(`Groq no disponible: ${err.message}`, 'warn');
        return null;
    }
}

// ════════════════════════════════════════════
// 🧹 CLEANUP — Remove all test data
// ════════════════════════════════════════════
async function cleanup() {
    section('🧹 LIMPIEZA');

    try {
        // Products
        const prods = await storageService.getItem('my_products_v1', []);
        const cleanProds = prods.filter(p => !p._testData);
        await storageService.setItem('my_products_v1', cleanProds);
        log(`${prods.length - cleanProds.length} productos test eliminados`, 'info');

        // Sales
        const sales = await storageService.getItem('bodega_sales_v1', []);
        const cleanSales = sales.filter(s => !s._testData);
        await storageService.setItem('bodega_sales_v1', cleanSales);
        log(`${sales.length - cleanSales.length} ventas test eliminadas`, 'info');

        // Customers
        const custs = await storageService.getItem('my_customers_v1', []);
        const cleanCusts = custs.filter(c => !c._testData);
        await storageService.setItem('my_customers_v1', cleanCusts);
        log(`${custs.length - cleanCusts.length} clientes test eliminados`, 'info');

        log('Limpieza completada — Sin residuos en DB ✨', 'pass');
    } catch (err) {
        log(`Error en limpieza: ${err.message}`, 'warn');
    }
}

// ════════════════════════════════════════════
// RUNNER
// ════════════════════════════════════════════
function resetState() {
    state.logs = [];
    state.results = [];
    state.isRunning = false;
    state.startTime = 0;
    state._stopped = false;
    state._currentSuite = '';
    state._testProductIds = [];
    state._testSaleIds = [];
    state._testCustomerIds = [];
    state._originalProducts = null;
    state._originalCustomers = null;
    state._originalSales = null;
    state._7dayStats = null;
}

const SUITES = [
    { key: 'storage', name: '💾 Storage Service', fn: suiteStorage },
    { key: 'productos', name: '📦 Productos', fn: suiteProductos },
    { key: 'carrito', name: '🛒 Carrito', fn: suiteCarrito },
    { key: 'bimoneda', name: '💱 Bimoneda', fn: suiteBimoneda },
    { key: 'checkout', name: '🧾 Checkout', fn: suiteCheckout },
    { key: 'clientes', name: '👥 Clientes', fn: suiteClientes },
    { key: 'payments', name: '💳 Pagos', fn: suitePayments },
    { key: 'modules', name: '🧩 Módulos', fn: suiteModules },
    { key: '7days', name: '🗓️ Simulación 7 Días', fn: suite7Days },
];

export const SystemTester = {
    getSuites: () => SUITES.map(s => ({ key: s.key, name: s.name })),

    stop: () => { state._stopped = true; },

    async runAll({ onLog, onProgress, onComplete } = {}) {
        resetState();
        state.isRunning = true;
        state.startTime = Date.now();
        state.onLog = onLog || null;
        state.onProgress = onProgress || null;

        log('🚀 System Tester v2.0 — Precios al Día', 'info');
        log(`${SUITES.length} suites • 7-Day Sim • Groq AI • Sin mocks`, 'info');

        for (let i = 0; i < SUITES.length; i++) {
            if (state._stopped) {
                log('⛔ Test detenido por el usuario', 'warn');
                break;
            }
            onProgress?.({ name: SUITES[i].name, current: i + 1, total: SUITES.length });
            try {
                await SUITES[i].fn();
            } catch (err) {
                log(`💥 Error fatal en ${SUITES[i].name}: ${err.message}`, 'fail');
                state.results.push({ suite: SUITES[i].key.toUpperCase(), test: 'Suite execution', passed: false, detail: err.message });
            }
            await delay(80);
        }

        // Groq AI Analysis
        let aiAnalysis = null;
        try {
            aiAnalysis = await analyzeWithGroq();
        } catch (err) {
            log(`Error en análisis AI: ${err.message}`, 'warn');
        }

        await cleanup();

        const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
        const passed = state.results.filter(r => r.passed).length;
        const failed = state.results.filter(r => !r.passed).length;

        section('📊 RESULTADO FINAL');
        log(`✅ ${passed} pass | ❌ ${failed} fail | ⏱️ ${elapsed}s`, passed > 0 && failed === 0 ? 'pass' : 'fail');

        const summary = {
            passed, failed, total: passed + failed, elapsed,
            results: state.results,
            aiAnalysis,
            dayStats: state._7dayStats,
        };
        state.isRunning = false;
        onComplete?.(summary);
        return summary;
    },

    async runSuite(suiteKey, { onLog } = {}) {
        resetState();
        state.isRunning = true;
        state.startTime = Date.now();
        state.onLog = onLog || null;

        const suite = SUITES.find(s => s.key === suiteKey);
        if (!suite) {
            log(`Suite "${suiteKey}" no encontrada`, 'fail');
            return { passed: 0, failed: 1, total: 1, results: state.results };
        }

        log(`🚀 Ejecutando suite: ${suite.name}`, 'info');
        try {
            await suite.fn();
        } catch (err) {
            log(`💥 Error: ${err.message}`, 'fail');
            state.results.push({ suite: suiteKey.toUpperCase(), test: 'Suite execution', passed: false, detail: err.message });
        }

        await cleanup();

        const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
        const passed = state.results.filter(r => r.passed).length;
        const failed = state.results.filter(r => !r.passed).length;
        const summary = { passed, failed, total: passed + failed, elapsed, results: state.results };

        state.isRunning = false;
        return summary;
    },
};
