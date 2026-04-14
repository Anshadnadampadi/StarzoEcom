/**
 * Global normalization function for variant field values
 * Handles: Lowercase, removes spaces, removes "gb" suffix
 * @param {string|number} val 
 * @returns {string}
 */
export const normalize = (val) => {
    if (val === undefined || val === null) return "";
    return val.toString()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/gb$/i, "")
        .trim();
};

/**
 * Compare two variant objects safely
 * Always use object format: { storage: string, color: string, ram: string }
 * @param {Object} v1 
 * @param {Object} v2 
 * @returns {boolean}
 */
export const isSameVariant = (v1, v2) => {
    if (!v1 || !v2) return false;
    
    // Ensure we are comparing components
    const color1 = normalize(v1.color);
    const color2 = normalize(v2.color);
    
    const storage1 = normalize(v1.storage);
    const storage2 = normalize(v2.storage);
    
    const ram1 = normalize(v1.ram);
    const ram2 = normalize(v2.ram);

    return color1 === color2 && storage1 === storage2 && ram1 === ram2;
};

/**
 * Safely finds a matching variant in a product's variant array
 * @param {Array} productVariants 
 * @param {Object} targetVariant 
 * @returns {Object|null}
 */
export const findMatchingVariant = (productVariants, targetVariant) => {
    if (!Array.isArray(productVariants) || !targetVariant) return null;
    
    // Clean data: remove invalid/undefined variants before processing
    const validVariants = productVariants.filter(v => v && (v.color || v.storage || v.ram));
    
    return validVariants.find(v => isSameVariant(v, targetVariant)) || null;
};

/**
 * Generate a display string for a variant object (useful for UI or legacy matching)
 * @param {Object} v 
 * @returns {string}
 */
export const getVariantDisplayString = (v) => {
    if (!v) return "";
    const parts = [];
    if (v.storage) parts.push(v.storage.toString().toUpperCase().includes("GB") ? v.storage : `${v.storage} GB`);
    if (v.color) parts.push(v.color);
    if (v.ram) parts.push(v.ram.toString().toUpperCase().includes("GB") ? v.ram : `${v.ram} GB`);
    return parts.join(" ").trim();
};
