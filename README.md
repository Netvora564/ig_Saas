# Instagram UGC Campaign Tracker

Internal tool for tracking Instagram mentions and managing giveaways.

## Features
- Track brand mentions in public Instagram posts.
- Auto-sync participants every 5 minutes.
- Manual sync trigger.
- Random winner selection per campaign.
- Simple admin dashboard.

## Setup

### Backend (Render)
1. Create a PostgreSQL database on Supabase and run `schema.sql`.
2. Deploy the `backend` folder to Render.
3. Set environment variables:
   - `PORT`: 3000
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_ANON_KEY`: Your Supabase Anon Key
   - `IG_ACCESS_TOKEN`: Your Instagram Graph API Access Token (with `instagram_manage_insights` and `pages_read_engagement` permissions).

### Frontend (GitHub Pages)
1. Update `API_URL` in `frontend/app.js` to your Render backend URL.
2. Deploy the `frontend` folder to GitHub Pages.

## Instagram API Note
Ensure your Instagram Business Account is linked to a Facebook Page and you have a valid Long-Lived Access Token. The tool uses the `/{ig-business-id}/tags` endpoint.
