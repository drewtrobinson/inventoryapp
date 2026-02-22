// 1. INSERT YOUR SUPABASE CREDENTIALS HERE
const SUPABASE_URL = 'https://vvzsrrcddwljhirbeilt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8soLaZIbUDWBV3hQIFVGIA_ycLtozey';

const supabase = libsupabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let inventory = [];
let html5QrCode;

// Sync logic: Fetch and listen for changes
async function init() {
    // Initial fetch
    const { data, error } = await supabase.from('inventory').select('*');
    if (data) {
        inventory = data;
        renderUI();
    }
    document.getElementById('syncStatus').innerText = "Live Sync Active 🟢";

    // Listen for real-time updates from other phones
    supabase.channel('pantry-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, payload => {
            refreshData();
        })
        .subscribe();
}

async function refreshData() {
    const { data } = await supabase.from('inventory').select('*');
    if (data) {
        inventory = data;
        renderUI();
    }
}

// UI Rendering
window.showTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-tab'));
    document.getElementById(tabId).classList.add('active-tab');
    document.getElementById('nav-dash').className = tabId === 'dashboard' ? 'flex flex-col items-center p-2 text-emerald-600' : 'flex flex-col items-center p-2 text-gray-400';
    document.getElementById('nav-groc').className = tabId === 'grocery' ? 'flex flex-col items-center p-2 text-emerald-600' : 'flex flex-col items-center p-2 text-gray-400';
};

window.renderUI = () => {
    const list = document.getElementById('inventoryList');
    const search = document.getElementById('searchInput').value.toLowerCase();
    const cat = document.getElementById('categoryFilter').value;

    let filtered = inventory.filter(i => 
        i.name.toLowerCase().includes(search) && (cat === 'all' || i.category === cat)
    );

    document.getElementById('stat-total').innerText = inventory.length;
    document.getElementById('stat-low').innerText = inventory.filter(i => i.qty <= i.min).length;

    list.innerHTML = filtered.map(item => `
        <div class="bg-white p-4 rounded-xl shadow-sm border ${item.qty <= item.min ? 'low-stock' : ''} flex items-center justify-between">
            <div onclick="window.openModal('${item.id}')" class="flex-1">
                <h4 class="font-bold">${item.name}</h4>
                <p class="text-[10px] text-gray-400">${item.category.toUpperCase()} ${item.barcode ? '| ' + item.barcode : ''}</p>
            </div>
            <div class="flex items-center gap-3">
                <button onclick="window.updateQty('${item.id}', -1)" class="w-8 h-8 rounded-full bg-gray-50 border">-</button>
                <span class="font-bold w-6 text-center ${item.qty <= item.min ? 'text-red-500' : ''}">${item.qty}</span>
                <button onclick="window.updateQty('${item.id}', 1)" class="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">+</button>
            </div>
        </div>
    `).join('');

    const needed = inventory.filter(i => i.qty <= i.min);
    document.getElementById('groceryList').innerHTML = needed.length ? needed.map(item => `
        <div class="flex items-center justify-between p-2 border-b">
            <div><p class="font-medium">${item.name}</p><p class="text-[10px] text-gray-400">STOCK: ${item.qty} / MIN: ${item.min}</p></div>
            <i class="fas fa-shopping-cart text-emerald-200"></i>
        </div>
    `).join('') : '<p class="text-center text-gray-400 py-8">All items stocked!</p>';
};

// Database Actions
window.updateQty = async (id, delta) => {
    const item = inventory.find(i => i.id === id);
    const newQty = Math.max(0, item.qty + delta);
    await supabase.from('inventory').update({ qty: newQty }).eq('id', id);
};

window.openModal = (id = null) => {
    const form = document.getElementById('itemForm');
    form.reset();
    document.getElementById('deleteBtn').classList.add('hidden');
    
    if (id) {
        const item = inventory.find(i => i.id === id);
        document.getElementById('modalTitle').innerText = 'Edit Item';
        document.getElementById('itemId').value = item.id;
        document.getElementById('itemBarcode').value = item.barcode || '';
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemQty').value = item.qty;
        document.getElementById('itemMin').value = item.min;
        document.getElementById('itemCategory').value = item.category;
        document.getElementById('deleteBtn').classList.remove('hidden');
    } else {
        document.getElementById('modalTitle').innerText = 'Manual Add';
        document.getElementById('itemId').value = '';
    }
    document.getElementById('itemModal').classList.remove('hidden');
};

window.closeModal = () => document.getElementById('itemModal').classList.add('hidden');

document.getElementById('itemForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('itemId').value;
    const itemData = {
        name: document.getElementById('itemName').value,
        barcode: document.getElementById('itemBarcode').value,
        qty: parseInt(document.getElementById('itemQty').value),
        min: parseInt(document.getElementById('itemMin').value),
        category: document.getElementById('itemCategory').value
    };

    if (id) {
        await supabase.from('inventory').update(itemData).eq('id', id);
    } else {
        await supabase.from('inventory').insert([itemData]);
    }
    closeModal();
};

window.deleteItem = async () => {
    const id = document.getElementById('itemId').value;
    if(confirm('Remove this item entirely?')) {
        await supabase.from('inventory').delete().eq('id', id);
        closeModal();
    }
}

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
                if (existing) window.openModal(existing.id);
                else {
                    window.openModal();
                    document.getElementById('itemBarcode').value = code;
                }
            });
        });
    } else {
        html5QrCode.stop().then(() => modal.classList.add('hidden'));
    }
};

init();
