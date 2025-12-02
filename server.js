const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// GAME STATE
let players = {};
let targets = [];
let targetSpawnRate = 1200; // ms
let targetId = 1;

// Spawn targets every X ms
setInterval(() => {
  const t = {
    id: targetId++,
    x: Math.random() * 800,
    y: Math.random() * 500,
    r: 30
  };
  targets.push(t);
  io.emit("targetSpawn", t);
}, targetSpawnRate);

// Remove target if hit
function removeTarget(id) {
  targets = targets.filter(t => t.id !== id);
}

io.on("connection", socket => {
  console.log("Player connected:", socket.id);

  // Add player
  players[socket.id] = {
    id: socket.id,
    x: 400,
    y: 250,
    score: 0
  };

  // send initial state
  socket.emit("init", { players, targets });

  // broadcast new player
  socket.broadcast.emit("playerJoin", players[socket.id]);

  // move event
  socket.on("move", pos => {
    if (!players[socket.id]) return;
    players[socket.id].x = pos.x;
    players[socket.id].y = pos.y;
    io.emit("playerMove", { id: socket.id, x: pos.x, y: pos.y });
  });

  // player shoots
  socket.on("shoot", shot => {
    for (const t of targets) {
      const dx = shot.x - t.x;
      const dy = shot.y - t.y;
      if (Math.hypot(dx, dy) <= t.r) {
        // hit!
        players[socket.id].score++;
        io.emit("scoreUpdate", { id: socket.id, score: players[socket.id].score });

        io.emit("targetHit", t.id);
        removeTarget(t.id);
        break;
      }
    }
  });

  // disconnect
  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerLeave", socket.id);
    console.log("Player disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log("Server running on", PORT));
