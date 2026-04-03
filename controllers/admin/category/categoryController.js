import category from "../../../models/category/category.js";
import * as adminCategoryServices from "../../../services/admin/adminCategoryServices.js";
import fs from "fs";

export const getCategories = async (req, res) => {
    try {
        const data = await adminCategoryServices.getCategoryManagementData(req.query);
        const { msg, icon } = req.query;
        res.render('admin/categoryManagement', { 
            ...data,
            breadcrumbs: [
                { label: 'Admin', url: '/admin/dashboard' },
                { label: 'Categories', url: '/admin/categories' }
            ],
            msg: msg || null,
            icon: icon || null
        });
    } catch (error) {
        console.error("Search/Pagination Error:", error);
        res.status(500).send("Internal Server Error");
    }
};

export const getCategoryById = async (req, res) => {
    try {
        const category = await adminCategoryServices.getCategoryById(req.params.id);
        res.json(category);
    } catch (error) {
        res.status(404).json({ message: error.message || "Category not found" });
    }
};

export const addCategory = async (req, res) => {
    try {
        await adminCategoryServices.createCategory(req.body, req.file);
        return res.status(201).json({ 
            success: true, 
            message: "Category created successfully!" 
        });
    } catch (error) {
        console.error("Backend Error:", error);
        
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }

        let message = "Error adding category";
        if (error.code === 11000) {
            if (error.message.includes('name')) {
                message = "Category with this name already exists.";
            } else if (error.message.includes('slug')) {
                message = "This URL Slug already exists. Please use a unique one.";
            } else {
                message = "Duplicate entry found. Please ensure name and slug are unique.";
            }
        }

        return res.status(400).json({ 
            success: false, 
            message: error.message || message 
        });
    }
};

export const updateCategory = async (req, res) => {
    try {
        await adminCategoryServices.updateCategory(req.params.id, req.body, req.file);
        res.json({ success: true, message: "Category updated successfully!" });
    } catch (error) {
        console.error("Update Error:", error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: error.message || "Error updating category" });
    }
};

export const toggleCategoryStatus = async (req, res) => {
    try {
        await adminCategoryServices.toggleCategoryStatus(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// let search = req.query.search||"" 
// const filter = { name:{regex:search , $option:"i"}}

//let sortoption ={}

//if(sortBy==="low-high")sortoption.price=1;
//if(sortBy==="high-low")sortoption.price=-1;
//if(sortBy==="newest")sortoption.createdAt=-1

//const userLoggedIn=(req,res,next)=>{
  // if(!req.session.user){
  // return res.redirect("/login")
  // }
//next()
//     }

// admin 
// const isAdmin=(req,res,next)=>{
//     if(!req.session.admin){
//         return res.redirect("/admin/login")
//     }
//     next();
// }

// const existingUser= cart.items.find(
//     item=>item.productId.toString()===productId
// )
// if(existingitem){
//     existingitem.quantity+=1

// }else{
//     cart.items.push({
//         productId.quantity:1
//     })
// }


// if(product.stock<quantity){
//     throw new Error("Product out of Stock") 
// }

// if(category){
//     filter.category=category
// }

// await Product.findByIdAndUpdate(id,{
//   isBlocked:true  
// })

// let total =0;
// cart.items.forEach(item=>{
//     total+=item.price*item.quantity;
// })
