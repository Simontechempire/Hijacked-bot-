const {
    default: makeWASocket,
    useMultiFileAuthState
} = require("@whiskeysockets/baileys");

const express = require("express");
const pino = require("pino");
const fs = require("fs");
const path = require("path");

const config = require("./config");

const app = express();
app.use(express.json());

let sock = null;
let authState = null;
let initPromise = null;
let pairingBusy = false;

const plugins = new Map();
const PLUGIN_DIR = path.join(__dirname, "plugins");

// Load plugins
function loadPlugins() {
    if (!fs.existsSync(PLUGIN_DIR)) {
        fs.mkdirSync(PLUGIN_DIR, { recursive: true });
    }

    plugins.clear();

    const files = fs.readdirSync(PLUGIN_DIR);

    for (const file of files) {
        if (!file.endsWith(".js")) continue;

        const name = path.basename(file, ".js").toLowerCase();

        // Keep destructive group-hijacking commands disabled.
        if (name === "hijacked") {
            console.log(`Plugin enable: ${name}`);
            continue;
        }

        const filePath = path.join(PLUGIN_DIR, file);

        try {
            delete require.cache[require.resolve(filePath)];

            const plugin = require(filePath);

            if (typeof plugin !== "function") {
                console.log(`Invalid plugin: ${file}`);
                continue;
            }

            plugins.set(name, plugin);
            console.log(`Loaded plugin: ${name}`);

        } catch (error) {
            console.error(`Plugin loading error (${file}):`, error.message);
        }
    }

    console.log(`Total plugins loaded: ${plugins.size}`);
}

// WhatsApp connection
async function startWhatsApp() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const { state, saveCreds } =
            await useMultiFileAuthState("./auth_info");

        authState = state;

        sock = makeWASocket({
            auth: state,
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", ({ connection }) => {
            console.log("WhatsApp connection:", connection);

            if (connection === "close") {
                sock = null;
                initPromise = null;

                setTimeout(() => {
                    startWhatsApp().catch(console.error);
                }, 5000);
            }
        });

        // Incoming messages and plugin commands
        sock.ev.on("messages.upsert", async ({ messages }) => {
            for (const m of messages) {
                try {
                    if (!m.message || m.key.fromMe) continue;

                    const chat = m.key.remoteJid;
                    if (!chat) continue;

                    const message =
                        m.message.conversation ||
                        m.message.extendedTextMessage?.text ||
                        m.message.imageMessage?.caption ||
                        m.message.videoMessage?.caption ||
                        "";

                    const prefix = config.prefix || config.PREFIX || ".";

                    if (!message.startsWith(prefix)) continue;

                    const args = message.trim().split(/\s+/);
                    const command = args[0]
                        .slice(prefix.length)
                        .toLowerCase();

                    const plugin = plugins.get(command);

                    if (!plugin) continue;

                    // Add useful message properties
                    m.chat = chat;
                    m.sender = m.key.participant || chat;
                    m.text = message;
                    m.args = args.slice(1);
                    m.command = command;
                    m.isGroup = chat.endsWith("@g.us");

                    await plugin(sock, m, config);

                } catch (error) {
                    console.error("Message/Plugin error:", error);
                }
            }
        });

        return sock;
    })();

    try {
        return await initPromise;
    } catch (error) {
        initPromise = null;
        sock = null;
        throw error;
    }
}

// Pairing API
app.get("/generate-code", async (req, res) => {
    if (pairingBusy) {
        return res.status(429).json({
            error: "A pairing request is already processing."
        });
    }

    const phone = String(req.query.phone || "").replace(/\D/g, "");

    if (!/^\d{10,15}$/.test(phone)) {
        return res.status(400).json({
            error: "Enter a valid phone number with country code."
        });
    }

    pairingBusy = true;

    try {
        const client = await startWhatsApp();

        if (authState.creds.registered) {
            return res.status(409).json({
                error: "This WhatsApp session is already registered."
            });
        }

        const code = await client.requestPairingCode(phone);

        return res.json({
            success: true,
            code
        });

    } catch (error) {
        console.error("Pairing error:", error);

        return res.status(500).json({
            error: "Pairing failed. Please try again.",
            details: error.message
        });

    } finally {
        pairingBusy = false;
    }
});

// Website
app.use(express.static(path.join(__dirname, "public")));

// Start server
const PORT = process.env.PORT || 3000;

loadPlugins();

app.listen(PORT, () => {
    console.log(`Lord Developer Server running on port ${PORT}`);
    startWhatsApp().catch(console.error);
});
