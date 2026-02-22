import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: "AIzaSyAFDvL1hOJeCOaMniZG9yBQg5iJ3lF-Y1s",
  authDomain: "pantrypal-395d8.firebaseapp.com",
  projectId: "pantrypal-395d8",
  storageBucket: "pantrypal-395d8.firebasestorage.app",
  messagingSenderId: "31837706643",
  appId: "1:31837706643:web:5df29d071c526273213066",
  measurementId: "G-3E1FMXPGXV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const pantryCol = collection(db, "inventory");

let inventory = [];
let html5QrCode;

// Real-time listener: This is the magic!
// When ANYONE changes data, this runs for EVERYONE immediately.
onSnapshot(pantryCol, (snapshot) => {
    inventory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    document.getElementById('syncStatus').innerText = "Cloud Synced ✅";
    renderUI();
});

// UI Functions
window.showTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-tab'));
    document.getElementById(tabId).classList.add('active-tab');
    document.getElementById('nav-dash').className = tabId === 'dashboard' ? 'flex flex-col items-center p-2 text-emerald-600' : 'flex flex-col items-center p-2 text-gray-400';
    document.getElementById('nav-groc').className = tabId === 'grocery' ? 'flex flex-col items-center p-2 text-emerald-600' : 'flex flex-col items-center p-2 text-gray-400';
    renderUI();
};

window.renderUI = () => {
    renderInventory();
    renderGrocery();
};

function renderInventory() {
    const list = document.getElementById('inventoryList');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    let filtered = inventory.filter(i => 
        i.name.toLowerCase().includes(searchTerm) && 
        (categoryFilter === 'all' || i.category === categoryFilter)
    );

    document.getElementById('stat-total').innerText = inventory.length;
    document.getElementById('stat-low').innerText = inventory.filter(i => i.qty <= i.min).length;

    list.innerHTML = filtered.map(item => `
        <div class="bg-white p-4 rounded-xl shadow-sm border ${item.qty <= item.min ? 'low-stock' : ''} flex items-center justify-between">
            <div onclick="window.openEditModal('${item.id}')" class="flex-1 cursor-pointer">
                <h4 class="font-bold">${item.name}</h4>
                <p class="text-xs text-gray-500">${item.category} | ${item.barcode || 'No Barcode'}</p>
            </div>
            <div class="flex items-center gap-3">
                <button onclick="window.updateQty('${item.id}', -1)" class="w-8 h-8 rounded-full bg-gray-100">-</button>
                <span class="font-bold w-6 text-center">${item.qty}</span>
                <button onclick="window.updateQty('${item.id}', 1)" class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600">+</button>
            </div>
        </div>
    `).join('');
}

function renderGrocery() {
    const list = document.getElementById('groceryList');
    const needed = inventory.filter(i => i.qty <= i.min);
    list.innerHTML = needed.length ? needed.map(item => `
        <div class="flex items-center justify-between p-2 border-b">
            <div><p class="font-medium">${item.name}</p><p class="text-xs text-gray-400">Location: ${item.category}</p></div>
            <i class="fas fa-shopping-cart text-gray-300"></i>
        </div>
    `).join('') : '<p class="text-center text-gray-400 py-8">All stocked up!</p>';
}

// Database Actions
window.updateQty = async (id, delta) => {
    const item = inventory.find(i => i.id === id);
    const newQty = Math.max(0, item.qty + delta);
    await updateDoc(doc(db, "inventory", id), { qty: newQty });
};

window.openEditModal = (id) => {
    const item = inventory.find(i => i.id === id);
    document.getElementById('modalTitle').innerText = 'Edit Item';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemBarcode').value = item.barcode;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemQty').value = item.qty;
    document.getElementById('itemMin').value = item.min;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemModal').classList.remove('hidden');
};

window.closeModal = () => document.getElementById('itemModal').classList.add('hidden');

document.getElementById('itemForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('itemId').value;
    const data = {
        barcode: document.getElementById('itemBarcode').value,
        name: document.getElementById('itemName').value,
        qty: parseInt(document.getElementById('itemQty').value),
        min: parseInt(document.getElementById('itemMin').value),
        category: document.getElementById('itemCategory').value
    };

    if (id) {
        await updateDoc(doc(db, "inventory", id), data);
    } else {
        await addDoc(pantryCol, data);
    }
    closeModal();
};

// Scanner Logic
window.toggleScanner = () => {
    const modal = document.getElementById('scannerModal');
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        html5QrCode = new Html5Qrcode("reader");
        html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (code) => {
            html5QrCode.stop().then(() => {
                modal.classList.add('hidden');
                const existing = inventory.find(i => i.barcode === code);
                if (existing) window.openEditModal(existing.id);
                else {
                    document.getElementById('itemForm').reset();
                    document.getElementById('itemBarcode').value = code;
                    document.getElementById('itemModal').classList.remove('hidden');
                }
            });
        });
    } else {
        html5QrCode.stop().then(() => modal.classList.add('hidden'));
    }
};