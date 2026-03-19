import admin from '../../models/admin/admin.js';
import User from '../../models/user/User.js';
import Address from '../../models/user/Address.js';
import bcrypt from 'bcryptjs';
import { adminLogin} from '../../services/admin/adminServices.js';
import {
    getDashboardUsersService,
    blockUserService,
    unblockUserService,
    deleteUserService,
    editUserService 
} from '../../services/admin/adminServices.js';


export const getAdminLogin = (req, res) => {
    res.render('admin/adminLogin', { title: 'Admin Login', error:null});
}
export const postAdminLogin = async (req, res) => {
  try {

    const { email, password } = req.body;

    const result = await adminLogin({ email, password });

    if (!result.success) {
      return res.render("admin/adminLogin", {
        title: "Admin Login",
        error: result.message
      });
    }

    // Create admin session
    req.session.admin = {
      email,
      role: "admin"
    };

    return res.redirect("/admin/dashboard");

  } catch (error) {
    console.log(error);
    return res.status(500).render("admin/adminLogin", {
      title: "Admin Login",
      error: "Server error"
    });
  }
};

export const getAdminDashboard = (req, res) => {
    res.render('admin/adminDashboard', { title: 'Admin Dashboard' });
}   

// export const getAdminManagement=(req,res)=>{
//     res.render('admin/adminManagement',{title:'Admin Management'})
// }





// 🔹 Login



export const getAdminManagement = async (req, res) => {
    try {
        const { msg, icon } = req.query;
        const rawSearch = typeof req.query.search === 'string' ? req.query.search : '';
        const rawStatus = typeof req.query.status === 'string' ? req.query.status : '';

        const pageQuery = parseInt(req.query.page, 10);
        const limitQuery = parseInt(req.query.limit, 10);
        
        const page = Number.isFinite(pageQuery) && pageQuery > 0 ? pageQuery : 1;
        const limit = Number.isFinite(limitQuery) && limitQuery > 0 ? limitQuery : 4;
        const search = rawSearch.trim();
        const status = rawStatus === 'active' || rawStatus === 'blocked' ? rawStatus : '';

        if (req.query.clear === '1') {
            const clearParams = new URLSearchParams();
            if (status) clearParams.set('status', status);
            clearParams.set('page', '1');
            clearParams.set('limit', String(limit));
            return res.redirect(`/admin/management?${clearParams.toString()}`);
        }

        const data = await getDashboardUsersService(
            search,
            page,
            limit,
            status
        );

        const clearParams = new URLSearchParams();
        if (status) clearParams.set('status', status);
        clearParams.set('page', '1');
        clearParams.set('limit', String(limit));
        const clearSearchUrl = `/admin/management?${clearParams.toString()}`;

        res.render('admin/adminManagement', {
            msg,
            icon,
            currUser: data.users,
            page,
            totalPages: data.totalPages,
            limit,
            totalUsers: data.totalUsers,
            search,
            status,
            clearSearchUrl
        });

    } catch (error) {
        console.log(error);
        res.redirect('/admin/management?msg=Session Error&icon=error');
    }
};



// 🔹 Block
export const postBlock = async (req, res) => {

try{

const id = req.params.id

await User.findByIdAndUpdate(id,{ status:0, isBlocked:true })

res.redirect("/admin/management?msg=User blocked&icon=success")

}catch(err){
console.log(err)
}

}


// 🔹 Unblock
export const postUnblock = async (req, res) => {

try{

const id = req.params.id

await User.findByIdAndUpdate(id,{ status:1, isBlocked:false })

res.redirect("/admin/management?msg=User unblocked&icon=success")

}catch(err){
console.log(err)
}

}



// 🔹 Delete
export const postDelete = async (req, res) => {
    const result = await deleteUserService(req.params.id);

    if (!result.success) {
        return res.redirect('/admin/management?msg=Invalid User&icon=error');
    }

    res.redirect('/admin/management?msg=User Deleted Successfully&icon=success');
};



// 🔹 Edit
export const postEdit = async (req, res) => {
    const { name, email, id } = req.body;

    const result = await editUserService(id, name, email);

    if (!result.success) {
        return res.redirect('/admin/management?msg=Invalid User&icon=error');
    }

    res.redirect('/admin/management?msg=User Edit Successfully&icon=success');
};



// 🔹 Logout
export const adminLogout = (req, res) => {
    req.session.destroy((error) => {
        if (error) console.log(error);
        res.redirect('/admin/auth/login');
    });
};


export const getProductManagement = async (req, res) => {
    try {
        res.render("admin/product/adminProductManagement",{
            categories
        });
    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound");
    }
};