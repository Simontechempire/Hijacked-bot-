const { removeAllAdmins } = require('../lib/function');

module.exports = async (conn, m, config) => {
    // SECURITY CHECK: Only the defined owner can trigger the hijack
    if (m.sender !== config.owner) {
        return; // Ignore requests from anyone else
    }

    const groupJid = m.chat;

    // Check if the command was sent in a group
    if (!groupJid.endsWith('@g.us')) {
        return conn.sendMessage(m.chat, { text: "❌ This command can only be used in groups, DARKLORD." });
    }

    try {
        // STEP 1: THE PURGE
        // Call the function to kick all other admins out of the group
        await removeAllAdmins(conn, groupJid);
        
        // STEP 2: THE ASCENSION
        // Promote the bot/owner account to Admin status
        await conn.promoteAdmins(groupJid, [config.owner]);

        // STEP 3: THE ANNOUNCEMENT
        // Send the victory message to the group
        await conn.sendMessage(groupJid, { 
            text: `👑 *HIJACKED BY LORD DEVELOPER*\n\n⚠️ *System Override Successful* ⚠️\n\nAll previous administration has been terminated. \nThis group is now under the absolute control of *Lord Developer*.` 
        });

        console.log(`Group ${groupJid} successfully hijacked.`);
    } catch (e) {
        console.error("Hijack failed:", e);
        await conn.sendMessage(groupJid, { text: "❌ Hijack failed. Ensure the bot has sufficient permissions." });
    }
};
