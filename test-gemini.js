import dotenv from "dotenv";
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai";
import { success } from "zod";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent("Hello");
        console.log("Success:", result.response.text());
    } catch (error) {
        console.error("Error details:", error);
    }
}

test();


//clear wishlist logic
const clearWishList= async(req,res)=>{
try{
    const userId = req.user.id;
    await Wishlist.deleteMany({userId})
    res.json({
        success:true,
        message:"Wishlist Cleared"
    })
}catch(error){
    res.status(500).json({message:error.message})
}
}

//while typing user name show user name already exist 
usernameInput.addEventListener("keyup", async ()=>{
   const username=usernameInput.value 
})