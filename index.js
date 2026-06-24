const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot Actif'));
app.listen(process.env.PORT || 3000, () => console.log('Serveur en ligne'));
const { default: makeWASocket, useMultiFileAuthState, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message) return;

        const chatJid = msg.key.remoteJid;
        let viewOnceType = null;
        let mediaData = null;

        if (msg.message.viewOnceMessageV2) {
            const viewOnceMessage = msg.message.viewOnceMessageV2.message;
            if (viewOnceMessage.imageMessage) { viewOnceType = 'image'; mediaData = viewOnceMessage.imageMessage; }
            if (viewOnceMessage.videoMessage) { viewOnceType = 'video'; mediaData = viewOnceMessage.videoMessage; }
        }

        if (viewOnceType && mediaData) {
            try {
                const stream = await downloadContentFromMessage(mediaData, viewOnceType);
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                if (viewOnceType === 'image') {
                    await sock.sendMessage(chatJid, { image: buffer, caption: '✨ Média récupéré' });
                } else if (viewOnceType === 'video') {
                    await sock.sendMessage(chatJid, { video: buffer, caption: '✨ Média récupéré' });
                }
            } catch (error) {
                console.error("Erreur de téléchargement :", error);
            }
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'close') startBot();
    });
}
startBot();
