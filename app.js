const SUPABASE_URL = 'https://vvzsrrcddwljhirbeilt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8soLaZIbUDWBV3hQIFVGIA_ycLtozey';

let pantryClient;
let inventory = [];
const CATEGORIES = ["Pantry", "Fridge", "Freezer", "Deep Freezer", "Spices", "Ellowyn's", "Dairy", "General"];

async function startApp() {
    try {
        pantryClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data, error } = await pantryClient.from('inventory').select('*');
        if (error) throw error;
        inventory = data || [];
        document.getElementById('syncStatus').innerText = "Household Sync Active 🟢";
        window.renderUI();

        pantryClient.channel('pantry-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, payload => {
                const updatedItem = payload.new;
                const oldItemIndex = inventory.findIndex(i => i.id === updatedItem?.id || i.id === payload.old?.id);
                
                if (payload.eventType === 'INSERT') inventory.push(updatedItem);
                if (payload.eventType === 'UPDATE') inventory[oldItemIndex] = updatedItem;
                if (payload.eventType === 'DELETE') inventory = inventory.filter(i => i.id !== payload.old.id);

                window.renderUI();

                if (payload.eventType === 'UPDATE' && updatedItem) {
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
    
    // Stats
    const lowItems = inventory.filter(i => i.replenishable && i.qty <= i.min);
    document.getElementById('stat-total').innerText = inventory.length;
    document.getElementById('stat-low').innerText = lowItems.length;
    document.getElementById('badge-count').innerText = lowItems.length;
    document.getElementById('badge-count').classList.toggle('hidden', lowItems.length === 0);

    // Grouping Logic
    let dashboardHTML = '';
    CATEGORIES.forEach(cat => {
        const catItems = inventory.filter(i => i.category === cat && i.name.toLowerCase().includes(search));
        if (catItems.length > 0) {
            dashboardHTML += `
                <div>
                    <h3 class="bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest p-2 rounded-lg mb-2 category-header">${cat}</h3>
                    <div class="space-y-2">
                        ${catItems.map(item => `
                            <div id="item-${item.id}" class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 ${item.qty <= item.min ? 'low-stock' : ''} flex items-center justify-between transition-all">
                                <div onclick="window.openModal('${item.id}')" class="flex-1">
                                    <h4 class="font-black text-gray-800 leading-tight">${item.name}</h4>
                                </div>
                                <div class="flex items-center gap-3">
                                    <button onclick="window.updateQty('${item.id}', -1)" class="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 font-black">-</button>
                                    <span class="font-black w-6 text-center text-lg">${item.qty}</span>
                                    <button onclick="window.updateQty('${item.id}', 1)" class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 font-black">+</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    });
    list.innerHTML = dashboardHTML || '<p class="text-center text-gray-400 py-10">No items found.</p>';

    // Shopping List with Checkboxes
    const groceryList = document.getElementById('groceryList');
    const shoppingItems = [...lowItems].sort((a, b) => a.checked - b.checked); // Checked items to bottom

    groceryList.innerHTML = shoppingItems.length ? shoppingItems.map(item => `
        <div class="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm ${item.checked ? 'item-checked' : ''}">
            <input type="checkbox" ${item.checked ? 'checked' : ''} 
                   onchange="window.toggleCheck('${item.id}', this.checked)" 
                   class="w-6 h-6 rounded-lg accent-emerald-600">
            <div class="flex-1">
                <p class="font-black text-gray-800">${item.name}</p>
                <p class="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">${item.category} • Need: ${item.min}</p>
            </div>
            <button onclick="window.openModal('${item.id}')" class="text-gray-300 px-2"><i class="fas fa-edit"></i></button>
        </div>
    `).join('') : '<p class="text-center text-gray-400 py-10 font-bold">Everything is in stock! 🎉</p>';
};

window.toggleCheck = async (id, isChecked) => {
    await pantryClient.from('inventory').update({ checked: isChecked }).eq('id', id);
};

window.resetList = async () => {
    if(confirm('Uncheck all items on the shopping list?')) {
        await pantryClient.from('inventory').update({ checked: false }).not('id', 'is', null);
    }
};

window.updateQty = async (id, delta) => {
    const item = inventory.find(i => i.id === id);
    const newQty = Math.max(0, item.qty + delta);
    // Auto-uncheck when qty increases (means you restocked it)
    const updateData = { qty: newQty };
    if (newQty > item.min) updateData.checked = false;
    
    await pantryClient.from('inventory').update(updateData).eq('id', id);
};

window.openModal = (id = null) => {
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('itemReplenish').checked = true;
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
