import Category from "../../../models/category/category.js";

// 1. Render Page
export const getCategories = async (req, res) => {
    try {
        // 1. Get query parameters
        const page = parseInt(req.query.page) || 1;
        const limit = 4; // Items per page
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search || "";

        // 2. Build the search filter (searches name or slug)
        const filter = searchQuery 
            ? { 
                $or: [
                    { name: { $regex: searchQuery, $options: "i" } },
                    { slug: { $regex: searchQuery, $options: "i" } }
                ]
              } 
            : {};

        // 3. Execute queries in parallel for better performance
        const [categories, totalCategories] = await Promise.all([
            Category.find(filter)
                .sort({ displayOrder: 1 }) // Keeps your preferred sorting
                .skip(skip)
                .limit(limit),
            Category.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalCategories / limit);

        // 4. Render with all necessary pagination data
        res.render('admin/category/categoryManagement', { 
            categories,
            currentPage: page,
            totalPages,
            totalCategories,
            searchQuery :req.query.search|| ""// Sent back to keep the search input populated
        });

    } catch (error) {
        console.error("Search/Pagination Error:", error);
        res.status(500).send("Internal Server Error");
    }
};

// 2. API: Get One (for Edit Modal)
export const getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        res.json(category);
    } catch (error) {
        res.status(404).json({ message: "Category not found" });
    }
};

export const addCategory = async (req, res) => {
    try {
        const { name, slug, icon, displayOrder, metaDescription } = req.body;
        
        const newCategory = new Category({
            name, 
            slug, 
            icon, 
            displayOrder, 
            metaDescription 
        });

        await newCategory.save();

        // CHANGE THIS: Don't redirect, send JSON!
        return res.status(201).json({ 
            success: true, 
            message: "Category created successfully!" 
        });

    } catch (error) {
        console.error("Backend Error:", error);
        
        // If it's a duplicate slug, MongoDB error code is 11000
        let message = "Error adding category";
        if (error.code === 11000) {
            message = "This URL Slug already exists. Please use a unique one.";
        }

        return res.status(400).json({ 
            success: false, 
            message: message 
        });
    }
};

// 4. Update Category
export const updateCategory = async (req, res) => {
    try {
        await Category.findByIdAndUpdate(req.params.id, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// 5. Toggle Unlist (Soft Delete)
export const toggleCategoryStatus = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        category.isUnlisted = !category.isUnlisted;
        await category.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};