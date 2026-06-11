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
const isMockMode = !supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder') || !process.env.SUPABASE_URL;

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
    res.json({
        system: 'ig_SaaS',
        message: 'Instagram UGC Campaign Tracker API',
        mode: isMockMode ? 'mock' : 'production'
    });
});

// --- Core Logic ---

const syncCampaigns = async () => {
    console.log('Starting sync process...');
    let campaigns;

    try {
        if (!isMockMode) {
            const { data, error } = await supabase.from('campaigns').select('*').eq('active', true);
            if (error) throw error;
            campaigns = data;
        } else {
            campaigns = mockDb.campaigns.filter(c => c.active);
        }

        for (const campaign of campaigns) {
            console.log(`Syncing campaign: ${campaign.name}`);
            let taggedMedia = [];

            if (!isMockMode && process.env.IG_ACCESS_TOKEN) {
                let nextUrl = `https://graph.facebook.com/v19.0/${campaign.ig_business_id}/tags?fields=id,media_type,media_url,timestamp,username&limit=50&access_token=${process.env.IG_ACCESS_TOKEN}`;

                while (nextUrl) {
                    const response = await axios.get(nextUrl);
                    taggedMedia = taggedMedia.concat(response.data.data || []);
                    nextUrl = response.data.paging && response.data.paging.next ? response.data.paging.next : null;
                    if (taggedMedia.length > 500) break;
                }
            } else if (isMockMode) {
                const randomId = Date.now();
                taggedMedia = [
                    { id: `m${randomId}1`, username: 'ig_fan_01', media_url: 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=300', timestamp: new Date().toISOString() },
                    { id: `m${randomId}2`, username: 'content_creator', media_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300', timestamp: new Date().toISOString() }
                ];
            }

            for (const media of taggedMedia) {
                if (!isMockMode) {
                    await supabase.from('participants').upsert({
                        campaign_id: campaign.id,
                        username: media.username,
                        media_id: media.id,
                        media_url: media.media_url,
                        timestamp: media.timestamp
                    }, { onConflict: 'campaign_id,media_id' });
                } else {
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
        console.log('Sync completed.');
    } catch (err) {
        console.error('Sync Error:', err.message);
    }
};

app.get('/sync', async (req, res) => {
    await syncCampaigns();
    res.json({ status: 'success', message: 'Sync completed' });
});

cron.schedule('*/5 * * * *', () => syncCampaigns());

// --- API Endpoints ---

app.get('/campaigns', async (req, res) => {
    try {
        if (!isMockMode) {
            const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return res.json(data);
        }
        res.json([...mockDb.campaigns].reverse());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/campaigns', async (req, res) => {
    const { name, ig_business_id } = req.body;
    try {
        if (!isMockMode) {
            const { data, error } = await supabase.from('campaigns').insert({ name, ig_business_id }).select();
            if (error) throw error;
            return res.json(data[0]);
        }
        const newCampaign = { id: mockDb.campaigns.length + 1, name, ig_business_id, active: true, created_at: new Date() };
        mockDb.campaigns.push(newCampaign);
        res.json(newCampaign);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/campaign/:id/participants', async (req, res) => {
    const campaignId = parseInt(req.params.id);
    try {
        if (!isMockMode) {
            const { data, error } = await supabase.from('participants').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false });
            if (error) throw error;
            return res.json(data);
        }
        const participants = mockDb.participants.filter(p => p.campaign_id === campaignId).reverse();
        res.json(participants);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/campaign/:id/pick-winner', async (req, res) => {
    const campaignId = parseInt(req.params.id);
    try {
        let participants;
        if (!isMockMode) {
            const { data, error } = await supabase.from('participants').select('username').eq('campaign_id', campaignId);
            if (error) throw error;
            participants = data;
        } else {
            participants = mockDb.participants.filter(p => p.campaign_id === campaignId);
        }

        if (!participants || participants.length === 0) return res.status(404).json({ error: 'No participants found' });

        const winner = participants[Math.floor(Math.random() * participants.length)];

        if (!isMockMode) {
            const { data, error } = await supabase.from('winners').insert({ campaign_id: campaignId, username: winner.username }).select();
            if (error) throw error;
            return res.json(data[0]);
        }
        const newWinner = { id: mockDb.winners.length + 1, campaign_id: campaignId, username: winner.username, picked_at: new Date() };
        mockDb.winners.push(newWinner);
        res.json(newWinner);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/campaign/:id/winners', async (req, res) => {
    const campaignId = parseInt(req.params.id);
    try {
        if (!isMockMode) {
            const { data, error } = await supabase.from('winners').select('*').eq('campaign_id', campaignId).order('picked_at', { ascending: false });
            if (error) throw error;
            return res.json(data);
        }
        const winners = mockDb.winners.filter(w => w.campaign_id === campaignId).reverse();
        res.json(winners);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/campaign/:id/manual-import', async (req, res) => {
    const campaignId = parseInt(req.params.id);
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        // Simple extraction for mock mode
        const shortcode = url.split('/p/')[1]?.split('/')[0] || 'manual';
        const mockUsername = `user_${shortcode.substring(0, 5)}`;
        const mockMediaId = `m_manual_${shortcode}`;
        const mockMediaUrl = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=300';

        if (!isMockMode) {
            const { data, error } = await supabase.from('participants').upsert({
                campaign_id: campaignId,
                username: mockUsername,
                media_id: mockMediaId,
                media_url: mockMediaUrl,
                timestamp: new Date().toISOString()
            }, { onConflict: 'campaign_id,media_id' }).select();
            if (error) throw error;
            return res.json(data[0]);
        }

        const existing = mockDb.participants.find(p => p.media_id === mockMediaId);
        if (existing) return res.json(existing);

        const newParticipant = {
            id: mockDb.participants.length + 1,
            campaign_id: campaignId,
            username: mockUsername,
            media_id: mockMediaId,
            media_url: mockMediaUrl,
            timestamp: new Date().toISOString(),
            created_at: new Date()
        };
        mockDb.participants.push(newParticipant);
        res.json(newParticipant);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => console.log(`[ig_SaaS] Server running on port ${port} (${isMockMode ? 'MOCK' : 'PROD'})`));
