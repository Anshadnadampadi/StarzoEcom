/**
 * Lightweight SPA Navigation for STARZO
 * Intercepts clicks and form submissions to provide a seamless UX.
 */

const SpaNavigation = {
    init() {
        this.mainSelector = 'main';
        this.loaderId = 'page-loader';
        
        // Intercept links
        document.addEventListener('click', (e) => this.handleClick(e));
        
        // Intercept form submissions
        document.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // handle back/forward buttons
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.url) {
                this.loadPage(e.state.url, false);
            } else {
                this.loadPage(window.location.href, false);
            }
        });

        console.log('SPA Navigation Initialized');
    },

    async loadPage(url, pushState = true) {
        try {
            this.showLoader();
            const response = await fetch(url, {
                headers: { 'X-SPA-Request': 'true' }
            });

            if (!response.ok) throw new Error('Page load failed');

            const html = await response.text();
            await this.updateContent(html, url, pushState);
        } catch (err) {
            console.error('SPA Load Error:', err);
            window.location.href = url; // Fallback to full reload
        } finally {
            this.hideLoader();
        }
    },

    async updateContent(html, url, pushState = true) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Update Title
            document.title = doc.title;

            // Update main content
            const newContent = doc.querySelector(this.mainSelector);
            const currentContent = document.querySelector(this.mainSelector);
            
            if (newContent && currentContent) {
                currentContent.innerHTML = newContent.innerHTML;
                
                // Refresh Breadcrumbs
                const newBreadWrapper = doc.querySelector('#breadcrumbs-wrapper');
                const oldBreadWrapper = document.querySelector('#breadcrumbs-wrapper');
                if (newBreadWrapper && oldBreadWrapper) {
                    oldBreadWrapper.innerHTML = newBreadWrapper.innerHTML;
                }

                // Refresh all Sidebar Navs (Desktop & Mobile)
                const newNavs = doc.querySelectorAll('.spa-nav');
                const oldNavs = document.querySelectorAll('.spa-nav');
                if (newNavs.length > 0 && oldNavs.length > 0) {
                    oldNavs.forEach((oldNav, idx) => {
                        if (newNavs[idx]) oldNav.innerHTML = newNavs[idx].innerHTML;
                    });
                }

                // Handle AI Chatbot visibility across SPA transitions
                const newChat = doc.getElementById('ai-chatbot');
                const oldChat = document.getElementById('ai-chatbot');
                if (newChat && !oldChat) {
                    document.body.appendChild(newChat.cloneNode(true));
                } else if (!newChat && oldChat) {
                    oldChat.remove();
                } else if (newChat && oldChat) {
                    // Optional: keep it as is, or replace its content if needed.
                    // Leaving it alone preserves chat state during navigation!
                }

                
                // Re-initialize scripts in new content
                this.executeScripts(currentContent);
                
                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
                // Update URL
                if (pushState) {
                    window.history.pushState({ url }, doc.title, url);
                }
                
                // Re-trigger Alpine.js v3
                setTimeout(() => {
                    if (window.Alpine) {
                        window.Alpine.initTree(document.body);
                    }
                }, 50);
            } else {
                window.location.href = url;
            }
        } catch (err) {
            console.error('SPA Update Error:', err);
            window.location.href = url;
        }
    },

    handleClick(e) {
        const a = e.target.closest('a');
        if (!a || !a.href) return;
        
        const url = new URL(a.href);
        const currentUrl = new URL(window.location.href);

        // Conditions for internal navigation
        const isInternal = url.origin === currentUrl.origin;
        const isSelf = a.target === '' || a.target === '_self';
        const isNotAsset = !url.pathname.match(/\.(pdf|jpg|png|zip)$/);
        const isNotLogout = !url.pathname.includes('logout');
        const isNotJavascript = !a.href.startsWith('javascript:');

        if (isInternal && isSelf && isNotAsset && isNotLogout && isNotJavascript && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            this.loadPage(a.href);
        }
    },

    async handleFormSubmit(e) {
        const form = e.target;
        if (form.getAttribute('data-no-spa') !== null) return;
        
        if (form.method.toLowerCase() === 'get') {
            e.preventDefault();
            const url = new URL(form.action || window.location.href);
            const formData = new FormData(form);
            for (const [key, value] of formData.entries()) {
                url.searchParams.set(key, value);
            }
            this.loadPage(url.toString());
        }
    },

    showLoader() {
        let loader = document.getElementById(this.loaderId);
        if (loader) {
            loader.classList.remove('fade-out');
            loader.style.opacity = '1';
            loader.style.visibility = 'visible';
            if (!document.body.contains(loader)) document.body.appendChild(loader);
        }
    },

    hideLoader() {
        const loader = document.getElementById(this.loaderId);
        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => {
                loader.style.opacity = '0';
                loader.style.visibility = 'hidden';
            }, 500);
        }
    },

    executeScripts(container) {
        const scripts = container.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            
            // Copy all attributes
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });

            if (oldScript.src) {
                newScript.src = oldScript.src;
                newScript.async = false;
            } else {
                newScript.textContent = oldScript.textContent;
            }

            // Remove old script and add new one to head to trigger execution
            const parent = oldScript.parentNode;
            if (parent) {
                parent.removeChild(oldScript);
            }
            document.head.appendChild(newScript);
        });
    },
};

window.SpaNavigation = SpaNavigation;
document.addEventListener('DOMContentLoaded', () => SpaNavigation.init());
