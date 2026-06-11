const API_URL = 'http://localhost:3000'; // Default for local dev/testing

document.addEventListener('DOMContentLoaded', () => {
    fetchCampaigns();

    document.getElementById('createCampaignForm').addEventListener('submit', createCampaign);
    document.getElementById('syncAllBtn').addEventListener('click', syncAll);
});

async function fetchCampaigns() {
    try {
        const response = await fetch(`${API_URL}/campaigns`);
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
                    <button onclick="viewParticipants(${c.id}, '${c.name}')" class="bg-blue-100 text-blue-600 px-4 py-2 rounded hover:bg-blue-200">View</button>
                    <span class="ml-auto text-sm ${c.active ? 'text-green-500' : 'text-red-500'}">${c.active ? 'Active' : 'Inactive'}</span>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('Error fetching campaigns:', error);
    }
}

async function createCampaign(e) {
    e.preventDefault();
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
    }
}

async function syncAll() {
    const btn = document.getElementById('syncAllBtn');
    const originalText = btn.innerText;
    btn.innerText = 'Syncing...';
    btn.disabled = true;

    try {
        await fetch(`${API_URL}/sync`);
        alert('Sync completed!');
        if (currentCampaignId) {
            fetchParticipants(currentCampaignId);
        }
    } catch (error) {
        console.error('Error syncing:', error);
        alert('Sync failed');
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
}

async function fetchParticipants(id) {
    const grid = document.getElementById('participantsGrid');
    grid.innerHTML = 'Loading...';

    try {
        const response = await fetch(`${API_URL}/campaign/${id}/participants`);
        const participants = await response.json();
        grid.innerHTML = '';

        participants.forEach(p => {
            const item = document.createElement('div');
            item.className = 'border rounded overflow-hidden';
            item.innerHTML = `
                <img src="${p.media_url}" class="w-full h-32 object-cover" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
                <div class="p-2 text-xs font-bold truncate">@${p.username}</div>
            `;
            grid.appendChild(item);
        });

        if (participants.length === 0) {
            grid.innerHTML = '<p class="col-span-full text-center text-gray-500">No participants found.</p>';
        }
    } catch (error) {
        console.error('Error fetching participants:', error);
    }
}

async function fetchWinners(id) {
    const list = document.getElementById('winnersList');
    list.innerHTML = '';

    try {
        const response = await fetch(`${API_URL}/campaign/${id}/winners`);
        const winners = await response.json();

        winners.forEach(w => {
            const li = document.createElement('li');
            li.innerText = `${w.username} (Picked at ${new Date(w.picked_at).toLocaleString()})`;
            list.appendChild(li);
        });
    } catch (error) {
        console.error('Error fetching winners:', error);
    }
}

async function pickWinner(id) {
    const display = document.getElementById('winnerDisplay');
    display.innerText = 'Picking...';

    try {
        const response = await fetch(`${API_URL}/campaign/${id}/pick-winner`, { method: 'POST' });
        const winner = await response.json();

        if (winner.error) {
            display.innerText = winner.error;
            display.className = 'text-lg font-bold text-red-600';
        } else {
            display.innerText = `Winner: @${winner.username}!`;
            display.className = 'text-lg font-bold text-green-600';
            fetchWinners(id);
        }
    } catch (error) {
        console.error('Error picking winner:', error);
    }
}

function closeModal() {
    document.getElementById('participantsModal').classList.add('hidden');
    currentCampaignId = null;
}
