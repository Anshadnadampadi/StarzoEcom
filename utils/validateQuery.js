export const validatePLPQuery = (query) => {

let {
    page,
    search,
    category,
    brand,
    minPrice,
    maxPrice
} = query

page = parseInt(page) || 1

if(page < 1) page = 1

if(minPrice && minPrice < 0) minPrice = 0

if(maxPrice && maxPrice < 0) maxPrice = 0

return {
    page,
    search: search?.trim() || "",
    category,
    brand,
    minPrice,
    maxPrice
}

}