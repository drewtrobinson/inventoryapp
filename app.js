const SUPABASE_URL = 'https://vvzsrrcddwljhirbeilt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8soLaZIbUDWBV3hQIFVGIA_ycLtozey';

let pantryClient;
let inventory = [];
let html5QrCode;

async function startApp() {
    try {
        pantryClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        // Initial Fetch
        const { data, error } = await pantryClient.from('inventory').select('*');
        if (error) throw error;

        inventory = data || [];
        document.getElementById('syncStatus').innerText = "Household Sync Active 🟢";
        window.renderUI();

        // Real-time Listeners
        pantryClient.channel('pantry-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => refreshData())
            .subscribe();

    } catch (err) {
        console.error(err);
        document.getElementById('syncStatus').innerHTML = `<span class="text-red-500">Sync Error: Check Settings</span>`;
    }
}

async function refreshData() {
    const { data } = await pantryClient.from('inventory').select('*');
    if (data) {
        inventory = data;
        window.renderUI();
    }
}

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
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 ${item.qty <= item.min ? 'low-stock' : ''} flex items-center justify-between">
            <div onclick="window.openModal('${item.id}')" class="flex-1">
                <h4 class="font-black text-gray-800">${item.name}</h4>
                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-tight">${item.category} ${item.barcode ? '• ' + item.barcode : ''}</p>
            </div>
            <div class="flex items-center gap-3">
                <button onclick="window.updateQty('${item.id}', -1)" class="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 font-black">-</button>
                <span class="font-black w-6 text-center text-lg">${item.qty}</span>
                <button onclick="window.updateQty('${item.id}', 1)" class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 font-black">+</button>
            </div>
        </div>
    `).join('');

    const needed = inventory.filter(i => i.qty <= i.min);
    document.getElementById('groceryList').innerHTML = needed.length ? needed.map(item => `
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-2">
            <div><p class="font-black">${item.name}</p><p class="text-[10px] text-gray-400 font-bold">NEED ASAP</p></div>
            <i class="fas fa-cart-plus text-emerald-300"></i>
        </div>
    `).join('') : '<p class="text-center text-gray-400 py-10">Pantry is full! 🎉</p>';
};

window.updateQty = async (id, delta) => {
    const item = inventory.find(i => i.id === id);
    const newQty = Math.max(0, item.qty + delta);
    await pantryClient.from('inventory').update({ qty: newQty }).eq('id', id);
};

window.openModal = (id = null) => {
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
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
        document.getElementById('modalTitle').innerText = 'Add Item';
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

    if (id) await pantryClient.from('inventory').update(itemData).eq('id', id);
    else await pantryClient.from('inventory').insert([itemData]);
    window.closeModal();
};

window.deleteItem = async () => {
    const id = document.getElementById('itemId').value;
    if(confirm('Delete permanently?')) {
        await pantryClient.from('inventory').delete().eq('id', id);
        window.closeModal();
    }
};

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

startApp();
