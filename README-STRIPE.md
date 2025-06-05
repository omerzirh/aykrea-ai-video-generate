# Stripe Integration for AI Video Generator

This document explains how to set up and use the Stripe integration for subscription management in the AI Video Generator application.

## Overview

The application uses Stripe for handling subscription payments and managing subscription tiers. Users can subscribe to different plans (Basic or Premium) to get access to more features and higher usage limits.

## Setup Instructions

### 1. Create a Stripe Account

If you don't already have one, create a Stripe account at [stripe.com](https://stripe.com).

### 2. Get API Keys

In your Stripe Dashboard:
1. Go to Developers > API keys
2. Copy your Publishable Key and Secret Key
3. Add them to your environment variables:
   - `VITE_STRIPE_PUBLISHABLE_KEY` (for client-side)
   - `STRIPE_SECRET_KEY` (for server-side)

### 3. Create Products and Prices

In your Stripe Dashboard:
1. Go to Products > Add Product
2. Create two subscription products:
   - Basic Plan ($9.99/month)
   - Premium Plan ($19.99/month)
3. For each product, create a recurring price
4. Copy the Price IDs and add them to your environment variables:
   - `STRIPE_BASIC_PLAN_ID`
   - `STRIPE_PREMIUM_PLAN_ID`

### 4. Set Up Webhook

1. Go to Developers > Webhooks
2. Add an endpoint with your server URL + `/api/webhook`
3. Select these events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the Webhook Secret and add it to your environment variables:
   - `STRIPE_WEBHOOK_SECRET`

### 5. Run Database Migrations

Execute the SQL migration file to create the necessary database tables:

```bash
psql -U your_db_user -d your_db_name -f database/migrations/01_add_stripe_tables.sql
```

Or run the SQL commands directly in your Supabase SQL Editor.

## How It Works

### Subscription Flow

1. User selects a subscription plan
2. They are redirected to Stripe Checkout
3. After successful payment, they are redirected back to the application
4. Stripe sends a webhook event to our server
5. The server updates the user's subscription in the database
6. User now has access to the features of their subscription tier

### Managing Subscriptions

Users can manage their subscriptions through:
1. The "Manage Billing" button in their dashboard, which redirects to the Stripe Customer Portal
2. The "Change Plan" button to upgrade or downgrade their subscription

### Subscription Data

The application stores subscription data in two tables:
- `subscriptions`: Stores the user's current subscription tier and limits
- `stripe_customers`: Links Supabase user IDs with Stripe customer IDs

## Testing

For testing purposes, you can use Stripe's test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

## Troubleshooting

If subscriptions aren't updating correctly:
1. Check the server logs for webhook errors
2. Verify that your webhook endpoint is accessible from the internet
3. Ensure your Stripe API keys and webhook secret are correct
4. Check that the database tables and columns were created correctly
