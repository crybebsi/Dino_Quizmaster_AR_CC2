const WebSocket = require('ws');

// WebSocket-Server auf Port 8080 starten
const wss = new WebSocket.Server({ port: 8080 });

console.log('WebSocket Server läuft auf ws://localhost:8080');

let players = [];
let currentQuestionIndex = -1;
let questionTimeout = null;

const questions = [
  {
    question: 'Was bedeutet das Wort "Dinosaurier"?',
    answers: ['Riesenechse', 'Urzeitmonster', 'Schuppentier', 'Knochenläufer'],
    correct: 0
  },
  {
    question: 'Woraus schlüpften Dinosaurier?',
    answers: ['Steine', 'Eier', 'Bäume', 'Kristalle'],
    correct: 1
  },
  {
    question: 'Wie haben Dinosaurier vermutlich kommuniziert?',
    answers: ['Durch Singen wie Vögel', 'Durch Brüllen und Körperbewegungen', 'Durch Schreiben auf Steinen', 'Durch Rauchzeichen'],
    correct: 1
  },
  {
    question: 'In welcher Zeit lebten die meisten Dinosaurier?',
    answers: ['Mittelalter', 'Tertiär', 'Kreidezeit', 'Quartär'],
    correct: 2
  },
  {
    question: 'Wie nennt man Forscher, die sich mit Dinos beschäftigen?',
    answers: ['Dinoologen', 'Architekten', 'Paläontologen', 'Terraristen'],
    correct: 2
  },
  {
    question: 'Welcher dieser Dinosaurier war ein Pflanzenfresser?',
    answers: ['Velociraptor', 'Stegosaurus', 'Tyrannosaurus Rex', 'Spinosaurus'],
    correct: 1
  },
  {
    question: 'Wo wurden die meisten Dinosaurier-Fossilien gefunden?',
    answers: ['Europa', 'Nordamerika', 'Afrika', 'Australien'],
    correct: 1
  },
  {
    question: 'Warum starben die Dinosaurier vermutlich aus?',
    answers: ['Ein Virus', 'Ein Meteoriteneinschlag', 'Dinosaurier-Krieg', 'Mangel an Wasser'],
    correct: 1
  },
  {
    question: 'Welches heutige Tier ist mit Dinos verwandt?',
    answers: ['Krokodil', 'Chamäleon', 'Huhn', 'Schlange'],
    correct: 2
  },
  {
    question: 'Welcher Dino hatte drei Hörner im Gesicht?',
    answers: ['T-Rex', 'Triceratops', 'Brachiosaurus', 'Velociraptor'],
    correct: 1
  }
];

// Nachricht an alle verbundenen Clients senden
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Spieler-Liste an alle Clients senden
function sendPlayerList() {
  broadcast({ 
    type: 'player-list', 
    players: players.map(p => ({ name: p.name, dinoId: p.dinoId, points: p.points })) 
  });
}

// Quiz starten
function startQuiz() {
  currentQuestionIndex = 0;
  broadcastQuestion();
}

// Aktuelle Frage an alle Spieler senden
function broadcastQuestion() {
  if (currentQuestionIndex >= questions.length) {
    const ranking = players
      .map(p => ({ name: p.name, dinoId: p.dinoId, points: p.points }))
      .sort((a, b) => b.points - a.points);
    console.log('Ranking:', ranking); // Debugging-Log
    broadcast({ type: 'ranking', ranking });
    questionTimeout = null;
    return;
  }

  const q = questions[currentQuestionIndex];
  broadcast({
    type: 'question',
    question: q.question,
    answers: q.answers
  });

  // Timeout für nächste Frage
  questionTimeout = setTimeout(() => {
    currentQuestionIndex++;
    broadcastQuestion();
  }, 15000); // 15 Sekunden pro Frage
}

wss.on('connection', ws => {
  ws.on('message', msg => {
    console.log('Nachricht vom Client empfangen:', msg);
    // Verarbeite die Nachricht hier

    try {
      const data = JSON.parse(msg);

      if (data.type === 'join') {
        if (!data.name || !data.dinoId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Name und Dino sind erforderlich' }));
          return;
        }
        ws.player = { name: data.name, dinoId: data.dinoId, points: 0 };
        players.push(ws.player);
        console.log(`${data.name} ist beigetreten`);

        sendPlayerList();

        // Erster Spieler = Host
        if (players.length === 1) {
          ws.isHost = true;
          ws.send(JSON.stringify({ type: 'host-assigned' }));
        } else {
          ws.isHost = false;
        }
      }

      if (data.type === 'start-quiz') {
        if (!ws.isHost) {
          ws.send(JSON.stringify({ type: 'error', message: 'Nur Host kann starten' }));
          return;
        }
        players.forEach(p => p.points = 0);
        currentQuestionIndex = -1;
        if (questionTimeout) {
          clearTimeout(questionTimeout);
          questionTimeout = null;
        }
        startQuiz();
      }

      if (data.type === 'answer') {
        if (!ws.player) return;

        const currentQ = questions[currentQuestionIndex];
        if (!currentQ) return;

        const correct = currentQ.correct;
        if (data.answer === correct) {
          ws.player.points += 10; // 10 Punkte für richtige Antwort
        }

        // Antwort auswerten und an alle Spieler senden
        broadcast({
          type: 'answer-result',
          correct,
          player: ws.player.name,
          points: ws.player.points
        });
      }
    } catch (e) {
      console.error('Fehler beim Verarbeiten der Nachricht:', e);
    }
  });

  ws.on('close', () => {
    if (ws.player) {
      const wasHost = ws.isHost;
      players = players.filter(p => p !== ws.player);
      console.log(`${ws.player.name} hat das Spiel verlassen`);

      if (wasHost && players.length > 0) {
        // Neuer Host wird zugewiesen
        const newHost = players[0];
        newHost.isHost = true;
        broadcast({ type: 'host-assigned', name: newHost.name });
      }

      sendPlayerList();
    }
  });
});

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'error') {
    alert(data.message);
  }

  if (data.type === 'host-assigned') {
    isHost = true;
    document.getElementById('start-quiz-button').classList.remove('hidden');
    console.log('Du bist der Host!');
  }

  if (data.type === 'player-list') {
    playerList.innerHTML = '';
    data.players.forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.dinoId} ${p.name}`;
      playerList.appendChild(li);
    });
    playerCount.textContent = `Spieler: ${data.players.length}`;
    if (data.players.some(p => p.name === playerName)) {
      showScreen(lobbyScreen);
    }
  }
};

document.getElementById('start-quiz-button').onclick = () => {
  if (!isHost) {
    alert('Nur der Host kann das Quiz starten!');
    return;
  }
  socket.send(JSON.stringify({ type: 'start-quiz' }));
};