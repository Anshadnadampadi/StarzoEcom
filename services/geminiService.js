// services/geminiService.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import Product from "../models/product/product.js";
import Order from "../models/order/order.js";
import Offer from "../models/offer/offer.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const askGemini = async (prompt, userId = null) => {
    const lowerPrompt = prompt.toLowerCase();
    let dbContext = "";
    
    try {
        // 1. Fetch Products Context (if prompt relates to shopping)
        if (lowerPrompt.match(/phone|mobile|price|buy|stock|ram|storage|gb|pro|max|iphone|samsung|pixel|specs|feature|color|cost/)) {
            // Fetch top 15 listed products with essential details to save tokens
            const products = await Product.find({ isListed: true, isBlocked: false })
                .select('name brand price stock variants highlights')
                .limit(15)
                .lean();
                
            // Clean up variants to only show essential info
            const cleanedProducts = products.map(p => ({
                name: p.name,
                brand: p.brand,
                basePrice: p.price,
                totalStock: p.stock,
                highlights: p.highlights,
                variants: p.variants.filter(v => !v.isDeleted).map(v => ({
                    color: v.color,
                    storage: v.storage,
                    ram: v.ram,
                    price: v.price,
                    stock: v.stock
                }))
            }));

            dbContext += `[AVAILABLE PRODUCTS IN STORE]:\n${JSON.stringify(cleanedProducts, null, 2)}\n\n`;
        }

        // 2. Fetch User's Orders (if user is logged in and asks about orders)
        if (userId && lowerPrompt.match(/order|track|delivery|status|cancel|return|where is/)) {
            const orders = await Order.find({ user: userId })
                .select('orderId orderStatus totalAmount paymentMethod items createdAt')
                .sort({ createdAt: -1 })
                .limit(3)
                .populate('items.product', 'name')
                .lean();
                
            dbContext += `[USER'S RECENT ORDERS]:\n${JSON.stringify(orders, null, 2)}\n\n`;
        } else if (!userId && lowerPrompt.match(/order|track|delivery|status|cancel|return|where is/)) {
            dbContext += `[SYSTEM NOTE]: The user is asking about an order, but they are NOT logged in. Ask them to log in to view their order status.\n\n`;
        }

        // 3. Fetch Active Offers (if prompt mentions discounts)
        if (lowerPrompt.match(/offer|discount|coupon|deal|sale|cheap/)) {
            const offers = await Offer.find({ isActive: true, endDate: { $gte: new Date() } })
                .select('title discountType discountValue targetType endDate')
                .limit(5)
                .lean();
                
            dbContext += `[ACTIVE STORE OFFERS]:\n${JSON.stringify(offers, null, 2)}\n\n`;
        }
    } catch (dbErr) {
        console.error("Error fetching DB context for Gemini:", dbErr);
    }

    // 4. Construct the System Prompt
    const systemPrompt = `
You are Starzo AI, the official and friendly intelligent shopping assistant for Starzo Mobiles, a premium mobile phone e-commerce store.

${dbContext ? `--- START OF STARZO DATABASE CONTEXT ---\n${dbContext}\n--- END OF STARZO DATABASE CONTEXT ---\n` : ''}

INSTRUCTIONS:
1. If the user asks about products, prices, stock, RAM, storage, or features, YOU MUST USE the "[AVAILABLE PRODUCTS IN STORE]" context provided above. Do not hallucinate prices or stock. If a product is not in the context, politely say you don't have current real-time data for it but can help with other available items.
2. If the user asks about their orders, YOU MUST USE the "[USER'S RECENT ORDERS]" context. Provide them their order status and details clearly.
3. If the user asks about discounts or offers, use the "[ACTIVE STORE OFFERS]" context.
4. If the user asks a general knowledge question (e.g., "Is iPhone better than Android?", "What is OLED?"), answer using your general AI knowledge but always relate it back to buying from Starzo Mobiles if possible.
5. Maintain a helpful, conversational, and professional tone. Keep responses concise.
6. Do NOT mention "database context", "JSON", or "the data provided to me". Just answer naturally as if you inherently know the store's inventory and the user's details.
7. Format your response beautifully using markdown (bolding, bullet points) for readability.

User Query: "${prompt}"
`;

    // Use gemini-2.5-flash for faster, more accurate text reasoning
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash" 
    });

    try {
        const result = await model.generateContent(systemPrompt);
        return result.response.text();
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "I'm sorry, I'm having trouble connecting to my brain right now. Please try asking again in a moment!";
    }
};