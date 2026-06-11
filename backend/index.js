require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Database Configuration (Supabase or Mock) ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const isMockMode = !supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder');

let supabase;
let mockDb = {
    campaigns: [
        { id: 1, name: 'Sample Campaign', ig_business_id: '12345', active: true, created_at: new Date() }
    ],
    participants: [],
    winners: []
};

if (!isMockMode) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Running in Production Mode (Supabase)');
} else {
    console.log('Running in Mock Mode (In-Memory)');
}

app.get('/', (req, res) => {
    res.json({ message: 'Instagram UGC Campaign Tracker API', mode: isMockMode ? 'mock' : 'production' });
});

// --- Core Logic ---

const syncCampaigns = async () => {
    console.log('Starting sync process...');
    let campaigns;

    if (!isMockMode) {
        const { data, error } = await supabase.from('campaigns').select('*').eq('active', true);
        if (error) return console.error('Error fetching campaigns:', error);
        campaigns = data;
    } else {
        campaigns = mockDb.campaigns.filter(c => c.active);
    }

    for (const campaign of campaigns) {
        try {
            console.log(`Syncing campaign: ${campaign.name}`);
            let taggedMedia = [];

            if (!isMockMode && process.env.IG_ACCESS_TOKEN) {
                let nextUrl = `https://graph.facebook.com/v19.0/${campaign.ig_business_id}/tags?fields=id,media_type,media_url,timestamp,username&limit=50&access_token=${process.env.IG_ACCESS_TOKEN}`;

                while (nextUrl) {
                    const response = await axios.get(nextUrl);
                    taggedMedia = taggedMedia.concat(response.data.data || []);
                    nextUrl = response.data.paging && response.data.paging.next ? response.data.paging.next : null;

                    // Safety break to prevent infinite loops
                    if (taggedMedia.length > 500) break;
                }
            } else {
                // Mock Instagram Data
                const randomId = Date.now();
                taggedMedia = [
                    { id: `m${randomId}1`, username: 'winner_circle', media_url: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=150', timestamp: new Date().toISOString() },
                    { id: `m${randomId}2`, username: 'photo_enthusiast', media_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150', timestamp: new Date().toISOString() },
                    { id: `m${randomId}3`, username: 'ig_traveler', media_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', timestamp: new Date().toISOString() }
                ];
            }

            if (taggedMedia.length > 0) {
                for (const media of taggedMedia) {
                    if (!isMockMode) {
                        const { error: insErr } = await supabase.from('participants').insert({
                            campaign_id: campaign.id,
                            username: media.username,
                            media_id: media.id,
                            media_url: media.media_url,
                            timestamp: media.timestamp
                        });
                        if (insErr && insErr.code !== '23505') {
                            console.error(`Insert error for ${media.id}:`, insErr.message);
                        }
                    } else {
                        // Mock deduplication
                        if (!mockDb.participants.find(p => p.media_id === media.id)) {
                            mockDb.participants.push({
                                id: mockDb.participants.length + 1,
                                campaign_id: campaign.id,
                                username: media.username,
                                media_id: media.id,
                                media_url: media.media_url,
                                timestamp: media.timestamp,
                                created_at: new Date()
                            });
                        }
                    }
                }
            }
        } catch (err) {
            console.error(`Failed to sync ${campaign.name}:`, err.message);
        }
    }
    console.log('Sync completed.');
};

app.get('/sync', async (req, res) => {
    await syncCampaigns();
    res.json({ message: 'Sync completed successfully' });
});

cron.schedule('*/5 * * * *', () => syncCampaigns());

// --- API Endpoints ---

app.get('/campaigns', async (req, res) => {
    if (!isMockMode) {
        const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    res.json([...mockDb.campaigns].reverse());
});

app.post('/campaigns', async (req, res) => {
    const { name, ig_business_id } = req.body;
    if (!isMockMode) {
        const { data, error } = await supabase.from('campaigns').insert({ name, ig_business_id }).select();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data[0]);
    }
    const newCampaign = { id: mockDb.campaigns.length + 1, name, ig_business_id, active: true, created_at: new Date() };
    mockDb.campaigns.push(newCampaign);
    res.json(newCampaign);
});

app.get('/campaign/:id/participants', async (req, res) => {
    const campaignId = parseInt(req.params.id);
    if (!isMockMode) {
        const { data, error } = await supabase.from('participants').select('*').eq('campaign_id', req.params.id).order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    const participants = mockDb.participants.filter(p => p.campaign_id === campaignId).reverse();
    res.json(participants);
});

app.post('/campaign/:id/pick-winner', async (req, res) => {
    const campaignId = parseInt(req.params.id);
    let participants;

    if (!isMockMode) {
        const { data, error } = await supabase.from('participants').select('username').eq('campaign_id', campaignId);
        if (error) return res.status(500).json({ error: error.message });
        participants = data;
    } else {
        participants = mockDb.participants.filter(p => p.campaign_id === campaignId);
    }

    if (!participants || participants.length === 0) return res.status(404).json({ error: 'No participants found' });

    const winner = participants[Math.floor(Math.random() * participants.length)];

    if (!isMockMode) {
        const { data, error } = await supabase.from('winners').insert({ campaign_id: campaignId, username: winner.username }).select();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data[0]);
    }
    const newWinner = { id: mockDb.winners.length + 1, campaign_id: campaignId, username: winner.username, picked_at: new Date() };
    mockDb.winners.push(newWinner);
    res.json(newWinner);
});

app.get('/campaign/:id/winners', async (req, res) => {
    const campaignId = parseInt(req.params.id);
    if (!isMockMode) {
        const { data, error } = await supabase.from('winners').select('*').eq('campaign_id', req.params.id).order('picked_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    const winners = mockDb.winners.filter(w => w.campaign_id === campaignId).reverse();
    res.json(winners);
});

app.listen(port, () => console.log(`Server running on port ${port}`));

module.exports = { app, isMockMode };
