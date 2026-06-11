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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.get('/', (req, res) => {
    res.json({ message: 'Instagram UGC Campaign Tracker API' });
});

const syncCampaigns = async () => {
    console.log('Starting sync process...');
    const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('active', true);

    if (error) {
        console.error('Error fetching active campaigns:', error);
        return;
    }

    for (const campaign of campaigns) {
        try {
            console.log(`Syncing campaign: ${campaign.name} (${campaign.ig_business_id})`);
            const igAccessToken = process.env.IG_ACCESS_TOKEN;
            const url = `https://graph.facebook.com/v19.0/${campaign.ig_business_id}/tags?fields=id,media_type,media_url,timestamp,username&access_token=${igAccessToken}`;

            const response = await axios.get(url);
            const taggedMedia = response.data.data;

            if (taggedMedia && taggedMedia.length > 0) {
                for (const media of taggedMedia) {
                    const { error: insertError } = await supabase
                        .from('participants')
                        .insert({
                            campaign_id: campaign.id,
                            username: media.username,
                            media_id: media.id,
                            media_url: media.media_url,
                            timestamp: media.timestamp
                        });

                    if (insertError && insertError.code !== '23505') { // Ignore unique constraint violation
                        console.error(`Error inserting participant for media ${media.id}:`, insertError);
                    }
                }
            }
            console.log(`Successfully synced campaign: ${campaign.name}`);
        } catch (err) {
            console.error(`Failed to sync campaign ${campaign.name}:`, err.message);
        }
    }
    console.log('Sync process completed.');
};

app.get('/sync', async (req, res) => {
    try {
        await syncCampaigns();
        res.json({ message: 'Sync completed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Run every 5 minutes
cron.schedule('*/5 * * * *', () => {
    syncCampaigns();
});

// Campaign Management
app.get('/campaigns', async (req, res) => {
    const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/campaigns', async (req, res) => {
    const { name, ig_business_id } = req.body;
    const { data, error } = await supabase
        .from('campaigns')
        .insert({ name, ig_business_id })
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data[0]);
});

app.get('/campaign/:id/participants', async (req, res) => {
    const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('campaign_id', req.params.id)
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/campaign/:id/pick-winner', async (req, res) => {
    const campaignId = req.params.id;

    // Fetch all participants
    const { data: participants, error: pError } = await supabase
        .from('participants')
        .select('username')
        .eq('campaign_id', campaignId);

    if (pError) return res.status(500).json({ error: pError.message });
    if (!participants || participants.length === 0) return res.status(404).json({ error: 'No participants found for this campaign' });

    // Random selection
    const randomIndex = Math.floor(Math.random() * participants.length);
    const winner = participants[randomIndex];

    // Save winner
    const { data: wData, error: wError } = await supabase
        .from('winners')
        .insert({
            campaign_id: campaignId,
            username: winner.username
        })
        .select();

    if (wError) return res.status(500).json({ error: wError.message });
    res.json(wData[0]);
});

app.get('/campaign/:id/winners', async (req, res) => {
    const { data, error } = await supabase
        .from('winners')
        .select('*')
        .eq('campaign_id', req.params.id)
        .order('picked_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

module.exports = { app, supabase };
