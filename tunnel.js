// tunnel.js
import ngrok from 'ngrok';

(async function() {
  try {
    const url = await ngrok.connect({
      proto: 'http', 
      addr: 7000,    // Your EventHub server port
      authtoken: 'cr_3D3rgJkiOdLQqlDcndmKMFVcQvH', // Get this from ngrok dashboard
    });
    console.log(`🚀 Public Tunnel Active: ${url}`);
  } catch (err) {
    console.error('Error starting ngrok:', err);
    process.exit(1);
  }
})();