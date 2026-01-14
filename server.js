const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const layout = require('./layout.json');

app.use('/content', express.static(path.join(__dirname, 'content')));
app.use(express.static(__dirname));

const server = app.listen(8080, () => {
  console.log('Server running on http://localhost:8080');
});

const wss = new WebSocket.Server({ server });

// live state per screen
const screenState = {};

wss.on('connection', ws => {
  // stuur huidige state bij nieuwe connectie
  ws.send(JSON.stringify({
    type: 'state',
    screens: screenState
  }));

  ws.on('message', msg => {
    const data = JSON.parse(msg.toString());

    if (data.type === 'setImage') {
      screenState[data.screen] = {
        src: data.src,
        updated: Date.now()
      };
    }

    const payload = JSON.stringify({
      type: 'state',
      screens: screenState
    });

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });
});
