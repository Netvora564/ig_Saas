const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    fetchCampaigns();
    document.getElementById('createCampaignForm').addEventListener('submit', createCampaign);
    document.getElementById('syncAllBtn').addEventListener('click', syncAll);
});

async function fetchCampaigns() {
    try {
        const response = await fetch(`${API_URL}/campaigns`);
        if (!response.ok) throw new Error('Failed to fetch');
        const campaigns = await response.json();
        const list = document.getElementById('campaignsList');
        list.innerHTML = '';
        campaigns.forEach(c => {
            const card = document.createElement('div');
            card.className = 'bg-white p-6 rounded shadow';
            card.innerHTML = `
                <h3 class="text-xl font-bold mb-2">${c.name}</h3>
                <p class="text-gray-600 mb-4">ID: ${c.ig_business_id}</p>
                <div class="flex gap-2">
                    <button onclick="viewParticipants(${c.id}, '${c.name}')" class="bg-blue-100 text-blue-600 px-4 py-2 rounded">View</button>
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
    await fetch(`${API_URL}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ig_business_id })
    });
    fetchCampaigns();
}

async function syncAll() {
    await fetch(`${API_URL}/sync`);
    if (currentCampaignId) fetchParticipants(currentCampaignId);
}

let currentCampaignId = null;
async function viewParticipants(id, name) {
    currentCampaignId = id;
    document.getElementById('modalTitle').innerText = `Participants: ${name}`;
    document.getElementById('participantsModal').classList.remove('hidden');
    fetchParticipants(id);
    fetchWinners(id);
    document.getElementById('pickWinnerBtn').onclick = () => pickWinner(id);
}

async function fetchParticipants(id) {
    const grid = document.getElementById('participantsGrid');
    const response = await fetch(`${API_URL}/campaign/${id}/participants`);
    const participants = await response.json();
    grid.innerHTML = participants.map(p => `
        <div class="border rounded p-2">
            <img src="${p.media_url}" class="w-full h-24 object-cover">
            <div class="text-xs">@${p.username}</div>
        </div>
    `).join('') || 'No participants';
}

async function fetchWinners(id) {
    const list = document.getElementById('winnersList');
    const response = await fetch(`${API_URL}/campaign/${id}/winners`);
    const winners = await response.json();
    list.innerHTML = winners.map(w => `<li>${w.username}</li>`).join('');
}

async function pickWinner(id) {
    const response = await fetch(`${API_URL}/campaign/${id}/pick-winner`, { method: 'POST' });
    const winner = await response.json();
    document.getElementById('winnerDisplay').innerText = `Winner: @${winner.username}`;
    fetchWinners(id);
}

function closeModal() {
    document.getElementById('participantsModal').classList.add('hidden');
}
