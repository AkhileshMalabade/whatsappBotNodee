const express = require('express');
const { Client, LocalAuth, Buttons } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;
const axios = require('axios');

// Middleware
app.use(bodyParser.json());

let client;
let latestQR = null;

// QR Code generation
let qrImageData = null;
let isAuthenticated = false;
// ✅ Define the function before using it
function createClient() {
    client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });
  
    client.on('qr', (qr) => {
      console.log('QR Received');
      latestQR = qr;
    });
  
    client.on('ready', () => {
      console.log('WhatsApp is ready!');
      latestQR = null;
    });
  
    client.on('authenticated', () => {
      console.log('Authenticated with WhatsApp!');
    });
  
    client.on('disconnected', (reason) => {
      console.log('WhatsApp disconnected:', reason);
    });
  
    client.initialize();
  }
  
  // ✅ Initialize client for the first time
  createClient();

client.on('qr', async (qr) => {
    console.log('Scan this QR Code (for terminal):');
    qrcode.generate(qr, { small: true });

    try {
        qrImageData = await require('qrcode').toDataURL(qr); // base64 string
        isAuthenticated = false;
        console.log('QR Code generated for frontend.');
    } catch (err) {
        console.error('❌ Failed to generate QR image for frontend:', err);
    }
});

app.get('/status', (req, res) => {
    if (isAuthenticated) {
        res.json({ status: 'authenticated' });
    } else {
        res.json({ status: 'not_authenticated', qr: qrImageData });
    }
});



client.on('ready', () => {
    isAuthenticated = true;
    qrImageData = null; // Clear QR code data after authentication
    console.log('✅ WhatsApp client is ready!');
});

