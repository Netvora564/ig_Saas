let API_URL = localStorage.getItem('ig_saas_backend_url') || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === ''
    ? 'http://localhost:3000'
    : 'https://your-backend-url.onrender.com'
);

document.addEventListener('DOMContentLoaded', () => {
    fetchCampaigns();
    document.getElementById('createCampaignForm').addEventListener('submit', createCampaign);
    document.getElementById('syncAllBtn').addEventListener('click', syncAll);
    document.getElementById('openSettingsBtn').addEventListener('click', openSettings);
});

async function fetchCampaigns() {
    const errorEl = document.getElementById('connectionError');
    try {
        const response = await fetch(`${API_URL}/campaigns`);
        if (!response.ok) throw new Error('Backend error');
        const campaigns = await response.json();
        errorEl.classList.add('hidden');
        const list = document.getElementById('campaignsList');
        const count = document.getElementById('campaignCount');

        list.innerHTML = '';
        count.innerText = campaigns.length;

        campaigns.forEach(c => {
            const card = document.createElement('div');
            card.className = 'bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all cursor-pointer group';
            card.onclick = (e) => {
                if (e.target.tagName !== 'BUTTON') viewParticipants(c.id, c.name);
            };
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">${c.name}</h3>
                    <span class="text-[10px] font-black px-2 py-1 rounded bg-green-100 text-green-700 uppercase tracking-widest">Active</span>
                </div>
                <div class="text-xs text-gray-400 mb-6 font-mono">ID: ${c.ig_business_id}</div>
                <button class="w-full bg-gray-50 text-gray-600 font-bold py-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all text-sm border border-gray-100">
                    Open Campaign
                </button>
            `;
            list.appendChild(card);
        });
    } catch (err) {
        console.error('Error fetching campaigns:', err);
        errorEl.classList.remove('hidden');
    }
}

function openSettings() {
    document.getElementById('backendUrlInput').value = localStorage.getItem('ig_saas_backend_url') || '';
    document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
}

function saveSettings() {
    const url = document.getElementById('backendUrlInput').value.trim().replace(/\/$/, '');
    if (url) {
        localStorage.setItem('ig_saas_backend_url', url);
        API_URL = url;
    } else {
        localStorage.removeItem('ig_saas_backend_url');
        // Reset to default detection
        API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === ''
            ? 'http://localhost:3000'
            : 'https://your-backend-url.onrender.com';
    }
    closeSettings();
    fetchCampaigns();
}

async function createCampaign(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerText = 'Creating...';

    const name = document.getElementById('campaignName').value;
    const ig_business_id = document.getElementById('igBusinessId').value;

    try {
        const response = await fetch(`${API_URL}/campaigns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, ig_business_id })
        });
        if (response.ok) {
            document.getElementById('createCampaignForm').reset();
            fetchCampaigns();
        }
    } catch (err) {
        console.error('Error creating campaign:', err);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Create Campaign';
    }
}

