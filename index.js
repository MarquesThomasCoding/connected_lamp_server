// index.js
const express = require('express');
const WebSocket = require('ws');
const app = express();
const port = 8765;

const wss = new WebSocket.Server({ noServer: true });
const clients = new Map(); // Map lampeId -> WebSocket
const monitors = new Map(); // Map lampeId -> [WebSocket clients]

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Autorise toutes les origines
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Envoie une commande à la lampe
app.post('/lampe/:id/commande', (req, res) => {
  const id = req.params.id;
  const cmd = req.body;
  console.log(`Reçu commande pour lampe ${id}:`, cmd); // Ajout de journalisation
  const ws = clients.get(id);
  console.log(`WebSocket pour lampe ${id}:`, ws ? 'connecté' : 'non connecté'); // Journalisation de l'état de la WebSocket
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log(`Envoi de la commande à la lampe ${id}`); // Ajout de journalisation
    ws.send(JSON.stringify(cmd));
    res.sendStatus(200);
  } else {
    console.log(`Lampe ${id} non connectée ou WebSocket fermé.`); // Ajout de journalisation
    res.status(404).send('Lampe non connectée');
  }
});

// Serveur HTTP/WS combiné
const server = app.listen(port, () => {
  console.log(`Serveur sur http://localhost:${port}`);
});

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const id = data.id;
      
      if (data.type === "register") {
        clients.set(id, ws);
        console.log(`Lampe ${id} enregistrée avec WebSocket.`);
      } else if (data.type === "monitor") {
        if (!monitors.has(id)) monitors.set(id, []);
        monitors.get(id).push(ws);
        console.log(`Client monitor connecté à ${id}`);
      } else if (data.status) {
        const observers = monitors.get(id) || [];
        for (const obs of observers) {
          if (obs.readyState === WebSocket.OPEN) {
            obs.send(JSON.stringify({ status: data.status }));
          }
        }
      }
    } catch (e) {
      console.error("Erreur message:", e);
    }
  });

  ws.on('close', () => {
    for (const [id, clientWs] of clients.entries()) {
      if (clientWs === ws) {
        clients.delete(id);
        console.log(`Lampe ${id} déconnectée.`);
      }
    }
  });
});

