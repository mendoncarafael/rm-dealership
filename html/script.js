// RM Dealership - Concessionária Premium JavaScript
class RMDealership {
    constructor() {
        this.vehicles = [];
        this.filteredVehicles = [];
        this.currentCategory = 'all';
        this.currentView = 'grid';
        this.maxPrice = 5000000;
        this.sortBy = 'name';
        this.searchQuery = '';
        this.isAdmin = false;
        this.playerMoney = 0;
        this.vipInfo = {
            hasVip: false,
            vipType: null,
            vipDiscount: 0
        };
        this.ownedVehicles = {}; // Track player's owned vehicles
        this.language = null; // Will be set by server
        this.translations = {};
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        // Don't show anything automatically - wait for openDealership message
    }

    // Translation function
    getTranslation(key, ...args) {
        let translation = this.translations[key] || key;
        if (args.length > 0) {
            // Replace %s placeholders with arguments
            args.forEach((arg, index) => {
                translation = translation.replace('%s', arg);
            });
        }
        return translation;
    }

    // Set language and translations
    setLanguage(language, translations) {
        this.language = language;
        this.translations = translations || {};
        this.updateUILanguage();
    }

    // Update UI elements with translations
    updateUILanguage() {
        // Update all elements with data-translate attribute
        const translatableElements = document.querySelectorAll('[data-translate]');
        translatableElements.forEach(element => {
            const key = element.getAttribute('data-translate');
            const translation = this.getTranslation(key);
            
            // Handle different element types
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                // Don't change input values, only placeholder if specified
                return;
            } else if (element.tagName === 'OPTION') {
                element.textContent = translation;
            } else if (element.tagName === 'TITLE') {
                element.textContent = translation;
                document.title = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Update placeholder attributes
        const placeholderElements = document.querySelectorAll('[data-translate-placeholder]');
        placeholderElements.forEach(element => {
            const key = element.getAttribute('data-translate-placeholder');
            const translation = this.getTranslation(key);
            element.placeholder = translation;
        });

        // Update specific dynamic content
        this.updateCategoryTitles();
        this.updateSelectOptions();
        
        // Update current section title if needed
        if (this.currentCategory === 'all') {
            document.getElementById('sectionTitle').textContent = this.getTranslation('all_vehicles');
        } else {
            document.getElementById('sectionTitle').textContent = this.getTranslation(this.currentCategory);
        }
    }

    // Update category titles in the translation system
    updateCategoryTitles() {
        const categoryMapping = {
            'all': 'all_vehicles',
            'compacts': 'compacts',
            'sedans': 'sedans',
            'suvs': 'suvs',
            'coupes': 'coupes',
            'muscle': 'muscle',
            'sportsclassics': 'sports_classics',
            'sports': 'sports',
            'super': 'super',
            'motorcycles': 'motorcycles',
            'offroad': 'off_road'
        };

        Object.keys(categoryMapping).forEach(category => {
            const elements = document.querySelectorAll(`[data-category="${category}"] span[data-translate]`);
            elements.forEach(element => {
                element.textContent = this.getTranslation(categoryMapping[category]);
            });
        });
    }

    // Update select option translations
    updateSelectOptions() {
        const selectElements = document.querySelectorAll('select option[data-translate]');
        selectElements.forEach(option => {
            const key = option.getAttribute('data-translate');
            option.textContent = this.getTranslation(key);
        });
    }

    // Handle server messages with language support
    handleServerMessage(data) {
        switch(data.action) {
            case 'openDealership':
                this.vehicles = data.vehicles || [];
                this.categories = data.categories || {};
                this.playerMoney = data.playerMoney || 0;
                this.vipInfo = data.vipInfo || { hasVip: false, vipType: null, vipDiscount: 0 };
                this.isAdmin = data.isAdmin || false;
                this.ownedVehicles = data.ownedVehicles || {};
                
                // Set language and translations
                if (data.language && data.translations) {
                    this.setLanguage(data.language, data.translations);
                }
                
                this.updatePlayerMoney();
                this.showApp();
                this.filterAndDisplayVehicles();
                this.updateCategoryCounts();
                break;
                
            // Admin functionality disabled
            /*
            case 'openAdmin':
                this.vehicles = data.vehicles || [];
                this.categories = data.categories || {};
                
                // Set language for admin panel
                if (data.language && data.translations) {
                    this.setLanguage(data.language, data.translations);
                }
                
                this.openAdminPanel();
                break;
            */
                
            case 'closeDealership':
                this.hideApp();
                break;
                
            case 'updateVehicles':
                this.vehicles = data.vehicles || [];
                this.filterAndDisplayVehicles();
                this.updateCategoryCounts();
                break;
        }
    }

    showApp() {
        const appElement = document.getElementById('app');
        if (appElement) {
            appElement.classList.remove('hidden');
            appElement.style.display = ''; // Remove any inline display style
        }
    }

    hideApp() {
        // Force hide the app element
        const appElement = document.getElementById('app');
        if (appElement) {
            appElement.classList.add('hidden');
            appElement.style.display = 'none'; // Force hide with CSS as backup
        }
        
        // Close all modals
        this.closeAllModals();
        
        // Reset any active states
        this.currentVehicle = null;
        this.searchQuery = '';
        this.currentCategory = 'all';
        
        // Clear any notifications
        const notifications = document.getElementById('notifications');
        if (notifications) {
            notifications.innerHTML = '';
        }
        
        // Reset search input
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.value = '';
        }
        

    }

    setupEventListeners() {
        // Navigation events
        document.getElementById('closeApp').addEventListener('click', () => this.closeApp());
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        // Admin functionality disabled
        // document.getElementById('adminBtn').addEventListener('click', () => this.openAdminPanel());
        
        // ESC key to close interface
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.closeApp();
            }
        });

        // Search functionality
        document.getElementById('globalSearch').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.filterAndDisplayVehicles();
        });

        // Category filters
        document.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.selectCategory(e.currentTarget.dataset.category);
            });
        });

        // Filter controls
        document.getElementById('priceRange').addEventListener('input', (e) => {
            this.maxPrice = parseInt(e.target.value);
            document.getElementById('maxPriceLabel').textContent = this.formatPrice(this.maxPrice);
            this.filterAndDisplayVehicles();
        });

        document.getElementById('sortFilter').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.filterAndDisplayVehicles();
        });

        document.getElementById('resetFilters').addEventListener('click', () => this.resetFilters());

        // View controls
        document.getElementById('gridView').addEventListener('click', () => this.setView('grid'));
        document.getElementById('listView').addEventListener('click', () => this.setView('list'));

        // Modal events
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal('vehicleModal'));
        // Admin modal disabled
        // document.getElementById('closeAdminModal').addEventListener('click', () => this.closeModal('adminModal'));

        // Purchase, preview and test drive buttons
        document.getElementById('purchaseVehicle').addEventListener('click', () => this.purchaseCurrentVehicle());
        document.getElementById('modalPreviewBtn').addEventListener('click', () => this.previewCurrentVehicle());
        document.getElementById('modalTestDriveBtn').addEventListener('click', () => this.testDriveCurrentVehicle());

        // Admin functionality disabled
        /*
        // Admin panel tabs
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchAdminTab(e.currentTarget.dataset.tab);
            });
        });

        // Admin actions
        document.getElementById('addVehicle').addEventListener('click', () => this.addNewVehicle());
        document.getElementById('refreshStock').addEventListener('click', () => this.refreshStock());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        */

        // Global keyboard shortcuts (close modals but not the whole app)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Only close modals if any are open, otherwise don't interfere with main close
                const openModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
                if (openModals.length > 0) {
                    e.preventDefault();
                    this.closeAllModals();
                }
            }
        });
    }

    selectCategory(category) {
        // Remove active class from all categories
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to selected category
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        this.currentCategory = category;
        
        // Update section title with translation
        const titleElement = document.getElementById('sectionTitle');
        if (category === 'all') {
            titleElement.textContent = this.getTranslation('all_vehicles');
        } else {
            titleElement.textContent = this.getTranslation(category);
        }
        
        this.filterAndDisplayVehicles();
    }

    updatePlayerMoney() {
        const moneyElement = document.getElementById('playerMoney');
        if (moneyElement) {
            moneyElement.textContent = this.formatPrice(this.playerMoney);
        }
    }

    updateVehicleCount() {
        const countElement = document.getElementById('vehicleCount');
        const count = this.filteredVehicles.length;
        countElement.textContent = this.getTranslation('vehicle_count', count);
    }

    // Enhanced vehicle card creation with translations
    createVehicleCard(vehicle) {
        const vipPrice = this.checkVIPDiscount(vehicle);
        const isDiscounted = vipPrice.hasDiscount;
        const finalPrice = isDiscounted ? vipPrice.discountedPrice : vehicle.price;
        const isOwned = this.ownedVehicles[vehicle.model] || false;

        return `
            <div class="vehicle-card ${isOwned ? 'owned-vehicle' : ''}" data-vehicle="${vehicle.model}" onclick="rm.showVehicleModal('${vehicle.model}')">
                ${isDiscounted ? `<div class="vip-badge">VIP ${vipPrice.discountPercent}%</div>` : ''}
                ${isOwned ? `<div class="owned-badge">${this.getTranslation('owned') || 'OWNED'}</div>` : ''}
                <div class="vehicle-image">
                    <img src="${vehicle.img}" alt="${vehicle.name}" 
                         onerror="rm.handleImageError(this, '${vehicle.model}')">
                </div>
                <div class="vehicle-info">
                    <div class="vehicle-header">
                        <div class="vehicle-name-section">
                            <h3 class="vehicle-name">${vehicle.name}</h3>
                            <span class="vehicle-model">${vehicle.model.toUpperCase()}</span>
                        </div>
                        <div class="vehicle-category-badge">
                            <span class="category-text">${this.getTranslation(vehicle.category).toUpperCase()}</span>
                        </div>
                    </div>
                    
                    <p class="vehicle-description">${vehicle.description || 'A premium vehicle available at our dealership.'}</p>
                    
                    <div class="vehicle-specs-mini">
                        <div class="spec-mini">
                            <i class="fas fa-tachometer-alt"></i>
                            <span>${vehicle.information?.TopSpeed || 237}</span>
                        </div>
                        <div class="spec-mini">
                            <i class="fas fa-bolt"></i>
                            <span>${vehicle.information?.Acceleration || 86}</span>
                        </div>
                        <div class="spec-mini">
                            <i class="fas fa-shield-alt"></i>
                            <span>${vehicle.information?.Handling || 84}</span>
                        </div>
                    </div>
                    
                    <div class="vehicle-pricing">
                        ${isDiscounted ? `<span class="original-price">${this.formatPrice(vehicle.price)}</span>` : ''}
                        <span class="vehicle-price ${isDiscounted ? 'vip-price' : ''}">${this.formatPrice(finalPrice)}</span>
                    </div>
                    
                    <div class="vehicle-actions">
                        <button class="action-btn secondary" onclick="event.stopPropagation(); rm.previewVehicle('${vehicle.model}')">
                            <i class="fas fa-eye"></i>
                            <span>${this.getTranslation('preview')}</span>
                        </button>
                        <button class="action-btn primary ${isOwned ? 'owned-disabled' : ''}" onclick="event.stopPropagation(); rm.showVehicleModal('${vehicle.model}')">
                            <i class="fas fa-${isOwned ? 'check' : 'shopping-cart'}"></i>
                            <span>${isOwned ? (this.getTranslation('owned') || 'OWNED') : this.getTranslation('purchase')}</span>
                        </button>
                    </div>
                    
                    <div class="stock-status ${vehicle.stock <= 0 ? 'out-of-stock' : ''}">
                        ${vehicle.stock <= 0 ? this.getTranslation('out_of_stock') : this.getTranslation('in_stock')}
                    </div>
                </div>
            </div>
        `;
    }

    filterAndDisplayVehicles() {
        // Filter vehicles based on current criteria
        this.filteredVehicles = this.vehicles.filter(vehicle => {
            // Category filter
            if (this.currentCategory !== 'all' && vehicle.category !== this.currentCategory) {
                return false;
            }
            
            // Price filter
            if (vehicle.price > this.maxPrice) {
                return false;
            }
            
            // Search filter
            if (this.searchQuery && !vehicle.name.toLowerCase().includes(this.searchQuery)) {
                return false;
            }
            
            return true;
        });

        // Sort vehicles
        this.sortVehicles();
        
        // Display vehicles
        this.displayVehicles();
        
        // Update vehicle count
        this.updateVehicleCount();
    }

    sortVehicles() {
        this.filteredVehicles.sort((a, b) => {
            switch(this.sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'price-low':
                    return a.price - b.price;
                case 'price-high':
                    return b.price - a.price;
                case 'category':
                    return a.category.localeCompare(b.category);
                default:
                    return 0;
            }
        });
    }

    displayVehicles() {
        const container = document.getElementById('vehicleGrid');
        
        if (this.filteredVehicles.length === 0) {
            container.innerHTML = `
                <div class="no-vehicles">
                    <i class="fas fa-car-side"></i>
                    <h3>${this.getTranslation('no_vehicles')}</h3>
                    <p>${this.getTranslation('try_different_filters')}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredVehicles
            .map(vehicle => this.createVehicleCard(vehicle))
            .join('');
    }

    showVehicleModal(vehicleModel) {
        const vehicle = this.vehicles.find(v => v.model === vehicleModel);
        if (!vehicle) return;

        const vipPrice = this.checkVIPDiscount(vehicle);
        const isDiscounted = vipPrice.hasDiscount;
        const finalPrice = isDiscounted ? vipPrice.discountedPrice : vehicle.price;
        const isOwned = this.ownedVehicles[vehicle.model] || false;

        // Update modal content with translations
        document.getElementById('modalVehicleName').textContent = vehicle.name;
        document.getElementById('modalVehicleCategory').textContent = this.getTranslation(vehicle.category);
        document.getElementById('modalVehicleImage').src = vehicle.img;
        document.getElementById('modalVehiclePrice').textContent = this.formatPrice(finalPrice);
        document.getElementById('modalVehicleDescription').textContent = vehicle.description || this.getTranslation('no_description');

        // Update VIP discount info
        const discountInfo = document.getElementById('discountInfo');
        if (isDiscounted) {
            discountInfo.classList.remove('hidden');
            document.getElementById('vipType').textContent = vipPrice.vipType.toUpperCase();
            document.getElementById('vipPercent').textContent = vipPrice.discountPercent + '%';
            document.getElementById('discountAmount').textContent = '-' + this.formatPrice(vehicle.price - finalPrice);
        } else {
            discountInfo.classList.add('hidden');
        }

        // Update vehicle stats
        const stats = vehicle.information || {};
        document.getElementById('modalTopSpeed').textContent = stats.TopSpeed || '--';
        document.getElementById('modalAcceleration').textContent = stats.Acceleration || '--';
        document.getElementById('modalHandling').textContent = stats.Handling || '--';

        // Update stock status
        const stockStatus = document.getElementById('stockStatus');
        const stockIcon = document.getElementById('stockIcon');
        if (vehicle.stock <= 0) {
            stockStatus.textContent = this.getTranslation('out_of_stock');
            stockIcon.className = 'fas fa-times-circle';
        } else if (vehicle.stock <= 10) {
            stockStatus.textContent = this.getTranslation('stock_low', vehicle.stock);
            stockIcon.className = 'fas fa-exclamation-circle';
        } else {
            stockStatus.textContent = this.getTranslation('in_stock');
            stockIcon.className = 'fas fa-check-circle';
        }

        // Update purchase button based on ownership
        const purchaseButton = document.getElementById('purchaseVehicle');
        if (isOwned) {
            purchaseButton.classList.add('owned-disabled');
            purchaseButton.innerHTML = '<i class="fas fa-check"></i><span>' + (this.getTranslation('owned') || 'OWNED') + '</span>';
            purchaseButton.disabled = true;
        } else {
            purchaseButton.classList.remove('owned-disabled');
            purchaseButton.innerHTML = '<i class="fas fa-shopping-cart"></i><span>' + this.getTranslation('purchase') + '</span>';
            purchaseButton.disabled = false;
        }

        // Store current vehicle for actions
        this.currentVehicle = vehicle;

        // Show modal
        document.getElementById('vehicleModal').classList.remove('hidden');
    }

    checkVIPDiscount(vehicle) {
        if (!this.vipInfo.hasVip) {
            return { hasDiscount: false, discountedPrice: vehicle.price };
        }

        const discountPercent = this.vipInfo.vipDiscount;
        const discountedPrice = Math.floor(vehicle.price * (100 - discountPercent) / 100);

        return {
            hasDiscount: true,
            discountedPrice: discountedPrice,
            discountPercent: discountPercent,
            vipType: this.vipInfo.vipType
        };
    }

    previewVehicle(vehicleModel) {
        this.sendNUIMessage('previewVehicle', { model: vehicleModel });
    }

    previewCurrentVehicle() {
        if (this.currentVehicle) {
            this.previewVehicle(this.currentVehicle.model);
        }
    }

    testDriveCurrentVehicle() {
        if (this.currentVehicle) {
            this.testDriveVehicle(this.currentVehicle.model);
        }
    }

    testDriveVehicle(vehicleModel) {
        this.sendNUIMessage('testDriveVehicle', { model: vehicleModel });
    }

    purchaseCurrentVehicle() {
        if (!this.currentVehicle) return;

        // Check if player already owns this vehicle
        const isOwned = this.ownedVehicles[this.currentVehicle.model] || false;
        if (isOwned) {
            this.showNotification(this.getTranslation('already_owned') || 'You already own this vehicle!', 'error');
            return;
        }

        const vipPrice = this.checkVIPDiscount(this.currentVehicle);
        const finalPrice = vipPrice.hasDiscount ? vipPrice.discountedPrice : this.currentVehicle.price;

        if (this.playerMoney < finalPrice) {
            this.showNotification(this.getTranslation('insufficient_funds'), 'error');
            return;
        }

        if (this.currentVehicle.stock <= 0) {
            this.showNotification(this.getTranslation('out_of_stock'), 'error');
            return;
        }

        // Purchase directly without confirmation
        this.sendNUIMessage('buyVehicle', {
            model: this.currentVehicle.model,
            name: this.currentVehicle.name,
            price: finalPrice,
            originalPrice: this.currentVehicle.price
        });
    }

    setView(view) {
        this.currentView = view;
        const container = document.getElementById('vehicleGrid');
        
        // Update view buttons
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(view + 'View').classList.add('active');
        
        // Update container class
        container.className = `vehicle-grid ${view}-view`;
    }

    resetFilters() {
        // Reset all filters
        this.currentCategory = 'all';
        this.maxPrice = 5000000;
        this.sortBy = 'name';
        this.searchQuery = '';
        
        // Update UI
        document.getElementById('globalSearch').value = '';
        document.getElementById('priceRange').value = 5000000;
        document.getElementById('maxPriceLabel').textContent = this.formatPrice(5000000);
        document.getElementById('sortFilter').value = 'name';
        
        // Update category selection
        document.querySelectorAll('.category-item').forEach(item => item.classList.remove('active'));
        document.querySelector('[data-category="all"]').classList.add('active');
        
        // Update title
        document.getElementById('sectionTitle').textContent = this.getTranslation('all_vehicles');
        
        // Refresh display
        this.filterAndDisplayVehicles();
    }

    updateCategoryCounts() {
        const counts = {};
        
        // Count vehicles by category
        this.vehicles.forEach(vehicle => {
            counts[vehicle.category] = (counts[vehicle.category] || 0) + 1;
        });
        
        // Update total count
        document.getElementById('allCount').textContent = this.vehicles.length;
        
        // Update individual category counts
        Object.keys(counts).forEach(category => {
            const element = document.getElementById(category + 'Count');
            if (element) {
                element.textContent = counts[category];
            }
        });
    }

    openAdminPanel() {
        this.loadAdminData();
        document.getElementById('adminModal').classList.remove('hidden');
    }

    loadAdminData() {
        this.displayAdminVehicles();
    }

    displayAdminVehicles() {
        const container = document.getElementById('adminVehicleList');
        
        if (!this.vehicles || this.vehicles.length === 0) {
            container.innerHTML = `<p class="no-data">${this.getTranslation('no_vehicles_admin')}</p>`;
            return;
        }

        container.innerHTML = this.vehicles.map(vehicle => `
            <div class="admin-vehicle-item">
                <div class="vehicle-info">
                    <img src="${vehicle.img}" alt="${vehicle.name}" class="vehicle-thumb">
                    <div class="vehicle-details">
                        <h4>${vehicle.name}</h4>
                        <span class="model">${vehicle.model}</span>
                        <span class="category">${this.getTranslation(vehicle.category)}</span>
                    </div>
                </div>
                <div class="vehicle-stats">
                    <span class="price">${this.formatPrice(vehicle.price)}</span>
                    <span class="stock">Stock: ${vehicle.stock}</span>
                </div>
                <div class="vehicle-actions">
                    <button class="edit-btn" onclick="rm.editVehicle('${vehicle.model}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" onclick="rm.removeVehicle('${vehicle.model}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    switchAdminTab(tabName) {
        // Remove active class from all tabs
        document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName + 'Tab').classList.add('active');
    }

    addNewVehicle() {
        // Implementation for adding new vehicle
        this.showNotification(this.getTranslation('feature_coming_soon'), 'info');
    }

    refreshStock() {
        this.sendNUIMessage('refreshStock', {});
        this.showNotification(this.getTranslation('stock_refreshed'), 'success');
    }

    saveSettings() {
        const dealershipName = document.getElementById('dealershipName').value;
        const vipDiscount = document.getElementById('vipDiscount').value;
        
        this.sendNUIMessage('saveSettings', {
            dealershipName: dealershipName,
            vipDiscount: parseInt(vipDiscount)
        });
        
        this.showNotification(this.getTranslation('settings_saved'), 'success');
    }

    openSettings() {
        this.showNotification(this.getTranslation('feature_coming_soon'), 'info');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    }

    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    closeApp() {
        // Hide the interface immediately to prevent it staying visible
        this.hideApp();
        
        // Then send the NUI message to notify the client
        this.sendNUIMessage('closeDealership', {});
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.getElementById('notifications').appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        switch(type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-times-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }

    formatPrice(price) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    }

    handleImageError(imgElement, vehicleModel) {
        // Fallback to placeholder image
        imgElement.src = `https://via.placeholder.com/300x200/333/fff?text=${vehicleModel.toUpperCase()}`;
        
        // Try alternative image sources
        const altSources = [
            `https://docs.fivem.net/vehicles/${vehicleModel}.webp`,
            `https://gtaforums.com/applications/core/interface/imageproxy/imageproxy.php?img=${vehicleModel}`,
            `https://via.placeholder.com/300x200/555/fff?text=NO+IMAGE`
        ];
        
        let sourceIndex = 0;
        imgElement.onerror = function() {
            if (sourceIndex < altSources.length) {
                this.src = altSources[sourceIndex++];
            }
        };
    }

    sendNUIMessage(action, data) {
        if (typeof fetch !== 'undefined') {
            fetch(`https://rm-dealership/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }).then(response => {
                return response.text();
            }).then(text => {
                // Response processed
            }).catch(err => {
                // Error handled silently
            });
        }
    }
}

// Initialize the dealership
const rm = new RMDealership();

// Listen for messages from the game
window.addEventListener('message', (event) => {
    rm.handleServerMessage(event.data);
}); 