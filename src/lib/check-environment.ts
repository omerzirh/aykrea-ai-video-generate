// Check for required environment variables in the frontend
export const checkEnvironment = () => {
  const requiredVars = [
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];
  
  const missing: string[] = [];
  
  requiredVars.forEach(varName => {
    if (!import.meta.env[varName]) {
      missing.push(varName);
    }
  });
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    return false;
  }
  
  return true;
};

// Function to alert user about missing environment variables
export const displayEnvironmentWarning = () => {
  const missingEnvMessage = `
    ⚠️ Missing environment variables. Please create a .env file in your project root with the following:
    
    VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
    
    Get this key from your Stripe Dashboard.
  `;
  
  console.error(missingEnvMessage);
  
  // Return a formatted message for UI display
  return {
    title: "Environment Setup Incomplete",
    message: "Missing Stripe API keys. Check console for details on how to fix this."
  };
};

// Validate Stripe environment
export const validateStripeEnvironment = () => {
  const stripePubKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  
  if (!stripePubKey) {
    console.error("Missing VITE_STRIPE_PUBLISHABLE_KEY environment variable");
    return {
      valid: false,
      message: "Missing Stripe publishable key. Add it to your .env file."
    };
  }
  
  // Check if the key format looks valid (starts with pk_)
  if (!stripePubKey.startsWith('pk_')) {
    console.error("Invalid Stripe publishable key format. Should start with 'pk_'");
    return {
      valid: false,
      message: "Invalid Stripe publishable key format. Should start with 'pk_'"
    };
  }
  
  return {
    valid: true,
    message: "Stripe environment is properly configured"
  };
}; 