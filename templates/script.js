document.addEventListener('DOMContentLoaded', function() {
            const registerForm = document.getElementById('registerForm');
            const alertContainer = document.getElementById('alert-container');
            const successAlert = document.getElementById('successAlert');
            const loadingSpinner = document.querySelector('.loading-spinner');
            const searchInput = document.getElementById('searchInput');
            let currentBotId = '';
            let currentModalBotId = '';
            
            // Set today's date and generate bot ID on load
            document.getElementById('manufactured_on').value = new Date().toISOString().split('T')[0];
            generateNewBotId();
            
            // Search functionality
            searchInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                const rows = document.querySelectorAll('#botsTableBody tr');
                const noResults = document.getElementById('noResults');
                let visibleCount = 0;
                
                rows.forEach(row => {
                    const searchData = row.getAttribute('data-searchable');
                    if (searchData && searchData.includes(searchTerm)) {
                        row.style.display = '';
                        visibleCount++;
                    } else {
                        row.style.display = 'none';
                    }
                });
                
                noResults.style.display = visibleCount === 0 && rows.length > 0 ? 'block' : 'none';
            });
            
            // Generate barcode function with label
            function generateBarcode(botId, canvasId, options = {}) {
                const canvas = document.getElementById(canvasId) || document.querySelector(`[data-bot-id="${botId}"]`);
                if (canvas && botId) {
                    const defaultOptions = {
                        format: "CODE128",
                        width: canvasId === 'barcodePreview' ? 1.8 : 1,
                        height: canvasId === 'barcodePreview' ? 60 : 28,
                        displayValue: false,
                        margin: 4,
                        background: "#ffffff",
                        lineColor: "#000000"
                    };
                    
                    JsBarcode(canvas, botId, { ...defaultOptions, ...options });
                    
                    // Update label
                    if (canvasId === 'barcodePreview') {
                        document.getElementById('previewLabel').textContent = botId;
                    }
                }
            }
            
            // Generate all table barcodes
            function generateTableBarcodes() {
                document.querySelectorAll('.table-barcode').forEach(canvas => {
                    const botId = canvas.getAttribute('data-bot-id');
                    if (botId) {
                        generateBarcode(botId, null);
                    }
                });
            }
            
            // Generate new bot ID
            async function generateNewBotId() {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                const suffix = Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                currentBotId = `AGOS-BOT-${suffix}`;
                
                document.getElementById('botIdDisplay').textContent = currentBotId;
                generateBarcode(currentBotId, 'barcodePreview');
            }
            
            // Handle form submission
            registerForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                loadingSpinner.style.display = 'inline-block';
                this.querySelector('button[type="submit"]').disabled = true;
                
                const formData = new FormData(this);
                formData.set('bot_id', currentBotId);
                
                try {
                    const response = await fetch('/api/register', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await response.json();
                    
                    if (data.success) {
                        showSuccessAlert(data.bot);
                        registerForm.reset();
                        document.getElementById('manufactured_on').value = new Date().toISOString().split('T')[0];
                        generateNewBotId();
                        refreshBotsList();
                    } else {
                        showAlert('danger', data.message);
                    }
                } catch (error) {
                    showAlert('danger', 'Error: ' + error.message);
                } finally {
                    loadingSpinner.style.display = 'none';
                    registerForm.querySelector('button[type="submit"]').disabled = false;
                }
            });
            
            // Show success alert
            function showSuccessAlert(bot) {
                document.getElementById('newBotId').textContent = bot.bot_id;
                successAlert.style.display = 'block';
                setTimeout(() => successAlert.style.display = 'none', 5000);
            }
            
            // Refresh bots list
            async function refreshBotsList() {
                try {
                    const response = await fetch('/api/bots');
                    const data = await response.json();
                    if (data.success) {
                        updateBotsTable(data.bots);
                        document.getElementById('botCount').textContent = data.bots.length;
                    }
                } catch (error) {
                    console.error('Error refreshing bots:', error);
                }
            }
            
            // Update bots table
            function updateBotsTable(bots) {
                const tbody = document.getElementById('botsTableBody');
                
                if (bots.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="5">
                                <div class="empty-state">
                                    <i class="bi bi-robot" style="font-size: 2.5rem;"></i>
                                    <p class="mt-3 mb-0">No bots registered yet</p>
                                    <small class="text-muted">Use the Register tab to add your first bot</small>
                                </div>
                            </td>
                        </tr>
                    `;
                    return;
                }
                
                tbody.innerHTML = bots.map(bot => {
                    // Handle date formatting for manufactured_on
                    let dateStr = 'N/A';
                    if (bot.manufactured_on) {
                        if (bot.manufactured_on.seconds) {
                            // Firestore timestamp
                            dateStr = new Date(bot.manufactured_on.seconds * 1000).toLocaleDateString('en-US', {month: '2-digit', day: '2-digit', year: '2-digit'});
                        } else if (typeof bot.manufactured_on === 'string') {
                            // ISO string
                            dateStr = new Date(bot.manufactured_on).toLocaleDateString('en-US', {month: '2-digit', day: '2-digit', year: '2-digit'});
                        }
                    }
                    
                    const searchData = `${bot.bot_id.toLowerCase()} ${(bot.model || '').toLowerCase()} ${dateStr.toLowerCase()}`;
                    
                    return `
                        <tr data-searchable="${searchData}">
                            <td><code class="text-primary fw-bold">${bot.bot_id}</code></td>
                            <td><span class="badge" style="background: var(--primary-blue); color: white;">${bot.model || 'N/A'}</span></td>
                            <td class="text-muted">${dateStr}</td>
                            <td>
                                <div class="barcode-container">
                                    <canvas class="table-barcode" data-bot-id="${bot.bot_id}" style="max-width: 110px; height: 28px;"></canvas>
                                    <div class="barcode-label">${bot.bot_id}</div>
                                </div>
                            </td>
                            <td>
                                <div class="btn-group">
                                    <button class="btn btn-outline-info btn-action" onclick="viewBot('${bot.bot_id}')" title="View Details">
                                        <i class="bi bi-eye"></i>
                                    </button>
                                    <button class="btn btn-outline-success btn-action" onclick="downloadBarcode('${bot.bot_id}')" title="Download Barcode">
                                        <i class="bi bi-download"></i>
                                    </button>
                                    <button class="btn btn-outline-primary btn-action" onclick="printBarcode('${bot.bot_id}')" title="Print Barcode">
                                        <i class="bi bi-printer"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
                
                setTimeout(generateTableBarcodes, 100);
            }
            
            // Show alert message
            function showAlert(type, message) {
                const alert = document.createElement('div');
                alert.className = `alert alert-${type} alert-dismissible fade show`;
                alert.style.fontSize = '0.9rem';
                alert.innerHTML = `
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                `;
                alertContainer.appendChild(alert);
                
                setTimeout(() => {
                    if (alert.parentNode) {
                        alert.remove();
                    }
                }, 5000);
            }
            
            // Global functions for table actions
            window.viewBot = function(botId) {
                fetch(`/api/bot/${botId}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const bot = data.bot;
                        currentModalBotId = bot.bot_id;
                        
                        // Format dates
                        let manufacturedDate = 'N/A';
                        let createdDate = 'N/A';
                        
                        if (bot.manufactured_on) {
                            if (bot.manufactured_on.seconds) {
                                manufacturedDate = new Date(bot.manufactured_on.seconds * 1000).toLocaleDateString();
                            } else if (typeof bot.manufactured_on === 'string') {
                                manufacturedDate = new Date(bot.manufactured_on).toLocaleDateString();
                            }
                        }
                        
                        if (bot.created_at) {
                            if (bot.created_at.seconds) {
                                createdDate = new Date(bot.created_at.seconds * 1000).toLocaleDateString();
                            } else if (typeof bot.created_at === 'string') {
                                createdDate = new Date(bot.created_at).toLocaleDateString();
                            }
                        }
                        
                        document.getElementById('botDetailsContent').innerHTML = `
                            <div class="row">
                                <div class="col-md-5 text-center">
                                    <div class="barcode-preview-container">
                                        <canvas id="modalBarcode" style="max-width: 100%;"></canvas>
                                        <div class="barcode-label mt-2">${bot.bot_id}</div>
                                    </div>
                                </div>
                                <div class="col-md-7">
                                    <table class="table table-borderless">
                                        <tr><td class="fw-bold text-primary">Bot ID:</td><td><code class="fs-6">${bot.bot_id}</code></td></tr>
                                        <tr><td class="fw-bold text-primary">Model:</td><td><span class="badge" style="background: var(--primary-blue);">${bot.model || 'N/A'}</span></td></tr>
                                        <tr><td class="fw-bold text-primary">Manufactured:</td><td>${manufacturedDate}</td></tr>
                                        <tr><td class="fw-bold text-primary">Registered:</td><td>${createdDate}</td></tr>
                                        <tr><td class="fw-bold text-primary">Status:</td><td><span class="badge bg-success">Active</span></td></tr>
                                    </table>
                                    ${bot.notes ? `
                                        <div class="mt-3">
                                            <h6 class="fw-bold text-primary">Notes:</h6>
                                            <p class="text-muted">${bot.notes}</p>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                        
                        new bootstrap.Modal(document.getElementById('botDetailsModal')).show();
                        setTimeout(() => {
                            generateBarcode(bot.bot_id, 'modalBarcode', {
                                width: 2,
                                height: 80,
                                margin: 8
                            });
                        }, 300);
                    }
                })
                .catch(error => console.error('Error:', error));
            };
            
            window.downloadBarcode = function(botId) {
                const canvas = document.createElement('canvas');
                JsBarcode(canvas, botId, {
                    format: "CODE128",
                    width: 2,
                    height: 100,
                    displayValue: true,
                    fontSize: 16,
                    margin: 15,
                    background: "#ffffff",
                    lineColor: "#000000"
                });
                
                const link = document.createElement('a');
                link.download = `${botId}_barcode.png`;
                link.href = canvas.toDataURL();
                link.click();
            };
            
            window.printBarcode = function(botId) {
                const canvas = document.createElement('canvas');
                JsBarcode(canvas, botId, {
                    format: "CODE128",
                    width: 3,
                    height: 120,
                    displayValue: true,
                    fontSize: 18,
                    margin: 20,
                    background: "#ffffff",
                    lineColor: "#000000"
                });
                
                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <html>
                        <head><title>Print Barcode - ${botId}</title></head>
                        <body style="margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh;">
                            <div style="text-align: center;">
                                <h2 style="font-family: Arial, sans-serif; margin-bottom: 20px;">AGOS Bot Barcode</h2>
                                <img src="${canvas.toDataURL()}" style="max-width: 100%;">
                                <p style="font-family: 'Courier New', monospace; margin-top: 15px; font-size: 14px;">${botId}</p>
                            </div>
                        </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.print();
            };
            
            // Modal print button
            document.getElementById('printModalBarcode').addEventListener('click', function() {
                if (currentModalBotId) {
                    printBarcode(currentModalBotId);
                }
            });
            
            document.getElementById('refreshBots').addEventListener('click', refreshBotsList);
            setTimeout(generateTableBarcodes, 500);
        });