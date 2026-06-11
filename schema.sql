-- Create campaigns table
CREATE TABLE campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    ig_business_id TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create participants table
CREATE TABLE participants (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    media_id TEXT NOT NULL,
    media_url TEXT,
    permalink TEXT,
    timestamp TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaign_id, media_id)
);

-- Create winners table
CREATE TABLE winners (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    picked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
