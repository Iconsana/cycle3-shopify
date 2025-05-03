import React, { useState } from 'react';

const FallbackVisualization = () => {
  // Sample data for demonstration
  const [suppliers, setSuppliers] = useState([
    { id: 1, name: "Primary Supplier", priority: 1, price: 120, stockLevel: 8, leadTime: 2 },
    { id: 2, name: "Secondary Supplier", priority: 2, price: 130, stockLevel: 15, leadTime: 3 },
    { id: 3, name: "Backup Supplier", priority: 3, price: 145, stockLevel: 50, leadTime: 7 }
  ]);
  
  const [orderQuantity, setOrderQuantity] = useState(10);
  const [showSimulation, setShowSimulation] = useState(false);
  
  // Update supplier stock level
  const updateStock = (id, newStock) => {
    setSuppliers(suppliers.map(s => 
      s.id === id ? {...s, stockLevel: parseInt(newStock) || 0} : s
    ));
  };
  
  // Logic to determine which supplier to use (simplified version of the service)
  const determineSupplier = () => {
    // Sort by priority
    const sorted = [...suppliers].sort((a, b) => a.priority - b.priority);
    
    // First try to find supplier with enough stock
    const sufficientStock = sorted.find(s => s.stockLevel >= orderQuantity);
    if (sufficientStock) return sufficientStock;
    
    // Next try to find supplier with any stock
    const anyStock = sorted.find(s => s.stockLevel > 0);
    if (anyStock) return anyStock;
    
    // Fallback to highest priority
    return sorted[0];
  };
  
  // Allocate across multiple suppliers
  const allocateOrder = () => {
    const sorted = [...suppliers].sort((a, b) => a.priority - b.priority);
    let remaining = orderQuantity;
    const allocation = [];
    
    // First allocate from suppliers with stock
    for (const supplier of sorted) {
      if (remaining <= 0) break;
      
      const available = Math.min(supplier.stockLevel, remaining);
      if (available > 0) {
        allocation.push({
          id: supplier.id,
          name: supplier.name,
          quantity: available,
          isBackorder: false
        });
        
        remaining -= available;
      }
    }
    
    // If still needed, create backorder for first supplier
    if (remaining > 0 && sorted.length > 0) {
      allocation.push({
        id: sorted[0].id,
        name: sorted[0].name,
        quantity: remaining,
        isBackorder: true
      });
    }
    
    return allocation;
  };
  
  // Selected supplier based on current settings
  const selectedSupplier = determineSupplier();
  const allocation = allocateOrder();

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Supplier Fallback Visualization</h1>
      
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Configure Scenario</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Order Quantity</label>
          <input 
            type="number" 
            min="1" 
            value={orderQuantity} 
            onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
            className="w-24 p-2 border rounded"
          />
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Supplier</th>
                <th className="border p-2">Priority</th>
                <th className="border p-2">Price</th>
                <th className="border p-2">Stock Level</th>
                <th className="border p-2">Lead Time</th>
                <th className="border p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(supplier => (
                <tr key={supplier.id} className={supplier.id === selectedSupplier.id ? 'bg-green-50' : ''}>
                  <td className="border p-2">{supplier.name}</td>
                  <td className="border p-2">{supplier.priority}</td>
                  <td className="border p-2">R{supplier.price.toFixed(2)}</td>
                  <td className="border p-2">
                    <input 
                      type="number" 
                      min="0" 
                      value={supplier.stockLevel} 
                      onChange={(e) => updateStock(supplier.id, e.target.value)}
                      className="w-16 p-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">{supplier.leadTime} days</td>
                  <td className="border p-2">
                    <button 
                      onClick={() => updateStock(supplier.id, 0)}
                      className="text-xs bg-red-500 text-white px-2 py-1 rounded"
                    >
                      Set Out of Stock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Results</h2>
        
        <div className="p-4 rounded border bg-blue-50">
          <p className="font-medium">
            When a customer orders {orderQuantity} units:
          </p>
          
          <div className="mt-3">
            {allocation.length === 0 ? (
              <p>No suppliers available to fulfill this order.</p>
            ) : allocation.length === 1 ? (
              <div>
                <p>
                  This order will be fulfilled by <strong>{allocation[0].name}</strong> 
                  {allocation[0].isBackorder ? ' (backordered)' : ''}
                </p>
              </div>
            ) : (
              <div>
                <p className="mb-2">This order will be split across multiple suppliers:</p>
                <ul className="list-disc pl-5">
                  {allocation.map((item, index) => (
                    <li key={index}>
                      {item.quantity} units from {item.name}
                      {item.isBackorder ? ' (backordered)' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div>
        <button 
          onClick={() => setShowSimulation(!showSimulation)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          {showSimulation ? 'Hide Simulation' : 'Show Simulation'}
        </button>
        
        {showSimulation && (
          <div className="mt-4">
            <h2 className="text-lg font-semibold mb-3">Simulated Customer Experience</h2>
            
            <div className="border rounded p-4 bg-gray-50">
              {allocation.some(item => item.isBackorder) ? (
                <div>
                  <div className="mb-3 p-3 bg-yellow-100 rounded border border-yellow-200">
                    <p className="font-medium">Some items in your order are not in stock.</p>
                    <p className="text-sm mt-1">
                      Your order will ship partially now, with the remainder shipping when it becomes available.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded p-3">
                      <h4 className="font-medium">Shipping Now</h4>
                      <ul className="mt-2 space-y-1">
                        {allocation.filter(a => !a.isBackorder).map((item, i) => (
                          <li key={i}>{item.quantity} units</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="border rounded p-3">
                      <h4 className="font-medium">Shipping Later</h4>
                      <ul className="mt-2 space-y-1">
                        {allocation.filter(a => a.isBackorder).map((item, i) => (
                          <li key={i}>{item.quantity} units (estimated 10-14 days)</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-green-100 rounded border border-green-200">
                  <p className="font-medium">All items in your order are in stock!</p>
                  <p className="text-sm mt-1">
                    Your order of {orderQuantity} units will ship within 1-2 business days.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FallbackVisualization;
