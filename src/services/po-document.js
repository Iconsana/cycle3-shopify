import { CompanyInfo } from '../models/companyInfo.js';

/**
 * Generates HTML for a purchase order
 * @param {Object} po - Purchase order data
 * @param {string} shop - Shop domain
 * @returns {Promise<string>} - HTML document
 */
export const generatePOHtml = async (po, shop) => {
  try {
    // Get company info
    const companyInfo = await CompanyInfo.findOne({ shopDomain: shop });
    
    if (!companyInfo) {
      throw new Error('Company information not found');
    }
    
    // Calculate totals
    const subtotal = po.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1; // Assuming 10% tax, this should be configurable
    const total = subtotal + tax;
    
    // Generate HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Purchase Order ${po.poNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: #333;
          }
          .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .logo {
            max-width: 200px;
            max-height: 100px;
          }
          .po-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #2a5885;
          }
          .po-number {
            font-size: 16px;
            margin-bottom: 20px;
          }
          .section {
            margin-bottom: 20px;
          }
          .section-title {
            font-weight: bold;
            margin-bottom: 5px;
            border-bottom: 1px solid #ddd;
          }
          .address {
            margin-bottom: 15px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
          }
          .totals {
            width: 300px;
            margin-left: auto;
          }
          .totals td:first-child {
            text-align: right;
            font-weight: bold;
          }
          .footer {
            margin-top: 30px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="po-title">PURCHASE ORDER</div>
            <div class="po-number">PO Number: ${po.poNumber}</div>
            <div>Date: ${new Date().toLocaleDateString()}</div>
          </div>
          ${companyInfo.logo ? `<img src="${companyInfo.logo}" class="logo" alt="Company Logo">` : ''}
        </div>
        
        <div class="section">
          <div class="section-title">FROM:</div>
          <div class="address">
            <div><strong>${companyInfo.name}</strong></div>
            <div>${companyInfo.address}</div>
            <div>${companyInfo.city}, ${companyInfo.state} ${companyInfo.zipCode}</div>
            <div>${companyInfo.country}</div>
            <div>Phone: ${companyInfo.phone || 'N/A'}</div>
            <div>Email: ${companyInfo.email}</div>
            ${companyInfo.vatNumber ? `<div>VAT: ${companyInfo.vatNumber}</div>` : ''}
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">TO:</div>
          <div class="address">
            <div><strong>${po.supplierName}</strong></div>
            ${po.supplierAddress ? `<div>${po.supplierAddress}</div>` : ''}
            ${po.supplierEmail ? `<div>Email: ${po.supplierEmail}</div>` : ''}
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">ORDER DETAILS:</div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${po.items.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.productName}</td>
                  <td>${item.quantity}</td>
                  <td>${companyInfo.poSettings.defaultCurrency} ${item.price.toFixed(2)}</td>
                  <td>${companyInfo.poSettings.defaultCurrency} ${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <table class="totals">
            <tr>
              <td>Subtotal:</td>
              <td>${companyInfo.poSettings.defaultCurrency} ${subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Tax (10%):</td>
              <td>${companyInfo.poSettings.defaultCurrency} ${tax.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Total:</td>
              <td>${companyInfo.poSettings.defaultCurrency} ${total.toFixed(2)}</td>
            </tr>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title">PAYMENT TERMS:</div>
          <div>${companyInfo.poSettings.defaultPaymentTerms}</div>
        </div>
        
        <div class="footer">
          <div class="section-title">TERMS AND CONDITIONS:</div>
          <div>${companyInfo.poSettings.termsAndConditions}</div>
        </div>
      </body>
      </html>
    `;
    
    return html;
  } catch (error) {
    console.error('Error generating PO HTML:', error);
    throw error;
  }
};

/**
 * Creates a PDF from HTML
 * Note: For a full implementation, you'll need to add a PDF generation library like puppeteer or html-pdf
 * @param {string} html - HTML content
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generatePOPdf = async (html) => {
  // For MVP, return the HTML directly
  // In a full implementation, convert HTML to PDF
  return Buffer.from(html);
};

// Export routes for PO document API
export const addPODocumentRoutes = (app) => {
  // Get PO as HTML
  app.get('/api/purchase-orders/:poNumber/html', async (req, res) => {
    try {
      const { poNumber } = req.params;
      const { shop } = req.query;
      
      if (!shop) {
        return res.status(400).json({
          error: 'Missing shop parameter'
        });
      }
      
      // Find PO in memory or database
      const po = app.locals.purchaseOrders.find(p => p.poNumber === poNumber);
      
      if (!po) {
        return res.status(404).json({
          error: 'Purchase order not found'
        });
      }
      
      const html = await generatePOHtml(po, shop);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error('Error generating PO HTML:', error);
      res.status(500).json({
        error: 'Failed to generate PO document',
        message: error.message
      });
    }
  });
  
  // Get PO as PDF
  app.get('/api/purchase-orders/:poNumber/pdf', async (req, res) => {
    try {
      const { poNumber } = req.params;
      const { shop } = req.query;
      
      if (!shop) {
        return res.status(400).json({
          error: 'Missing shop parameter'
        });
      }
      
      // Find PO in memory or database
      const po = app.locals.purchaseOrders.find(p => p.poNumber === poNumber);
      
      if (!po) {
        return res.status(404).json({
          error: 'Purchase order not found'
        });
      }
      
      const html = await generatePOHtml(po, shop);
      const pdf = await generatePOPdf(html);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="PO-${poNumber}.pdf"`);
      res.send(pdf);
    } catch (error) {
      console.error('Error generating PO PDF:', error);
      res.status(500).json({
        error: 'Failed to generate PO document',
        message: error.message
      });
    }
  });
};
