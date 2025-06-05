// Diagnostic script to check environment variables and configuration
require('dotenv').config();

// Check essential environment variables
const checkEnvironmentVariables = () => {
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_BASIC_PRICE_ID',
    'STRIPE_PREMIUM_PRICE_ID',
    'STRIPE_BASIC_PLAN_ID',
    'STRIPE_PREMIUM_PLAN_ID',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];
  
  const missingVars = [];
  const presentVars = [];
  
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    } else {
      // Show masked value for security
      const value = process.env[varName];
      const maskedValue = value.substring(0, 4) + '...' + value.substring(value.length - 4);
      presentVars.push({ name: varName, value: maskedValue });
    }
  });
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(v => console.error(`   - ${v}`));
  } else {
    console.log('✅ All required environment variables are present');
  }
  
  console.log('\nEnvironment variable values (masked for security):');
  presentVars.forEach(v => console.log(`   - ${v.name}: ${v.value}`));
};

// Check network access to Stripe
const checkStripeAccess = async () => {
  try {
    // Only load Stripe if the API key is present
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ Cannot test Stripe access: STRIPE_SECRET_KEY is missing');
      return;
    }
    
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    // Try to fetch a list of products as a simple test
    console.log('\nTesting connection to Stripe API...');
    const products = await stripe.products.list({ limit: 1 });
    console.log(`✅ Successfully connected to Stripe API. Found ${products.data.length} products.`);
    
    // Check if the price IDs exist
    if (process.env.STRIPE_BASIC_PRICE_ID) {
      try {
        console.log(`\nVerifying Basic price ID: ${process.env.STRIPE_BASIC_PRICE_ID}`);
        const basicPrice = await stripe.prices.retrieve(process.env.STRIPE_BASIC_PRICE_ID);
        console.log(`✅ Basic price exists with currency ${basicPrice.currency} and amount ${basicPrice.unit_amount/100}`);
      } catch (error) {
        console.error(`❌ Error verifying Basic price: ${error.message}`);
      }
    }
    
    if (process.env.STRIPE_PREMIUM_PRICE_ID) {
      try {
        console.log(`\nVerifying Premium price ID: ${process.env.STRIPE_PREMIUM_PRICE_ID}`);
        const premiumPrice = await stripe.prices.retrieve(process.env.STRIPE_PREMIUM_PRICE_ID);
        console.log(`✅ Premium price exists with currency ${premiumPrice.currency} and amount ${premiumPrice.unit_amount/100}`);
      } catch (error) {
        console.error(`❌ Error verifying Premium price: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`❌ Failed to connect to Stripe API: ${error.message}`);
  }
};

// Run diagnostics
const runDiagnostics = async () => {
  console.log('🔍 Starting subscription service diagnostics\n');
  
  checkEnvironmentVariables();
  await checkStripeAccess();
  
  console.log('\n🔍 Diagnostics complete');
};

runDiagnostics().catch(console.error); 