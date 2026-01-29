const { Telegraf, Markup } = require('telegraf');
const Groq = require('groq-sdk');
const fs = require('fs-extra');

// কনফিগারেশন
const BOT_TOKEN = '8300384542:AAHEu-h1spDlBq_R0Y1uDbO1MdY9BpH6rX8';
const GROQ_API_KEY = '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';
const SUPER_ADMIN_ID = 7832264582; // তোমার টেলিগ্রাম আইডি এখানে দাও
const DB_FILE = './database.json';

const bot = new Telegraf(BOT_TOKEN);
const groq = new Groq({ apiKey: GROQ_API_KEY });

// ডাটাবেজ হ্যান্ডলিং
let db = {
    users: [],
    admins: [SUPER_ADMIN_ID],
    banned: [],
    settings: { autoReply: true, welcomeMsg: "কিরে আবাল? আসলি অপমান হতে?" },
    startTime: Date.now()
};

if (fs.existsSync(DB_FILE)) db = fs.readJsonSync(DB_FILE);
const saveDB = () => fs.writeJsonSync(DB_FILE, db);

// মিডলওয়্যার: ইউজার ট্র্যাকিং ও সিকিউরিটি
bot.use(async (ctx, next) => {
    if (!ctx.from) return;
    if (!db.users.includes(ctx.from.id)) {
        db.users.push(ctx.from.id);
        saveDB();
    }
    if (db.banned.includes(ctx.from.id)) return ctx.reply("তুই ব্যান! ভাগ এখান থেকে।");
    return next();
});

// --- এডমিন প্যানেল ---
bot.command('admin', (ctx) => {
    if (!db.admins.includes(ctx.from.id)) return ctx.reply("তোর অউকাত নাই এই প্যানেলে ঢোকার।");
    
    ctx.reply("🧑‍💼 WhatsApp Leo Admin Panel", Markup.inlineKeyboard([
        [Markup.button.callback('📊 Stats', 'stats'), Markup.button.callback('📢 Broadcast', 'bc_menu')],
        [Markup.button.callback('🚫 User Manage', 'user_m'), Markup.button.callback('⚙️ Settings', 'set_menu')],
        [Markup.button.callback('🟢 Status', 'bot_status')]
    ]));
});

// --- ১. লাইভ স্ট্যাটাস ---
bot.action('bot_status', (ctx) => {
    const uptime = Math.floor((Date.now() - db.startTime) / 1000 / 60);
    ctx.answerCbQuery();
    ctx.reply(`🟢 Status: Online\n⏳ Uptime: ${uptime} minutes\n⚡ Server: Back4app`);
});

// --- ২. স্ট্যাটিস্টিকস ---
bot.action('stats', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply(`📊 Stats:\nTotal Users: ${db.users.length}\nAdmins: ${db.admins.length}\nBanned: ${db.banned.length}`);
});

// --- ৩. ব্রডকাস্ট সিস্টেম ---
bot.action('bc_menu', (ctx) => {
    ctx.reply("ব্রডকাস্ট করতে মেসেজটি আমাকে ফরওয়ার্ড করো অথবা লেখো: \n/send [তোমার মেসেজ]");
});

bot.command('send', (ctx) => {
    if (!db.admins.includes(ctx.from.id)) return;
    const text = ctx.message.text.replace('/send ', '');
    let count = 0;
    db.users.forEach(uid => {
        bot.telegram.sendMessage(uid, text).catch(() => {});
        count++;
    });
    ctx.reply(`📢 ${count} জন ফকিন্নিকে মেসেজ পাঠানো হয়েছে।`);
});

// --- ৪. ইউজার ম্যানেজমেন্ট (Ban/Unban) ---
bot.command('ban', (ctx) => {
    if (ctx.from.id !== SUPER_ADMIN_ID) return;
    const id = parseInt(ctx.message.text.split(' ')[1]);
    if (id && !db.banned.includes(id)) {
        db.banned.push(id);
        saveDB();
        ctx.reply(`ইউজার ${id} কে লাথি মেরে বের করা হয়েছে।`);
    }
});

// --- ৫. রোস্টিং লজিক (AI) ---
bot.on(['text', 'photo', 'video'], async (ctx) => {
    if (ctx.message.text && ctx.message.text.startsWith('/')) return;
    if (!db.settings.autoReply) return;

    if (ctx.message.text && (ctx.message.text.includes('নাম কি') || ctx.message.text.includes('তোর নাম'))) {
        return ctx.reply('আমার নাম হোয়াটসঅ্যাপ লেও ওটা 🥴😎');
    }

    try {
        const prompt = "You are a savage, funny, and extremely rude Bengali roaster. Use 'তুই-তোকারি'. Be informal, use local slang like 'আবাল', 'বলদ', 'ফকিন্নি'. Roast the user based on their input.";
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: prompt },
                { role: "user", content: ctx.message.text || "এই ছবি/ভিডিও টা দেখ আর আমাকে পচা।" }
            ],
            model: "llama3-8b-8192",
        });
        ctx.reply(completion.choices[0].message.content, { reply_to_message_id: ctx.message.message_id });
    } catch (err) {
        console.error(err);
    }
});

bot.launch().then(() => console.log("বট পুরাপুরি রেডি!"));
