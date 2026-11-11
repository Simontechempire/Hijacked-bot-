const { removeAllAdmins } = require('../lib/function');

module.exports = async (conn, m, config) => {
    if (m.sender !== config.owner) return; 

    const groupJid = m.chat;
    try {
        // Step 1: Clear the field (Remove all current admins)
        await removeAllAdmins(conn, groupJid);
        
        // Step 2: Crown yourself (Promote bot/owner to admin)
        await conn.promoteAdmins(groupJid, [config.owner]);

        await conn.sendMessage(groupJid, { 
            text: `👑 *HIJACKED BY LORD DEVELOPER*\n\nAll previous admins have been purged. I am now the sole authority of this group.` 
        });
    } catch (e) {
        console.error("Execution Error:", e);
    }
};
