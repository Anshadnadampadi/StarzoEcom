/**
 * Global User Functionalities for MOBIVERSE
 */

function dispatchGlobalToast(type, title, message) {
    if (window.MobiverseValidation && typeof window.MobiverseValidation.showToast === 'function') {
        window.MobiverseValidation.showToast(type, title, message);
    } 
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: message || title, type: type } }));
}

async function toggleWishlist(productId, options = {}) {
    // Try grabbing values natively from DOM if we're on the Product Details Page
    const domColor = document.getElementById('selectedColor')?.textContent?.trim() || "";
    const domStorage = document.getElementById('selectedStorage')?.textContent?.trim() || "";
    const domRam = document.getElementById('selectedRam')?.textContent?.trim() || "";

    const { 
        color = domColor, 
        storage = domStorage, 
        ram = domRam,
        button = null 
    } = options;

    try {
        const response = await fetch('/wishlist/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, color, storage, ram })
        });

        const data = await response.json();

        if (data.success) {
            const isAdded = data.added;
            
            // If a button was passed, update its UI
            if (button) {
                const heartSvg = button.querySelector('svg');
                button.classList.toggle('active', isAdded);
                if (isAdded) {
                    button.style.color = 'var(--danger)';
                    if (heartSvg) heartSvg.setAttribute('fill', 'currentColor');
                } else {
                    button.style.color = '';
                    if (heartSvg) heartSvg.setAttribute('fill', 'none');
                }
            }

            // Global Toast Notification
            dispatchGlobalToast(isAdded ? 'success' : 'info', isAdded ? 'Added to wishlist' : 'Removed from wishlist', data.message);

            // Update Navbar Badges
            const badge = document.getElementById('wishlist-badge');
            if (badge && data.wishlistCount !== undefined) {
                badge.textContent = data.wishlistCount;
                badge.classList.toggle('hidden', data.wishlistCount === 0);
            }
            
            return { success: true, added: isAdded };
        } else {
            if (data.message && data.message.toLowerCase().includes('login')) {
                window.location.href = '/auth/login';
            }
            return { success: false, message: data.message };
        }
    } catch (err) {
        console.error("Toggle Wishlist Error:", err);
        return { success: false, message: "Network error" };
    }
}

async function addToCartFromCard(productId, name) {
    try {
        const response = await fetch('/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ productId, variant: '', qty: 1 })
        });
        const data = await response.json();
        if (data.success) {
            dispatchGlobalToast('success', 'Added to cart', name);
            const badge = document.getElementById('cart-badge');
            if (badge && data.cartCount !== undefined) {
                badge.textContent = data.cartCount;
                badge.classList.remove('hidden');
            }
        } else {
            if (data.message && data.message.toLowerCase().includes('login')) {
                window.location.href = '/auth/login';
            } else {
                dispatchGlobalToast('error', 'Failed to add', data.message || 'Something went wrong');
            }
        }
    } catch (err) {
        console.error("Add to Cart Error:", err);
    }
}

function checkEmptyWishlist() {
    const grid = document.querySelector('.grid.bg-black-border');
    if(grid && grid.children.length === 0) {
        window.location.reload(); 
    }
}

async function removeFromWishlistUI(productId, color = "", storage = "", ram = "", btnElement = null) {
    if(btnElement && btnElement.tagName === 'BUTTON') {
        btnElement.innerHTML = `<span class="animate-pulse">REMOVING...</span>`;
    }
    const buttonSrc = btnElement || (event && event.currentTarget);
    try {
        const response = await fetch('/wishlist/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, color, storage, ram })
        });
        const data = await response.json();
        if (data.success) {
            dispatchGlobalToast('success', 'Removed from wishlist', '');
            if(buttonSrc) {
                const card = buttonSrc.closest('.bg-black-card');
                if(card) {
                    card.classList.add('opacity-0', 'scale-95', 'transition-all', 'duration-300');
                    setTimeout(() => {
                        card.remove();
                        checkEmptyWishlist();
                    }, 300);
                }
            } else {
                window.location.reload();
            }
        } else {
            if (btnElement && btnElement.tagName === 'BUTTON') btnElement.innerText = "REMOVE";
            dispatchGlobalToast('error', 'Error', data.message || 'Failed to remove');
        }
    } catch (err) {
        console.error(err);
        if (btnElement && btnElement.tagName === 'BUTTON') btnElement.innerText = "REMOVE";
    }
}

async function moveToCart(productId, color = "", storage = "", ram = "", btnElement = null) {
    if(btnElement) {
        btnElement.disabled = true;
        btnElement.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-black inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> MOVING...`;
    }
    try {
        const response = await fetch('/wishlist/move-to-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, color, storage, ram })
        });
        const data = await response.json();
        if (data.success) {
            dispatchGlobalToast('success', 'Added to cart', '');
            const badge = document.getElementById('cart-badge');
            if(badge && data.cartCount !== undefined) {
                 badge.textContent = data.cartCount;
                 badge.classList.remove('hidden');
            }
            if(btnElement) {
                const card = btnElement.closest('.bg-black-card');
                if(card) {
                    card.classList.add('opacity-0', 'scale-95', 'transition-all', 'duration-300');
                    setTimeout(() => {
                        card.remove();
                        checkEmptyWishlist();
                    }, 300);
                } else {
                    window.location.reload();
                }
            } else {
                window.location.reload();
            }
        } else {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerText = "MOVE TO CART";
            }
            dispatchGlobalToast('error', 'Error', data.message || data.error || 'Failed to move');
        }
    } catch (err) {
        console.error(err);
        if (btnElement) {
            btnElement.disabled = false;
            btnElement.innerText = "MOVE TO CART";
        }
    }
}

async function moveAllToCart(btnElement = null) {
    if(!btnElement) btnElement = event && event.currentTarget;
    const oldHtml = btnElement ? btnElement.innerHTML : "Move All To Cart";
    if(btnElement) {
        btnElement.disabled = true;
        btnElement.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-black inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> MOVING ALL...`;
    }

    try {
        const response = await fetch('/wishlist/move-all-to-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.success) {
            dispatchGlobalToast('success', 'Added to cart', 'All items moved');
            setTimeout(() => {
                window.location.reload();
            }, 500); 
        } else {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerHTML = oldHtml;
            }
            dispatchGlobalToast('error', 'Error', data.message || data.error || 'Failed to move items');
        }
    } catch (err) {
        console.error(err);
        if (btnElement) {
            btnElement.disabled = false;
            btnElement.innerHTML = oldHtml;
        }
    }
}
