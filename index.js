const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const Groq = require("groq-sdk");

const app = express();
app.use(express.json());

// ENV variables (Back4app থেকে আসবে)
const TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL; 
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PORT = process.env.PORT || 3000;
const SUPER_ADMIN = process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID) : null;

// হেলথ চেক রুট (এটি সবার আগে যাতে পোর্ট ডিটেক্ট হয়)
app.get("/", (req, res) => {
  res.status(200).send("থটস অফ লেউটা Bot Server Running ✅");
});

// সার্ভার লিসেনিং
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// ডাটাবেজ (সিম্পল ইন-মেমোরি)
let db = {
    users: [],
    banned: [],
    startTime: Date.now()
};

if (!TOKEN || !APP_URL || !GROQ_API_KEY) {
    console.error("❌ CRITICAL ERROR: API keys are missing in Environment Variables!");
} else {
    const bot = new TelegramBot(TOKEN);
    const groq = new Groq({ apiKey: GROQ_API_KEY });

    // Webhook setup
    bot.setWebHook(`${APP_URL}/bot${TOKEN}`);

    app.post(`/bot${TOKEN}`, (req, res) => {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });

    // ১. ইউজার ট্র্যাকিং মিডলওয়্যার
    bot.on('message', (msg) => {
        if (msg.from && !db.users.includes(msg.from.id)) {
            db.users.push(msg.from.id);
        }
    });

    // ২. অ্যাডমিন প্যানেল কমান্ড (/admin)
    bot.onText(/\/admin/, (msg) => {
        if (msg.from.id !== SUPER_ADMIN) return bot.sendMessage(msg.chat.id, "তোর অউকাত নাই এই কমান্ড দেওয়ার। 🥴");
        
        bot.sendMessage(msg.chat.id, "🧑‍💼 থটস অফ লেউটা - Admin Panel", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📊 Stats", callback_data: "stats" }, { text: "🟢 Status", callback_data: "status" }],
                    [{ text: "📢 Broadcast", callback_data: "bc_req" }]
                ]
            }
        });
    });

    // ৩. রোস্টিং এবং নাম চেক লজিক
    bot.on('message', async (msg) => {
        if (msg.text && msg.text.startsWith('/')) return; // কমান্ড ইগনোর
        if (db.banned.includes(msg.from.id)) return;

        // নাম জিজ্ঞাসা করলে
        const text = msg.text || "";
        if (text.includes('নাম কি') || text.includes('তোর নাম')) {
            return bot.sendMessage(msg.chat.id, "আমার নাম 'থটস অফ লেউটা' 🥴😎");
        }

        try {
            const prompt = "You are a savage, funny, and extremely rude Bengali roaster named 'থটস অফ লেউটা'. Use 'তুই-তোকারি'. Be informal and use local slang (বলদ, আবাল, ফকিন্নি). Roast the user based on their input.";
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: text || "ছবি পাঠাইছে আবালটা" }
                ],
                model: "llama3-8b-8192",
            });

            bot.sendMessage(msg.chat.id, completion.choices[0].message.content, {
                reply_to_message_id: msg.message_id
            });
        } catch (e) {
            console.error("AI Error:", e.message);
        }
    });

    // ৪. ব্রডকাস্টিং কমান্ড
    bot.onText(/\/send (.+)/, (msg, match) => {
        if (msg.from.id !== SUPER_ADMIN) return;
        const bcMsg = match[1];
        let count = 0;
        db.users.forEach(uid => {
            bot.sendMessage(uid, bcMsg).catch(() => {});
            count++;
        });
        bot.sendMessage(msg.chat.id, `📢 ${count} জন ফকিন্নিকে মেসেজ পাঠানো হয়েছে।`);
    });

    // ৫. ইনলাইন বাটন হ্যান্ডলার
    bot.on('callback_query', (query) => {
        const chatId = query.message.chat.id;
        if (query.data === 'stats') {
            bot.sendMessage(chatId, `📊 Stats:\nTotal Users: ${db.users.length}\nBanned: ${db.banned.length}`);
        } else if (query.data === 'status') {
            const uptime = Math.floor((Date.now() - db.startTime) / 1000 / 60);
            bot.sendMessage(chatId, `🟢 Bot Status: Online\n⏳ Uptime: ${uptime} mins\n⚙️ Name: থটস অফ লেউটা`);
        } else if (query.data === 'bc_req') {
            bot.sendMessage(chatId, "ব্রডকাস্ট করতে লেখো: \n/send [মেসেজ]");
        }
    });
}
