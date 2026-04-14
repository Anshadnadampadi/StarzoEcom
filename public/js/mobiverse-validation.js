/**
 * Mobiverse Centralized Validation Rules
 * Used for consistent frontend validation logic
 */

window.MobiverseValidation = {
    rules: {
        firstName: (value) => value.trim().length >= 2 ? '' : 'First name must be at least 2 characters',
        lastName: (value) => value.trim().length >= 2 ? '' : 'Last name must be at least 2 characters',
        email: (value) => {
            const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return regex.test(value) ? '' : 'Please enter a valid email address';
        },
        password: (value) => value.length >= 8 ? '' : 'Min. 8 characters required',
        passwordComplexity: (value) => {
            const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,30}$/;
            return regex.test(value) ? '' : 'Requires uppercase, lowercase, number & special character';
        },
        currentPassword: (value) => value.length > 0 ? '' : 'Current password is required',
        otp: (value) => /^\d{6}$/.test(value) ? '' : 'Enter the 6-digit verification code',
        phone: (value) => /^[0-9]{10}$/.test(value) ? '' : 'Enter a valid 10-digit number',
        bio: (value) => value.length <= 200 ? '' : 'Limit exceeds 200 segments',
        name: (value) => value.trim().length >= 2 ? '' : 'Name is too short',
        addr1: (value) => value.trim().length >= 5 ? '' : 'Street address is too short',
        city: (value) => value.trim().length >= 2 ? '' : 'City name is too short',
        state: (value) => value.trim().length >= 2 ? '' : 'State name is too short',
        zip: (value) => /^[0-9]{6}$/.test(value) ? '' : 'Enter a valid 6-digit PIN',
        country: (value) => value ? '' : 'Country selection required',
        
        // Generic Rules
        required: (value, name = 'Field') => value.trim().length > 0 ? '' : `${name} is required`,
        slug: (value) => /^[a-z0-9-]+$/.test(value) ? '' : 'Lowercase alphanumeric and hyphens only',
        min: (value, length, name = 'Field') => value.trim().length >= length ? '' : `${name} must be at least ${length} characters`,
        max: (value, length, name = 'Field') => value.trim().length <= length ? '' : `${name} cannot exceed ${length} characters`,
        order: (value) => (value !== '' && parseInt(value) >= 0) ? '' : 'Must be 0 or greater',
    },

    /**
     * Helper to show a standalone toast
     */
    showToast(type, title, message) {
        window.dispatchEvent(new CustomEvent('show-toast', {
            detail: { message: message || title, title, type }
        }));
    },

    /**
     * Helper to handle backend responses and trigger toasts
     */
    async handleResponse(response) {
        const status = response.status;
        const result = await response.json();
        
        if (!result.success) {
            window.dispatchEvent(new CustomEvent('show-toast', {
                detail: { message: result.message || 'Operation failed', type: 'error', status }
            }));
        } else {
             window.dispatchEvent(new CustomEvent('show-toast', {
                detail: { message: result.message || 'Operation successful', type: 'success', status }
            }));
        }
        
        return { success: result.success, result, status };
    }
};
