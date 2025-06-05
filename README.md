# AI Video Creator - Subscription-Based Tool

A powerful AI-powered tool for generating images and videos using RunwayML and Google Gemini, with subscription-based access tiers.

## Features

- **Text-to-Image Generation**: Create stunning images from text prompts using Google Gemini
- **Text-to-Video Generation**: Generate videos directly from text descriptions using RunwayML
- **Image-to-Video Generation**: Transform static images into dynamic videos with RunwayML
- **Subscription Tiers**: Free, Basic, and Premium plans with different usage limits and features
- **User Authentication**: Secure login and account management with Supabase
- **Usage Tracking**: Monitor daily usage limits based on subscription tier

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, Radix UI
- **Backend**: Express.js, TypeScript
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **AI Services**: RunwayML SDK, Google Gemini API

## Setup

### Prerequisites

- Node.js 18+ and pnpm
- Supabase account
- RunwayML API key
- Google Gemini API key

### Environment Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your API keys and Supabase credentials
3. Copy `server/.env.example` to `server/.env` and fill in your API keys and Supabase service key

### Database Setup

Create the following tables in your Supabase project:

#### Subscriptions Table
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Usage Table
```sql
CREATE TABLE usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL,
  date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Installation

```bash
# Install dependencies for frontend
pnpm install

# Install dependencies for backend
cd server
pnpm install
cd ..
```

### Running the Application

```bash
# Start the frontend development server
pnpm dev

# In a separate terminal, start the backend server
cd server
pnpm start
```

## Subscription Tiers

### Free Tier
- 5 images per day
- 2 videos per day
- 5-second maximum video length
- Standard quality generation

### Basic Tier ($9.99/month)
- 20 images per day
- 10 videos per day
- 10-second maximum video length
- Standard quality generation

### Premium Tier ($19.99/month)
- 100 images per day
- 30 videos per day
- 30-second maximum video length
- High quality generation

## API Endpoints

### Authentication
- Handled by Supabase Auth

### Content Generation
- `POST /api/generate-video-from-image/runway`: Generate video from an image
- `POST /api/generate-video-from-text/runway`: Generate video from text
- `GET /api/subscription`: Get user's subscription details and usage statistics
