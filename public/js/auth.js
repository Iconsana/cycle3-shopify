// public/js/auth.js
const checkAuthStatus = async () => {
  try {
    const response = await fetch('/auth/status');
    const data = await response.json();
    
    if (!data.authenticated) {
      // Redirect to auth page if not authenticated
      const shopParam = new URLSearchParams(window.location.search).get('shop');
      const shop = shopParam || 'cycle1-test.myshopify.com'; // Default or from URL
      window.location.href = `/auth?shop=${shop}`;
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Auth check failed:', error);
    return false;
  }
};

// Check auth on page load
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthenticated = await checkAuthStatus();
  
  if (isAuthenticated) {
    // Initialize app components
    initializeApp();
  }
});
