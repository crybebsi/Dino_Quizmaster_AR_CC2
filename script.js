const webRoomsWebSocketServerAddr = 'ws://localhost:8080';

let socket = new WebSocket(webRoomsWebSocketServerAddr);

let playerName = '';
let playerDino = '';
let isHost = false;
let selectedAnswerIndex = null;

const startScreen = document.getElementById('start-screen');
const nameScreen = document.getElementById('name-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const quizScreen = document.getElementById('quiz-screen');
const rankingScreen = document.getElementById('ranking-screen');

const playerList = document.getElementById('player-list');
const playerCount = document.getElementById('player-count');
const questionContainer = document.getElementById('question-container');
const answersContainer = document.getElementById('answers-container');
const timerBar = document.getElementById('timer-bar');

const rankingList = document.getElementById('ranking-list');

let currentTimerInterval = null;
let timerDuration = 0;
let timerStartTimestamp = 0;

let questionActive = false;

function showScreen(screen) {
  [startScreen, nameScreen, lobbyScreen, quizScreen, rankingScreen].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');

  // Punktestand nur im Quiz-Bildschirm anzeigen
  const scoreDisplay = document.getElementById('score-display');
  if (screen === quizScreen) {
    scoreDisplay.style.display = 'block'; // Sichtbar machen
  } else {
    scoreDisplay.style.display = 'none'; // Ausblenden
  }
}

function startTimer(durationSeconds, onComplete) {
  timerDuration = durationSeconds;
  timerStartTimestamp = Date.now();
  clearInterval(currentTimerInterval);
  updateTimerBar(1);

  currentTimerInterval = setInterval(() => {
    const elapsed = (Date.now() - timerStartTimestamp) / 1000;
    const remaining = Math.max(0, timerDuration - elapsed);
    updateTimerBar(remaining / timerDuration);

    if (remaining <= 0) {
      clearInterval(currentTimerInterval);
      onComplete?.();
    }
  }, 50);
}

function updateTimerBar(percent) {
  timerBar.style.width = (percent * 100) + '%';
  if (inARMode) {
    const arTimerBar = document.getElementById('ar-timer-bar');
    arTimerBar.setAttribute('scale', `${percent} 1 1`);
  }
}

startScreen.querySelector('#start-button').onclick = () => showScreen(nameScreen);

nameScreen.querySelectorAll('#dino-selection span').forEach(span => {
  span.onclick = () => {
    document.querySelectorAll('#dino-selection span').forEach(s => s.classList.remove('selected'));
    span.classList.add('selected');
    playerDino = span.dataset.dino;
  };
});

document.querySelectorAll('#dino-selection span').forEach((dino) => {
  dino.addEventListener('click', () => {
    document.querySelectorAll('#dino-selection span').forEach((d) => d.classList.remove('selected'));
    dino.classList.add('selected');
  });
});

nameScreen.querySelector('#join-button').addEventListener('click', () => {
  playerName = document.getElementById('name-input').value.trim();
  if (!playerName) {
    alert('Bitte gib deinen Namen ein.');
    return;
  }
  if (!playerDino) {
    alert('Bitte wähle einen Dino aus.');
    return;
  }

  // Sende Beitrittsdaten an den Server
  socket.send(JSON.stringify({ type: 'join', name: playerName, dinoId: playerDino }));

  // Wechsel zur Lobby-Ansicht
  showScreen(lobbyScreen);
});

document.getElementById('start-quiz-button').onclick = () => {
  socket.send(JSON.stringify({ type: 'start-quiz' }));
};

document.getElementById('restart-button').onclick = () => {
  location.reload();
};

socket.onopen = () => {
  console.log('Verbunden mit Server');
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'error') {
    alert(data.message);
  }

  if (data.type === 'joined') {
    isHost = data.isHost;
    showScreen(lobbyScreen);
  }

  if (data.type === 'host-assigned') {
    isHost = true;
    alert('Du bist nun der Host!');
    document.getElementById('start-quiz-button').classList.remove('hidden');
  }

  if (data.type === 'player-list') {
    playerList.innerHTML = '';
    data.players.forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.name} ${p.dinoId} ${p.isHost ? '(Host)' : ''}`;
      playerList.appendChild(li);
    });
    playerCount.textContent = `Spieler: ${data.players.length}`;

    if (isHost && data.players.length >= 2) {
      document.getElementById('start-quiz-button').classList.remove('hidden');
    } else {
      document.getElementById('start-quiz-button').classList.add('hidden');
    }
  }

  if (data.type === 'question') {
    if (inARMode) {
      updateARQuiz(data.question, data.answers);
    } else {
      showScreen(quizScreen);
      questionContainer.textContent = data.question;
      answersContainer.innerHTML = '';
      data.answers.forEach((answer, idx) => {
        const btn = document.createElement('button');
        btn.textContent = answer;
        btn.disabled = false;
        btn.classList.remove('correct', 'wrong');
        btn.onclick = () => {
          if (!questionActive) return;
          questionActive = false;

          selectedAnswerIndex = idx;
          socket.send(JSON.stringify({ type: 'answer', answer: idx }));

          Array.from(answersContainer.children).forEach(b => b.disabled = true);
        };
        answersContainer.appendChild(btn);
      });
    }

    questionActive = true;

    startTimer(15, () => {
      questionActive = false;
      if (inARMode) {
        const arTimerBar = document.getElementById('ar-timer-bar');
        arTimerBar.setAttribute('scale', '0 1 1');
      } else {
        Array.from(answersContainer.children).forEach(b => b.disabled = true);
      }

      startTimer(5, () => {
        socket.send(JSON.stringify({ type: 'next-question-ready' }));
      });
    });
  }

  if (data.type === 'ranking') {
    console.log('Empfangenes Ranking:', data.ranking); // Debugging-Log
    showScreen(rankingScreen);
    rankingList.innerHTML = '';
    data.ranking.forEach((player, idx) => {
      const li = document.createElement('li');
      li.textContent = `${idx + 1}. ${player.name} ${player.dinoId} - ${player.points} Punkte`;
      rankingList.appendChild(li);
    });
  }

  if (data.type === 'score-update') {
    const scoreDisplay = document.getElementById('score-display');
    scoreDisplay.textContent = `Punkte: ${data.score}`;
    scoreDisplay.style.backgroundColor = data.correct ? '#4caf50' : '#f44336';
  }

  if (data.type === 'answer-result') {
    // Markiere richtige und falsche Antworten
    Array.from(answersContainer.children).forEach((btn, idx) => {
      if (idx === data.correct) {
        btn.classList.add('correct'); // Grün für richtige Antwort
      } else {
        btn.classList.add('wrong'); // Rot für falsche Antworten
      }
    });

    // Punkte aktualisieren
    if (data.correct === selectedAnswerIndex) {
      updateScore(10); // +10 Punkte bei richtiger Antwort
    } else {
      updateScore(-10); // -10 Punkte bei falscher Antwort
    }
  }
};

socket.onclose = () => {
  alert('Verbindung zum Server verloren.');
};

// --------------- VR-Modus ---------------

// Entferne diese Funktionen komplett
/*
function enterVRMode() {
  inVRMode = true;

  [startScreen, nameScreen, lobbyScreen, quizScreen, rankingScreen].forEach(s => s.classList.add('hidden'));
  document.getElementById('score-display').style.display = 'none';
  vrButton.style.display = 'none';

  vrScene.style.display = 'block';

  if (vrScene.enterVR) vrScene.enterVR();

  syncToVRScreen();
}

function exitVRMode() {
  inVRMode = false;
  vrScene.style.display = 'none';
  vrButton.style.display = 'block';
  showScreen(startScreen);
}

function syncToVRScreen() {
  if (!inVRMode) return;

  if (!quizScreen.classList.contains('hidden')) {
    updateVRQuizScreen();
  } else if (!rankingScreen.classList.contains('hidden')) {
    updateVRRankingScreen();
  } else if (!lobbyScreen.classList.contains('hidden')) {
    updateVRLobbyScreen();
  } else {
    vrScene.style.display = 'none';
  }
}

function updateVRQuizScreen() {
  if (!inVRMode) return;

  vrQuizPanel.setAttribute('text', 'value', questionContainer.textContent);

  while (vrAnswers.firstChild) vrAnswers.removeChild(vrAnswers.firstChild);

  const answers = Array.from(answersContainer.children).map(btn => btn.textContent);

  answers.forEach((answerText, idx) => {
    const btn = document.createElement('a-entity');
    btn.setAttribute('geometry', 'primitive: plane; height: 0.3; width: 2.5');
    btn.setAttribute('material', 'color: #8bc34a');
    btn.setAttribute('text', `value: ${answerText}; color: white; width: 2.3; align: center`);
    btn.setAttribute('position', `0 ${-0.4 * idx} 0`);
    btn.setAttribute('class', 'vr-answer-btn');

    // Blicksteuerung: Antwort auswählen
    btn.addEventListener('click', () => {
      if (!questionActive) return;
      questionActive = false;
      selectedAnswerIndex = idx;
      socket.send(JSON.stringify({ type: 'answer', answer: idx }));

      // Markiere die ausgewählte Antwort
      const allButtons = vrAnswers.querySelectorAll('.vr-answer-btn');
      allButtons.forEach(b => b.setAttribute('material', 'color', '#c8e6c9')); // Deaktiviert
      btn.setAttribute('material', 'color', '#4caf50'); // Grün für richtige Antwort
    });

    vrAnswers.appendChild(btn);
  });
}

function updateVRRankingScreen() {
  if (!inVRMode) return;

  const rankingItems = Array.from(rankingList.children).map(li => li.textContent).join('\n');
  vrQuizPanel.setAttribute('text', 'value', 'Ergebnis:\n' + rankingItems);

  while (vrAnswers.firstChild) vrAnswers.removeChild(vrAnswers.firstChild);

  vrTimerBar.setAttribute('scale', '0 1 1');
}

function updateVRLobbyScreen() {
  if (!inVRMode) return;

  const playersText = Array.from(playerList.children).map(li => li.textContent).join('\n');
  vrQuizPanel.setAttribute('text', 'value', 'Warteraum:\n' + playersText);

  while (vrAnswers.firstChild) vrAnswers.removeChild(vrAnswers.firstChild);

  vrTimerBar.setAttribute('scale', '0 1 1');
}
*/

// Neue Funktionen für Punktestand
let score = 0;

function updateScore(points) {
  score = Math.max(0, score + points); // Stelle sicher, dass der Score nicht unter 0 fällt
  const scoreDisplay = document.getElementById('score-display');
  scoreDisplay.textContent = `Punkte: ${score}`;

  // Punkte-Pop-up erstellen
  const pointsPopup = document.createElement('div');
  pointsPopup.textContent = points > 0 ? `+${points}` : `${points}`;
  pointsPopup.style.position = 'fixed';
  pointsPopup.style.top = '20px';
  pointsPopup.style.right = '20px';
  pointsPopup.style.color = points > 0 ? '#4caf50' : '#f44336'; // Grün für +, Rot für -
  pointsPopup.style.fontSize = '20px';
  pointsPopup.style.fontWeight = 'bold';
  pointsPopup.style.animation = 'fadeOut 1s ease forwards';
  document.body.appendChild(pointsPopup);

  // Entferne das Pop-up nach der Animation
  setTimeout(() => pointsPopup.remove(), 1000);
}

// Funktion zur Geräteprüfung
function isMobileDevice() {
  // Überprüfe, ob das Gerät ein Smartphone ist
  return /Android|iPhone|iPod/i.test(navigator.userAgent);
}

// AR-Button erstellen
const arButton = document.createElement('button');
arButton.id = 'ar-button';
arButton.textContent = 'In AR spielen';
arButton.style.marginTop = '20px';
startScreen.appendChild(arButton);

// Geräteprüfung
if (!isMobileDevice()) {
  arButton.disabled = true; // Deaktiviere den Button
  arButton.textContent = 'AR nur auf Smartphones verfügbar';
} else {
  arButton.onclick = () => {
    if (inARMode) return;

    // Kamera-Zugriffsmeldung nur auf Smartphones
    if (confirm('Möchtest du wirklich in AR spielen? Stelle sicher, dass dein Gerät die Kamera unterstützt.')) {
      enterARMode(); // Kamera wird erst hier aktiviert
    }
  };
}

let inARMode = false;

function enterARMode() {
  inARMode = true;

  // Verstecke alle anderen Bildschirme
  [startScreen, nameScreen, lobbyScreen, quizScreen, rankingScreen].forEach(s => s.classList.add('hidden'));
  document.getElementById('score-display').style.display = 'none';
  arButton.style.display = 'none';

  // Erstelle die AR-Szene
  const arScene = document.createElement('a-scene');
  arScene.id = 'ar-scene';
  arScene.setAttribute('embedded', '');
  arScene.setAttribute('arjs', 'sourceType: webcam; debugUIEnabled: false;');
  arScene.style.cssText = 'display:block; width:100vw; height:100vh; position:fixed; top:0; left:0; background-color: transparent;';
  arScene.innerHTML = `
    <a-entity id="ar-question" position="0 1.5 -2" text="value: Lade Frage...; align: center; width: 4; color: black;"></a-entity>
    <a-entity id="ar-answers" position="0 1 -2"></a-entity>
    <a-box id="ar-timer-bar" position="0 0.5 -2" geometry="primitive: plane; height: 0.1; width: 1" material="color: #4caf50"></a-box>
    <a-camera>
      <a-cursor 
        color="white" 
        fuse="true" 
        fuse-timeout="2000" 
        animation__fusing="property: scale; startEvents: fusing; easing: easeInQuad; dur: 1500; from: 1 1 1; to: 0.1 0.1 0.1">
      </a-cursor>
    </a-camera>
  `;
  document.body.appendChild(arScene);
}

function exitARMode() {
  inARMode = false;

  const arScene = document.getElementById('ar-scene');
  if (arScene) {
    arScene.remove(); // Entferne die AR-Szene
  }

  arButton.style.display = 'block';
  showScreen(startScreen);
}

function updateARQuiz(question, answers) {
  const arQuestion = document.getElementById('ar-question');
  const arAnswers = document.getElementById('ar-answers');

  arQuestion.setAttribute('text', 'value', question);

  while (arAnswers.firstChild) arAnswers.removeChild(arAnswers.firstChild);

  answers.forEach((answer, idx) => {
    const btn = document.createElement('a-entity');
    btn.setAttribute('geometry', 'primitive: plane; height: 0.3; width: 2.5');
    btn.setAttribute('material', 'color: #8bc34a');
    btn.setAttribute('text', `value: ${answer}; color: white; width: 2.3; align: center`);
    btn.setAttribute('position', `0 ${-0.4 * idx} 0`);
    btn.setAttribute('class', 'ar-answer-btn');

    // Blicksteuerung: Antwort auswählen
    btn.addEventListener('click', () => {
      if (!questionActive) return;
      questionActive = false;
      selectedAnswerIndex = idx;
      socket.send(JSON.stringify({ type: 'answer', answer: idx }));

      // Markiere die ausgewählte Antwort
      const allButtons = arAnswers.querySelectorAll('.ar-answer-btn');
      allButtons.forEach(b => b.setAttribute('material', 'color', '#c8e6c9')); // Deaktiviert
      btn.setAttribute('material', 'color', '#4caf50'); // Grün für richtige Antwort
    });

    arAnswers.appendChild(btn);
  });
}