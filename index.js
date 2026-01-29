const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const Groq = require("groq-sdk");

const app = express();
app.use(express.json());

// ===== ENV =====
const TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ADMIN_ID = process.env.ADMIN_ID ? Number(process.env.ADMIN_ID) : null;
const PORT = process.env.PORT || 3000;

// ===== VALIDATION =====
if (!TOKEN || !APP_URL || !GROQ_API_KEY || !ADMIN_ID) {
  console.error("❌ Missing ENV variables");
  process.exit(1);
}

// ===== DATABASE (IN-MEMORY) =====
const db = {
  users: {}, // id: { msgs, joined }
  banned: new Set(),
  cooldown: {},
  startTime: Date.now()
};

// ===== HEALTH CHECK =====
app.get("/", (_, res) => {
  res.send("থটস অফ লেউটা Bot is Alive ✅");
});

// ===== BOT INIT =====
const bot = new TelegramBot(TOKEN, { polling: false });
const groq = new Groq({ apiKey: GROQ_API_KEY });

// ===== WEBHOOK =====
bot.setWebHook(`${APP_URL}/bot${TOKEN}`);
app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ===== UTILS =====
const isAdmin = (id) => id === ADMIN_ID;
const now = () => Date.now();

// ===== MESSAGE HANDLER =====
bot.on("message", async (msg) => {
  const uid = msg.from?.id;
  if (!uid) return;

  // Register user
  if (!db.users[uid]) {
    db.users[uid] = { msgs: 0, joined: now() };
  }
  db.users[uid].msgs++;

  // Ban check
  if (db.banned.has(uid)) return;

  // Ignore commands
  if (msg.text?.startsWith("/")) return;

  // Anti-spam (5s)
  if (db.cooldown[uid] && now() - db.cooldown[uid] < 5000) {
    return bot.sendMessage(msg.chat.id, "🐸 ধীরে বলদ, সার্ভার গরম হয়ে যাচ্ছে");
  }
  db.cooldown[uid] = now();

  const text = msg.text || "ছবি পাঠাইছে আবালটা";

  // Name question
  if (/নাম কি|তোর নাম/i.test(text)) {
    return bot.sendMessage(msg.chat.id, "আমার নাম ‘থটস অফ লেউটা’ 😎");
  }

  // AI Roast
  try {
    const res = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        {
          role: "system",
          content:
            "You are a savage, funny Bengali roaster named 'থটস অফ লেউটা'. Use তুই-তোকারি, slang like বলদ, আবাল, ফকিন্নি."
        },
        { role: "user", content: text }
      ]
    });

    await bot.sendMessage(
      msg.chat.id,
      res.choices[0].message.content,
      { reply_to_message_id: msg.message_id }
    );
  } catch (e) {
    console.error("AI Error:", e.message);
    bot.sendMessage(msg.chat.id, "আজ মাথা গরম, পরে আয় 😤");
  }
});

// ===== ADMIN =====
bot.onText(/\/admin/, (msg) => {
  if (!isAdmin(msg.from.id)) return;

  bot.sendMessage(msg.chat.id, "🧑‍💼 Admin Panel", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📊 Stats", callback_data: "stats" }],
        [{ text: "⏳ Uptime", callback_data: "uptime" }],
        [{ text: "📢 Broadcast", callback_data: "bc" }]
      ]
    }
  });
});

// ===== BAN SYSTEM =====
bot.onText(/\/ban (\d+)/, (msg, m) => {
  if (!isAdmin(msg.from.id)) return;
  db.banned.add(Number(m[1]));
  bot.sendMessage(msg.chat.id, "🔨 User banned");
});

bot.onText(/\/unban (\d+)/, (msg, m) => {
  if (!isAdmin(msg.from.id)) return;
  db.banned.delete(Number(m[1]));
  bot.sendMessage(msg.chat.id, "✅ User unbanned");
});

// ===== BROADCAST =====
bot.onText(/\/send (.+)/, (msg, m) => {
  if (!isAdmin(msg.from.id)) return;
  const text = m[1];
  Object.keys(db.users).forEach((id) =>
    bot.sendMessage(id, text).catch(() => {})
  );
  bot.sendMessage(msg.chat.id, "📢 Broadcast sent");
});

// ===== INLINE HANDLER =====
bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;

  if (q.data === "stats") {
    bot.sendMessage(
      chatId,
      `👥 Users: ${Object.keys(db.users).length}\n🚫 Banned: ${db.banned.size}`
    );
  }

  if (q.data === "uptime") {
    const mins = Math.floor((now() - db.startTime) / 60000);
    bot.sendMessage(chatId, `⏳ Uptime: ${mins} minutes`);
  }

  if (q.data === "bc") {
    bot.sendMessage(chatId, "ব্যবহার কর:\n/send মেসেজ");
  }
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
});
