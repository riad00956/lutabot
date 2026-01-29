const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const Groq = require("groq-sdk");

const app = express();
app.use(express.json());

// ENV Variables (Back4app ড্যাশবোর্ড থেকে সেট করবে)
const TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL; 
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PORT = process.env.PORT || 3000;
const SUPER_ADMIN = parseInt(process.env.ADMIN_ID); // তোমার টেলিগ্রাম আইডি

const bot = new TelegramBot(TOKEN);
const groq = new Groq({ apiKey: GROQ_API_KEY });

// ইন-মেমোরি ডাটাবেজ (সিম্পল রাখার জন্য)
let db = {
    users: [],
    admins: [SUPER_ADMIN],
    banned: [],
    startTime: Date.now()
};

// Webhook Setup
bot.setWebHook(`${APP_URL}/bot${TOKEN}`);

app.post(`/bot${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// --- লজিক শুরু ---

// ইউজার ট্র্যাকিং
bot.on('message', (msg) => {
    if (msg.from && !db.users.includes(msg.from.id)) {
        db.users.push(msg.from.id);
    }
});

// এডমিন কমান্ড
bot.onText(/\/admin/, (msg) => {
    if (msg.from.id !== SUPER_ADMIN) return bot.sendMessage(msg.chat.id, "তোর অউকাত নাই!");
    
    bot.sendMessage(msg.chat.id, "🧑‍💼 Admin Panel", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📊 Stats", callback_data: "stats" }, { text: "🟢 Status", callback_data: "status" }]
            ]
        }
    });
});

// রোস্টিং লজিক
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return; // কমান্ড ইগনোর করবে
    if (db.banned.includes(msg.from.id)) return;

    // নাম জিজ্ঞাসা করলে
    if (msg.text && (msg.text.includes('নাম কি') || msg.text.includes('তোর নাম'))) {
        return bot.sendMessage(msg.chat.id, "আমার নাম হোয়াটসঅ্যাপ লেও ওটা 🥴😎");
    }

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a savage Bengali roaster 'হোয়াটসঅ্যাপ লেও ওটা 🥴😎'. Use 'তুই-তোকারি'. Be extremely funny, local, and rude to the user." },
                { role: "user", content: msg.text || "এই ছবি বা ভিডিওটা দেখ" }
            ],
            model: "llama3-8b-8192",
        });

        bot.sendMessage(msg.chat.id, chatCompletion.choices[0].message.content, {
            reply_to_message_id: msg.message_id
        });
    } catch (e) {
        console.error("AI Error");
    }
});

// Callback Query Handler (Admin Buttons)
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    if (query.data === 'stats') {
        bot.sendMessage(chatId, `Total Users: ${db.users.length}\nBanned: ${db.banned.length}`);
    } else if (query.data === 'status') {
        const uptime = Math.floor((Date.now() - db.startTime) / 1000 / 60);
        bot.sendMessage(chatId, `Bot is Live ✅\nUptime: ${uptime} mins`);
    }
});

// Health Check & Root
app.get("/", (req, res) => res.send("WhatsApp Leo Bot is Running... 🥴"));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
