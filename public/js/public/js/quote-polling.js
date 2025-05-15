// This file should be included in your view.html or similar page

// Start polling when the page loads with a quote ID
document.addEventListener('DOMContentLoaded', function() {
  // Get the quote ID from the URL or a data attribute
  const urlParams = new URLSearchParams(window.location.search);
  const quoteId = urlParams.get('id');
  
  if (quoteId) {
    console.log(`Starting polling for quote ${quoteId}`);
    
    // Show loading state
    const productsContainer = document.getElementById('products-container');
    if (productsContainer) {
      productsContainer.innerHTML = '<div class="loading">Processing your quote... Please wait.</div>';
    }
    
    // Start polling
    pollForResults(quoteId);
  }
});

function pollForResults(quoteId) {
  console.log(`Polling for quote ${quoteId} results...`);
  
  fetch(`/api/quotes/${quoteId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("Poll response:", data);
      
      if (data.processingComplete) {
        console.log("Processing complete, displaying results");
        displayProducts(data.products);
      } else {
        console.log("Still processing, will poll again in 2 seconds");
        // Continue polling
        setTimeout(() => pollForResults(quoteId), 2000);
      }
    })
    .catch(error => {
      console.error("Error polling for results:", error);
      // Still try again
      setTimeout(() => pollForResults(quoteId), 2000);
    });
}

function displayProducts(products) {
  const container = document.getElementById('products-container');
  if (!container) return;
  
  container.innerHTML = ''; // Clear existing content
  
  if (!products || products.length === 0) {
    container.innerHTML = '<div class="no-products">No products found.</div>';
    return;
  }
  
  const table = document.createElement('table');
  table.className = 'products-table';
  
  // Add table header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>SKU</th>
      <th>Description</th>
      <th>Unit Price</th>
      <th>Available Quantity</th>
    </tr>
  `;
  table.appendChild(thead);
  
  // Add table body with products
  const tbody = document.createElement('tbody');
  products.forEach(product => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${product.sku}</td>
      <td>${product.description}</td>
      <td>${product.unitPrice}</td>
      <td>${product.availableQuantity}</td>
    `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  
  container.appendChild(table);
}
