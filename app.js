const SUPABASE_URL = 'https://vvzsrrcddwljhirbeilt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8soLaZIbUDWBV3hQIFVGIA_ycLtozey';

let pantryClient;
let inventory = [];
const CATEGORIES = ["Pantry", "Fridge", "Freezer", "Deep Freezer", "Spices", "Ellowyn's", "Dairy", "General"];

async function startApp() {
    // Apply saved theme immediately
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
        document.getElementById('theme-icon').className = 'fas fa-sun';
    }

    try {
        pantryClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data, error } = await pantryClient.from('inventory').select('*');
        if (error) throw error;
        inventory = data || [];
        document.getElementById('syncStatus').innerText = "Sync Active 🟢";
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
        document.getElementById('syncStatus').innerText = "Offline Mode";
    }
}

// THEME TOGGLE
window.toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-icon').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
};

window.renderUI = () => {
    const list = document.getElementById('inventoryList');
    const search = document.getElementById('searchInput').value.toLowerCase();
    
    const lowItems = inventory.filter(i => i.replenishable && i.qty <= i.min);
    document.getElementById('stat-total').innerText = inventory.length;
    document.getElementById('stat-low').innerText = lowItems.length;
    document.getElementById('badge-count').innerText = lowItems.length;
    document.getElementById('badge-count').classList.toggle('hidden', lowItems.length === 0);

    let dashboardHTML = '';
    CATEGORIES.forEach(cat => {
        const catItems = inventory.filter(i => i.category === cat && i.name.toLowerCase().includes(search));
        if (catItems.length > 0) {
            dashboardHTML += `
                <div>
                    <h3 class="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest p-2 rounded-lg mb-2">${cat}</h3>
                    <div class="space-y-2">
                        ${catItems.map(item => `
                            <div id="item-${item.id}" class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 ${item.qty <= item.min ? 'low-stock' : ''} flex items-center justify-between">
                                <div onclick="window.openModal('${item.id}')" class="flex-1">
                                    <h4 class="font-black text-gray-800 dark:text-gray-100">${item.name}</h4>
                                </div>
                                <div class="flex items-center gap-3">
                                    <button onclick="window.updateQty('${item.id}', -1)" class="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 font-black">-</button>
                                    <span class="font-black w-6 text-center text-lg">${item.qty}</span>
                                    <button onclick="window.updateQty('${item.id}', 1)" class="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-900/30 text-pink-600 border border-pink-100 dark:border-pink-800 font-black">+</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    });
    list.innerHTML = dashboardHTML || '<p class="text-center text-gray-400 py-10">Empty...</p>';

    const groceryList = document.getElementById('groceryList');
    const shoppingItems = [...lowItems].sort((a, b) => a.checked - b.checked);

    groceryList.innerHTML = shoppingItems.length ? shoppingItems.map(item => `
        <div class="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm ${item.checked ? 'item-checked' : ''}">
            <input type="checkbox" ${item.checked ? 'checked' : ''} 
                   onchange="window.toggleCheck('${item.id}', this.checked)" 
                   class="w-6 h-6 rounded-lg accent-pink-600">
            <div class="flex-1">
                <p class="font-black text-gray-800 dark:text-gray-100">${item.name}</p>
                <p class="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">${item.category}</p>
            </div>
            <button onclick="window.openModal('${item.id}')" class="text-gray-300 dark:text-gray-600 px-2"><i class="fas fa-edit"></i></button>
        </div>
    `).join('') : '<p class="text-center text-gray-400 py-10 font-bold">Everything is stocked! 💖</p>';
};

window.toggleCheck = async (id, isChecked) => {
    await pantryClient.from('inventory').update({ checked: isChecked }).eq('id', id);
};

window.resetList = async () => {
    if(confirm('Clear all checkmarks?')) {
        await pantryClient.from('inventory').update({ checked: false }).not('id', 'is', null);
    }
};

window.updateQty = async (id, delta) => {
    const item = inventory.find(i => i.id === id);
    const newQty = Math.max(0, item.qty + delta);
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
        qty: parseInt(document.getElementById('itemQty').value) || 0,
        min: parseInt(document.getElementById('itemMin').value) || 0,
        category: document.getElementById('itemCategory').value,
        replenishable: document.getElementById('itemReplenish').checked
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

window.showTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active-tab'));
    document.getElementById(tabId).classList.add('active-tab');
    document.getElementById('nav-dash').className = tabId === 'dashboard' ? 'flex flex-col items-center p-2 text-pink-600' : 'flex flex-col items-center p-2 text-gray-400';
    document.getElementById('nav-groc').className = tabId === 'grocery' ? 'flex flex-col items-center p-2 text-pink-600' : 'flex flex-col items-center p-2 text-gray-400';
};

startApp();