async function syncAll() {
    const btn = document.getElementById('syncAllBtn');
    const originalText = btn.innerText;
    btn.innerText = 'Syncing...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/sync`);
        if (response.ok) {
            alert('All campaigns synced successfully with Instagram Graph API.');
            if (currentCampaignId) fetchParticipants(currentCampaignId);
            fetchCampaigns();
        }
    } catch (err) {
        console.error('Sync error:', err);
        alert('Global sync failed.');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

let currentCampaignId = null;

async function viewParticipants(id, name) {
    currentCampaignId = id;
    document.getElementById('modalTitle').innerText = name;
    document.getElementById('modalSubtitle').innerText = `Campaign #${id}`;
    document.getElementById('participantsModal').classList.remove('hidden');
    document.getElementById('winnerDisplay').classList.add('hidden');
    document.getElementById('manualUrl').value = '';

    fetchParticipants(id);
    fetchWinners(id);

    document.getElementById('pickWinnerBtn').onclick = () => pickWinner(id);
    document.getElementById('manualImportBtn').onclick = () => manualImport(id);
}

function refreshParticipants() {
    if (currentCampaignId) fetchParticipants(currentCampaignId);
}

async function fetchParticipants(id) {
    const grid = document.getElementById('participantsGrid');
    grid.innerHTML = '<div class="col-span-full py-20 flex flex-col items-center text-gray-300"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>Loading posts...</div>';

    try {
        const response = await fetch(`${API_URL}/campaign/${id}/participants`);
        const participants = await response.json();
        grid.innerHTML = '';

        participants.forEach(p => {
            const item = document.createElement('div');
            item.className = 'bg-gray-50 rounded-xl overflow-hidden border border-gray-100 group hover:border-blue-200 transition-all';
            item.innerHTML = `
                <div class="relative pb-[100%] overflow-hidden">
                    <img src="${p.media_url}" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
                </div>
                <div class="p-3">
                    <div class="text-xs font-black text-gray-900 mb-1">@${p.username}</div>
                    <div class="text-[9px] text-gray-400 font-mono">${new Date(p.timestamp).toLocaleDateString()}</div>
                </div>
            `;
            grid.appendChild(item);
        });

        if (participants.length === 0) {
            grid.innerHTML = '<div class="col-span-full py-20 text-center text-gray-400">No mentions found for this campaign yet.</div>';
        }
    } catch (err) {
        grid.innerHTML = '<div class="col-span-full py-20 text-center text-red-400 font-bold">Failed to connect to backend.</div>';
    }
}

async function manualImport(id) {
    const urlInput = document.getElementById('manualUrl');
    const url = urlInput.value;
    if (!url) return;

    const btn = document.getElementById('manualImportBtn');
    btn.disabled = true;
    btn.innerText = 'Importing...';

    try {
        const response = await fetch(`${API_URL}/campaign/${id}/manual-import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (response.ok) {
            urlInput.value = '';
            fetchParticipants(id);
        }
    } catch (err) {
        console.error('Import error:', err);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Import Post';
    }
}

async function fetchWinners(id) {
    const list = document.getElementById('winnersList');
    list.innerHTML = '<li class="animate-pulse text-gray-300">Loading history...</li>';

    try {
        const response = await fetch(`${API_URL}/campaign/${id}/winners`);
        const winners = await response.json();
        list.innerHTML = '';

        winners.forEach(w => {
            const li = document.createElement('li');
            li.className = 'flex items-center gap-2 p-2 bg-white rounded border border-gray-100';
            li.innerHTML = `
                <div class="w-2 h-2 rounded-full bg-purple-500"></div>
                <span class="font-bold">@${w.username}</span>
                <span class="text-[10px] text-gray-300 ml-auto">${new Date(w.picked_at).toLocaleDateString()}</span>
            `;
            list.appendChild(li);
        });

        if (winners.length === 0) list.innerHTML = '<li class="text-gray-400 text-xs italic">No previous winners.</li>';
    } catch (err) {
        list.innerHTML = '<li class="text-red-400 text-xs">Error loading history.</li>';
    }
}

async function pickWinner(id) {
    const btn = document.getElementById('pickWinnerBtn');
    const display = document.getElementById('winnerDisplay');
    const nameLabel = document.getElementById('winnerName');

    btn.disabled = true;
    btn.innerText = 'SELECTING...';

    try {
        const response = await fetch(`${API_URL}/campaign/${id}/pick-winner`, { method: 'POST' });
        const result = await response.json();

        if (result.username) {
            display.classList.remove('hidden');
            display.classList.add('bg-purple-100', 'border', 'border-purple-200', 'winner-animation');
            nameLabel.innerText = `@${result.username}`;
            fetchWinners(id);
        } else {
            alert(result.error || 'Could not pick winner.');
        }
    } catch (err) {
        console.error('Winner error:', err);
    } finally {
        btn.disabled = false;
        btn.innerText = 'PICK RANDOM WINNER';
    }
}

function closeModal() {
    document.getElementById('participantsModal').classList.add('hidden');
    currentCampaignId = null;
}