// Incoming message listener
client.on('message', async message => {
    const msg = message.body.toLowerCase();
    const from = message.from;
    const whatsappNumber = from.split('@')[0];

    console.log(`📨 Message received: ${message.body}`);

    // Basic commands
    if (msg.toLowerCase() === 'hello') {
        await client.sendMessage(from, 'Hi there! 👋');
        return;
    }

    if (msg.toLowerCase() === 'menu') {
        const buttons = new Buttons(
            'Choose one:', // body text
            [ 
                { buttonId: 'option1', buttonText: { displayText: 'Option 1' }, type: 1 }, 
                { buttonId: 'option2', buttonText: { displayText: 'Option 2' }, type: 1 },
                { buttonId: 'exit', buttonText: { displayText: 'Exit' }, type: 1 }
            ], // buttons array
       
        );
    
        try {
            await client.sendMessage(from, buttons);
            console.log('✅ Button message sent');
        } catch (err) {
            console.error('❌ Failed to send button:', err);
        }
        return;
    }

    if (msg.toLowerCase() === 'option 1') {
        await client.sendMessage(from, '✅ You chose Option 1.');
        return;
    }

    if (msg.toLowerCase() === 'option 2') {
        await client.sendMessage(from, '✅ You chose Option 2.');
        return;
    }

    if (msg.toLowerCase() === 'exit') {
        await client.sendMessage(from, '👋 Goodbye!');
        return;
    }

    if(msg.toLowerCase() === "start") {
        await client.sendMessage(from, 'Welcome to JwelsCircle\n Want to invite your fiends ?\n reply with: yes or no');
        return;

    }

    // 1. Handle "verify referral code: xyz"
    if (msg.startsWith('verify referral code:')) {
        const code = message.body.split(':')[1].trim();
        try {
            console.log(`🔍 Verifying referral code: ${code}`);
            const res = await axios.get(`https://referal-production-0e45.up.railway.app/validate-referral?referralCode=${code}&whatsapp=${whatsappNumber}`);
            await delay(2000); // waits properly now
            if (res.data != null) {
        
                await client.sendMessage(from, 'Hello '+res.data.referalName+'\n✅ Referral code verified!\nWould you like to invite your friends? Reply with: yes');
                console.log(`🔍 Referral code verified for: ${res.data.refererwhatsapp}`);
                await client.sendMessage(res.data.refererwhatsapp.toString()+'@c.us', `धन्यवाद! ${res.data.name} तुम्ही ${res.data.referalName} यांना रेफर केल्याबद्दल आमच्याकडून मनःपूर्वक आभार!

केवळ 25 रेफरल पूर्ण करा आणि मिळवा एक सुंदर लेडीज बॅग गिफ्ट म्हणून! 🎁👜

तुमच्या प्रियजनांना लोले ज्वेलर्समध्ये खरेदीसाठी रेफर करा आणि खालील फायदे मिळवा:
✨ गिफ्ट्स
✨ Loyalty Points (जेव्हा रेफर केलेली व्यक्ती खरेदी करते)

आजच रेफरल सुरू करा आणि खास सन्मान मिळवा!
#लोलेज्वेलर्स #
Blue/s/Sharlink.com
                    `);
            } else {
                // You may also want to handle non-success response gracefully
                await client.sendMessage(from, '❌ Invalid referral code. Please check again.');
            }
        } catch (err) {
            console.error("Referral code verification error:", err.message || err);
            await client.sendMessage(from, '❌ Invalid referral code. Please check again.');
        }
        
        return;
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
     
    // 2. Handle "yes" after referral validation
    if (msg.toLowerCase() === 'yes') {
        try {
            const number = from.split('@')[0];
            console.log(`🔗 Generating referral code for: ${number}`);
            const res = await axios.get(`https://referal-production-0e45.up.railway.app/generate-code?whats=${number}`);
            console.log(`🔗 Generated referral code: ${res.data.referralCode}`);
            await delay(2000); // waits properly now
            const referralCode = res.data.referralCode;
            const referralLink = `https://referaltesting.netlify.app/?ref=${referralCode}`;
            await client.sendMessage(from, `🎉Invitation link:\n${referralLink}`);
            await client.sendMessage(from, 'Share this link with your friends!');
            await client.sendMessage(from, 'Here you dash board link:\n https://referaltesting.netlify.app/dashboard?id='+from);
        } catch (err) {
            console.error(err.message || err);
            await client.sendMessage(from, '⚠️ Could not generate referral link. Please try again later.');
        }
        return;
    }

});

// REST Endpoint to send message
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ error: 'number and message are required' });
    }

    // WhatsApp numbers must be like: 919999999999@c.us
    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

    try {
        await client.sendMessage(chatId, message);
        res.json({ status: 'success', message: 'Message sent' });
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});
function deleteSessionFolder() {
    const sessionPath = path.join(__dirname, '.wwebjs_auth');   
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log('✅ Session folder deleted');
    }
  }
// ✅ Logout + reinitialize
app.get('/logout', async (req, res) => {
  console.log('🔁 Logging out...');

  try {
    if (client) {
      await client.logout();       // ✅ Log out from WhatsApp first
      console.log('✅ WhatsApp logged out');

      await client.destroy();      // ✅ Then destroy Puppeteer instance
      console.log('✅ Puppeteer client destroyed');

      client = null;
      latestQR = null;
      isAuthenticated = false;
      qrImageData = null;

      // ✅ Wait a moment before deleting the folder
      setTimeout(() => {
        deleteSessionFolder();     // 🧹 Now it's safe to delete
        createClient();            // 🔁 Start fresh session
      }, 1000);

      res.status(200).send({ message: 'Logged out and resetting session...' });
    } else {
      res.status(400).send({ error: 'No active session found.' });
    }
  } catch (err) {
    console.error('❌ Logout error:', err.message);
    res.status(500).send({ error: 'Logout failed', details: err.message });
  }
});




// Start Express server
app.listen(port, () => {
    console.log(`🚀 Express server running on http://referal-production-0e45.up.railway.app:${port}`);
});


