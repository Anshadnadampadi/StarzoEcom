import { createCouponService, getCouponService, toggleCouponStatusService, updateCouponService, deleteCouponService } from "../../services/admin/couponService.js";


export const getCouponPage = async (req, res) => {
    try {
        const { coupons, totalPages, currentPage, totalCoupons, tab } = await getCouponService(req.query);

        res.render("admin/marketing/coupons", {
            title: 'Coupons',
            coupons,
            totalPages,
            currentPage,
            totalCoupons,
            tab,
            query: req.query,
            breadcrumbs: [
                { label: 'Marketing', url: '#' },
                { label: 'Coupons', url: '/admin/marketing/coupons' }
            ]
        });

    } catch (err) {
        res.status(500).send(err.message);
    }
};

export const createCoupon =async(req , res)=>{
    try{
        const coupon= await createCouponService(req.body)
       res.json({success:true,data:coupon});

    }catch(err){
        res.status(400).json({success:false,message:err.message})
    }
}

export const getCoupon=async(req,res)=>{
    try{
        const coupons = await getCouponService(req.query);

        res.json({success:true, data:coupons})
    }catch(err){
        res.status(500).json({success:false,message:err.message})
    }
}

//updateCoupons
export const updateCoupon=async(req,res)=>{
    try{
    const updated = await updateCouponService(req.params.id,req.body)
        res.json({success:true,data:updated});
    }catch(err){
        res.status(400).json({success:false,message:err.message})
    }

}
export const toggleCouponStatus=async (req,res)=>{
    try{
        const updated = await toggleCouponStatusService(req.params.id)
        res.json({success:true, data:updated});
    }catch(err){
        res.status(400).json({success:false,message:err.message})
    }
}

export const deleteCoupon = async (req, res) => {
    try {
        await deleteCouponService(req.params.id);
        res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
}