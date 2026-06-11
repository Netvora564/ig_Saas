// Use window.location.hostname to switch between local and production
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === ''
    ? 'http://localhost:3000'
    : 'https://your-backend-url.onrender.com'; // TODO: Update this after Render deployment

document.addEventListener('DOMContentLoaded', () => {
    fetchCampaigns();

    document.getElementById('createCampaignForm').addEventListener('submit', createCampaign);
    document.getElementById('syncAllBtn').addEventListener('click', syncAll);
});

async function fetchCampaigns() {
    try {
        const response = await fetch(`${API_URL}/campaigns`);
        if (!response.ok) throw new Error('Network response was not ok');
        const campaigns = await response.json();
        const list = document.getElementById('campaignsList');
        list.innerHTML = '';

        campaigns.forEach(c => {
            const card = document.createElement('div');
            card.className = 'bg-white p-6 rounded shadow hover:shadow-md transition-shadow';
            card.innerHTML = `
                <h3 class="text-xl font-bold mb-2">${c.name}</h3>
                <p class="text-gray-600 mb-4">ID: ${c.ig_business_id}</p>
                <div class="flex gap-2">
                    <button onclick="viewParticipants(${c.id}, '${c.name.replace(/'/g, "\\'")}')" class="bg-blue-100 text-blue-600 px-4 py-2 rounded hover:bg-blue-200">View</button>
                    <span class="ml-auto text-sm ${c.active ? 'text-green-500' : 'text-red-500'}">${c.active ? 'Active' : 'Inactive'}</span>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        document.getElementById('campaignsList').innerHTML = '<p class="text-red-500">Failed to load campaigns. Is the backend running?</p>';
    }
}

async function createCampaign(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;

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
    } catch (error) {
        console.error('Error creating campaign:', error);
        alert('Failed to create campaign');
    } finally {
        btn.disabled = false;
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
            alert('Sync completed successfully!');
            if (currentCampaignId) {
                fetchParticipants(currentCampaignId);
            }
        } else {
            throw new Error('Sync failed');
        }
    } catch (error) {
        console.error('Error syncing:', error);
        alert('Sync failed. Check backend logs.');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

let currentCampaignId = null;

async function viewParticipants(id, name) {
    currentCampaignId = id;
    document.getElementById('modalTitle').innerText = `Participants: ${name}`;
    document.getElementById('participantsModal').classList.remove('hidden');
    document.getElementById('winnerDisplay').innerText = '';

    fetchParticipants(id);
    fetchWinners(id);

    document.getElementById('pickWinnerBtn').onclick = () => pickWinner(id);
    document.getElementById('manualImportBtn').onclick = () => manualImport(id);
}

async function manualImport(id) {
    const url = document.getElementById('manualUrl').value;
    if (!url) return alert('Please enter a URL');

    const btn = document.getElementById('manualImportBtn');
    btn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/campaign/${id}/manual-import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (response.ok) {
            document.getElementById('manualUrl').value = '';
            fetchParticipants(id);
        } else {
            alert('Failed to import from URL');
        }
    } catch (error) {
        console.error('Error manual importing:', error);
    } finally {
        btn.disabled = false;
    }
}

async function fetchParticipants(id) {
    const grid = document.getElementById('participantsGrid');
    grid.innerHTML = '<div class="col-span-full text-center">Loading participants...</div>';

    try {
        const response = await fetch(`${API_URL}/campaign/${id}/participants`);
        const participants = await response.json();
        grid.innerHTML = '';

        participants.forEach(p => {
            const item = document.createElement('div');
            item.className = 'border rounded overflow-hidden shadow-sm';
            item.innerHTML = `
                <img src="${p.media_url}" class="w-full h-32 object-cover" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
                <div class="p-2 text-xs font-bold truncate">@${p.username}</div>
            `;
            grid.appendChild(item);
        });

        if (participants.length === 0) {
            grid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-8">No participants found yet.</p>';
        }
    } catch (error) {
        console.error('Error fetching participants:', error);
        grid.innerHTML = '<p class="col-span-full text-center text-red-500">Failed to load participants.</p>';
    }
}

async function fetchWinners(id) {
    const list = document.getElementById('winnersList');
    list.innerHTML = '<li>Loading winners...</li>';

    try {
        const response = await fetch(`${API_URL}/campaign/${id}/winners`);
        const winners = await response.json();
        list.innerHTML = '';

        winners.forEach(w => {
            const li = document.createElement('li');
            li.className = 'mb-1';
            li.innerText = `${w.username} (Picked at ${new Date(w.picked_at).toLocaleString()})`;
            list.appendChild(li);
        });

        if (winners.length === 0) {
            list.innerHTML = '<li class="text-gray-500">No winners picked yet.</li>';
        }
    } catch (error) {
        console.error('Error fetching winners:', error);
        list.innerHTML = '<li class="text-red-500">Failed to load winners.</li>';
    }
}

async function pickWinner(id) {
    const btn = document.getElementById('pickWinnerBtn');
    const display = document.getElementById('winnerDisplay');

    btn.disabled = true;
    display.innerText = 'Picking...';
    display.className = 'text-lg font-bold text-blue-600';

    try {
        const response = await fetch(`${API_URL}/campaign/${id}/pick-winner`, { method: 'POST' });
        const result = await response.json();

        if (result.error) {
            display.innerText = result.error;
            display.className = 'text-lg font-bold text-red-600';
        } else {
            display.innerText = `Winner: @${result.username}!`;
            display.className = 'text-lg font-bold text-green-600 animate-bounce';
            fetchWinners(id);
        }
    } catch (error) {
        console.error('Error picking winner:', error);
        display.innerText = 'Error picking winner';
        display.className = 'text-lg font-bold text-red-600';
    } finally {
        btn.disabled = false;
    }
}

function closeModal() {
    document.getElementById('participantsModal').classList.add('hidden');
    currentCampaignId = null;
}
