import Product from "../models/product/product.js";

export const getProductsService = async (queryData) => {

    let {
        page,
        search,
        category,
        brand,
        sort,
        minPrice,
        maxPrice
    } = queryData


    const limit = 9
    const skip = (page - 1) * limit


    let query = {
        isBlocked: false,
        isListed: true
    }

    if (search) {
        query.name = { $regex: search, $options: "i" }
    }

    if (category) {
        query.category = category
    }

    if (brand) {
        query.brand = brand
    }

    if (minPrice || maxPrice) {

        query.price = {}

        if (minPrice) query.price.$gte = Number(minPrice)

        if (maxPrice) query.price.$lte = Number(maxPrice)

    }


    let sortOption = {}

    switch (sort) {

        case "price_low_high":
            sortOption.price = 1
            break

        case "price_high_low":
            sortOption.price = -1
            break

        case "a_z":
            sortOption.name = 1
            break

        case "z_a":
            sortOption.name = -1
            break

        default:
            sortOption.createdAt = -1

    }


    const products = await Product
        .find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)


    const totalProducts = await Product.countDocuments(query)

    const totalPages = Math.ceil(totalProducts / limit)

    return {
        products,
        totalPages,
        currentPage: page
    }

}