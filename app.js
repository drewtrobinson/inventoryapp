const SUPABASE_URL = 'https://vvzsrrcddwljhirbeilt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8soLaZIbUDWBV3hQIFVGIA_ycLtozey';

let pantryClient;
let inventory = [];

async function startApp() {
    try {
        pantryClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data, error } = await pantryClient.from('inventory').select('*');
        if (error) throw error;
        inventory = data || [];
        document.getElementById('syncStatus').innerText = "Live Household Sync 🟢";
        window.renderUI();

        // REAL-TIME LISTENER
        pantryClient.channel('pantry-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, payload => {
                const updatedItem = payload.new;
                const oldItemIndex = inventory.findIndex(i => i.id === updatedItem.id);
                
                // Update local list
                if (payload.eventType === 'INSERT') inventory.push(updatedItem);
                if (payload.eventType === 'UPDATE') inventory[oldItemIndex] = updatedItem;
                if (payload.eventType === 'DELETE') inventory = inventory.filter(i => i.id !== payload.old.id);

                window.renderUI();

                // APPLY FLASH EFFECT to the changed item
                if (updatedItem && updatedItem.id) {
                    const el = document.getElementById(`item-${updatedItem.id}`);
                    if (el) {
                        el.classList.add('sync-flash');
                        setTimeout(() => el.classList.remove('sync-flash'), 1000);
                    }
                }
            })
            .subscribe();
    } catch (err) {
        document.getElementById('syncStatus').innerText = "Sync Offline";
    }
}

window.renderUI = () => {
    const list = document.getElementById('inventoryList');
    const search = document.getElementById('searchInput').value.toLowerCase();
    const cat = document.getElementById('categoryFilter').value;

    let filtered = inventory.filter(i => 
        i.name.toLowerCase().includes(search) && (cat === 'all' || i.category === cat)
    );

    document.getElementById('stat-total').innerText = inventory.length;
    // Only count as "Low" if it's replenishable
    const lowItems = inventory.filter(i => i.replenishable && i.qty <= i.min);
    document.getElementById('stat-low').innerText = lowItems.length;

    list.innerHTML = filtered.map(item => `
        <div id="item-${item.id}" class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 ${item.qty <= item.min ? 'low-stock' : ''} flex items-center justify-between transition-all">
            <div onclick="window.openModal('${item.id}')" class="flex-1">
                <h4 class="font-black text-gray-800">${item.name}</h4>
                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${item.category}</p>
            </div>
            <div class="flex items-center gap-3">
                <button onclick="window.updateQty('${item.id}', -1)" class="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 font-black">-</button>
                <span class="font-black w-6 text-center text-lg">${item.qty}</span>
                <button onclick="window.updateQty('${item.id}', 1)" class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 font-black">+</button>
            </div>
        </div>
    `).join('');

    document.getElementById('groceryList').innerHTML = lowItems.length ? lowItems.map(item => `
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-2">
            <div><p class="font-black">${item.name}</p><p class="text-[10px] text-gray-400 font-bold uppercase">${item.category}</p></div>
            <i class="fas fa-cart-arrow-down text-emerald-300"></i>
        </div>
    `).join('') : '<p class="text-center text-gray-400 py-10">All stock is good! 🎉</p>';
};

// ACTIONS
window.updateQty = async (id, delta) => {
    const item = inventory.find(i => i.id === id);
    await pantryClient.from('inventory').update({ qty: Math.max(0, item.qty + delta) }).eq('id', id);
};

window.openModal = (id = null) => {
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('itemReplenish').checked = true; // Default
    document.getElementById('deleteBtn').classList.add('hidden');
    
    if (id) {
        const item = inventory.find(i => i.id === id);
        document.getElementById('itemId').value = item.id;
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemQty').value = item.qty;
        document.getElementById('itemMin').value = item.min;
        document.getElementById('itemCategory').value = item.category;
        document.getElementById('itemReplenish').checked = item.replenishable;
        document.getElementById('deleteBtn').classList.remove('hidden');
    }
    document.getElementById('itemModal').classList.remove('hidden');
};

window.closeModal = () => document.getElementById('itemModal').classList.add('hidden');

document.getElementById('itemForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('itemId').value;
    const itemData = {
        name: document.getElementById('itemName').value,
        qty: parseInt(document.getElementById('itemQty').value),
        min: parseInt(document.getElementById('itemMin').value),
        category: document.getElementById('itemCategory').value,
        replenishable: document.getElementById('itemReplenish').checked
    };

    if (id) await pantryClient.from('inventory').update(itemData).eq('id', id);
    else await pantryClient.from('inventory').insert([itemData]);
    window.closeModal();
};

window.deleteItem = async () => {
    const id = document.getElementById('itemId').value;
    if(confirm('Delete this entry?')) {
        await pantryClient.from('inventory').delete().eq('id', id);
        window.closeModal();
    }
};

window.showTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-tab'));
    document.getElementById(tabId).classList.add('active-tab');
    document.getElementById('nav-dash').className = tabId === 'dashboard' ? 'flex flex-col items-center p-2 text-emerald-600' : 'flex flex-col items-center p-2 text-gray-400';
    document.getElementById('nav-groc').className = tabId === 'grocery' ? 'flex flex-col items-center p-2 text-emerald-600' : 'flex flex-col items-center p-2 text-gray-400';
};

startApp();
