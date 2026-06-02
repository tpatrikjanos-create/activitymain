/* ===== STORAGE ===== */
const Store = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

/* ===== STATE ===== */
const state = {
  activeCategoryId: Store.get('activeCategoryId', 'csaladi'),
  timerSecs: Store.get('timerSecs', 60),
  password: Store.get('gmPassword', '1234'),
  apiKey: Store.get('apiKey', ''),
  currentWord: null,
  timerInterval: null,
  timeLeft: 60,
  usedWords: Store.get('usedWords', {})
};

const R = 96;
const CIRC = 2 * Math.PI * R;

/* ===== ISMÉTLÉSMENTESSÉG ===== */
const Session = {
  getUsed(catId) { return state.usedWords[catId] || []; },
  markUsed(catId, word) {
    if (!state.usedWords[catId]) state.usedWords[catId] = [];
    if (!state.usedWords[catId].includes(word)) {
      state.usedWords[catId].push(word);
      Store.set('usedWords', state.usedWords);
    }
  },
  reset() { state.usedWords = {}; Store.set('usedWords', {}); },
  totalUsed() { return Object.values(state.usedWords).reduce((s, a) => s + a.length, 0); }
};

/* ===== AI PROMPTS ===== */
const CAT_PROMPTS = {
  tizennyolcPlus: (modeName, used) => {
    const u = used.length > 0 ? `\nMÁR HASZNÁLT szavak (TILOS megismételni): ${used.join(', ')}` : '';
    return `Te egy felnőtt bulihoz készült, ittas társaság számára szóló Activity játék feladványgenerátora vagy. Feladattípus: "${modeName}". Generálj EGYETLEN rövid, nagyon vulgáris, trágár, szókimondó, obszcén magyar szót vagy kifejezést (max 3 szó). Legyen durva, szexuálisan explicit, akár ocsmány – ez egy csapatépítős ivós parti játék.${u}\nCsak a szót válaszold!`;
  },
  ceges: (modeName, used) => {
    const u = used.length > 0 ? `\nMÁR HASZNÁLT szavak (TILOS megismételni): ${used.join(', ')}` : '';
    return `Céges csapatépítő Activity játék feladványgenerátora. Feladattípus: "${modeName}". Generálj EGYETLEN rövid, irodai témájú, vidám magyar szót (max 3 szó).${u}\nCsak a szót válaszold!`;
  },
  gyerek: (modeName, used) => {
    const u = used.length > 0 ? `\nMÁR HASZNÁLT szavak (TILOS megismételni): ${used.join(', ')}` : '';
    return `Gyerekzsúr Activity feladványgenerátora, 6-12 éveseknek. Feladattípus: "${modeName}". Generálj EGYETLEN egyszerű, gyerekbarát magyar szót (max 3 szó).${u}\nCsak a szót válaszold!`;
  },
  default: (catName, modeName, used) => {
    const u = used.length > 0 ? `\nMÁR HASZNÁLT szavak (TILOS megismételni): ${used.join(', ')}` : '';
    return `Activity társasjáték feladványgenerátora. Kategória: "${catName}". Feladattípus: "${modeName}". Generálj EGYETLEN rövid, kreatív magyar szót (max 3 szó).${u}\nCsak a szót válaszold!`;
  }
};

/* ===== UI ===== */
const UI = {
  showState(name) {
    document.querySelectorAll('.state').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('state-' + name);
    if (el) { el.classList.add('active'); void el.offsetWidth; }
  },
  showGMLogin() {
    SoundEngine.play('menu-open');
    document.getElementById('gm-password-input').value = '';
    document.getElementById('login-error').textContent = '';
    document.getElementById('gm-login').classList.add('active');
  },
  hideAll() {
    document.getElementById('gm-login').classList.remove('active');
    document.getElementById('gm-panel').classList.remove('active');
  },
  gmLogin() {
    const val = document.getElementById('gm-password-input').value;
    if (val === state.password) {
      document.getElementById('gm-login').classList.remove('active');
      UI.openGMPanel();
    } else {
      document.getElementById('login-error').textContent = 'Hibás jelszó!';
      document.getElementById('gm-password-input').value = '';
    }
  },
  openGMPanel() {
    document.getElementById('api-key-input').value = state.apiKey;
    document.getElementById('timer-range').value = state.timerSecs;
    document.getElementById('timer-val').textContent = state.timerSecs;
    document.getElementById('new-pass-input').value = '';
    document.getElementById('gm-status').textContent = '';
    // Hang beállítások
    document.getElementById('sound-toggle').checked = SoundEngine.isEnabled();
    document.getElementById('volume-range').value = Math.round(SoundEngine.getVolume() * 100);
    document.getElementById('volume-val').textContent = Math.round(SoundEngine.getVolume() * 100) + '%';
    UI.updateSessionCounter();
    UI.renderCategoryGrid();
    document.getElementById('gm-panel').classList.add('active');
  },
  renderCategoryGrid() {
    const grid = document.getElementById('category-grid');
    grid.innerHTML = CATEGORIES.map(cat => `
      <button class="cat-btn ${cat.id === state.activeCategoryId ? 'selected' : ''}"
        onclick="UI.selectCategory('${cat.id}')">
        <i class="ti ${cat.icon}"></i>
        <div>
          <div>${cat.name}</div>
          <div style="font-size:11px;opacity:0.6;font-weight:400;margin-top:2px;">${cat.description}</div>
        </div>
      </button>
    `).join('');
  },
  selectCategory(id) {
    SoundEngine.play('cat-select');
    state.activeCategoryId = id;
    UI.renderCategoryGrid();
  },
  updateTimerLabel() {
    document.getElementById('timer-val').textContent = document.getElementById('timer-range').value;
  },
  updateVolumeLabel() {
    const v = document.getElementById('volume-range').value;
    document.getElementById('volume-val').textContent = v + '%';
    SoundEngine.setVolume(v / 100);
  },
  toggleSound() {
    const on = document.getElementById('sound-toggle').checked;
    SoundEngine.setEnabled(on);
    if (on) SoundEngine.play('btn-click');
  },
  updateSessionCounter() {
    const total = Session.totalUsed();
    const el = document.getElementById('session-counter');
    if (el) el.textContent = total > 0 ? `${total} szó elhangzott ebben a sessionben` : 'Még nincs elhangzott szó';
  },
  saveGMSettings() {
    SoundEngine.play('btn-click');
    const selectedBtn = document.querySelector('.cat-btn.selected');
    if (selectedBtn) {
      const m = selectedBtn.getAttribute('onclick').match(/'([^']+)'/);
      if (m) state.activeCategoryId = m[1];
    }
    state.timerSecs = parseInt(document.getElementById('timer-range').value);
    state.apiKey = document.getElementById('api-key-input').value.trim();
    const np = document.getElementById('new-pass-input').value.trim();
    if (np) { state.password = np; Store.set('gmPassword', np); }
    Store.set('activeCategoryId', state.activeCategoryId);
    Store.set('timerSecs', state.timerSecs);
    Store.set('apiKey', state.apiKey);
    const cat = CATEGORIES.find(c => c.id === state.activeCategoryId);
    if (cat) document.getElementById('active-cat-name').textContent = cat.name;
    document.getElementById('gm-status').textContent = '✓ Beállítások mentve!';
    setTimeout(() => UI.hideAll(), 1200);
  },
  resetSession() {
    Session.reset();
    UI.updateSessionCounter();
    document.getElementById('gm-status').textContent = '✓ Session visszaállítva!';
  },
  setLoading(on) {
    document.getElementById('loading-overlay').style.display = on ? 'flex' : 'none';
  }
};

/* ===== AI ===== */
async function generateWithAI(category) {
  const modeNames = Object.keys(category.words);
  const modeName = modeNames[Math.floor(Math.random() * modeNames.length)];
  const modeObj = MODES.find(m => m.label === modeName) || MODES[0];
  const used = Session.getUsed(category.id);
  let prompt;
  if (category.id === 'tizennyolcPlus') prompt = CAT_PROMPTS.tizennyolcPlus(modeName, used);
  else if (category.id === 'ceges') prompt = CAT_PROMPTS.ceges(modeName, used);
  else if (category.id === 'gyerek') prompt = CAT_PROMPTS.gyerek(modeName, used);
  else prompt = CAT_PROMPTS.default(category.name, modeName, used);

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": state.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 60,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!resp.ok) throw new Error('API hiba');
  const data = await resp.json();
  const word = data.content?.[0]?.text?.trim() || null;
  return { word, modeName, modeObj };
}

/* ===== FALLBACK ===== */
function generateFallback(category) {
  const modeNames = Object.keys(category.words);
  const used = Session.getUsed(category.id);
  let available = [];
  for (const modeName of modeNames) {
    for (const word of category.words[modeName]) {
      if (!used.includes(word)) available.push({ modeName, word });
    }
  }
  if (available.length === 0) {
    state.usedWords[category.id] = [];
    Store.set('usedWords', state.usedWords);
    for (const modeName of modeNames) {
      for (const word of category.words[modeName]) available.push({ modeName, word });
    }
  }
  const pick = available[Math.floor(Math.random() * available.length)];
  const modeObj = MODES.find(m => m.label === pick.modeName) || MODES[0];
  return { word: pick.word, modeName: pick.modeName, modeObj };
}

/* ===== APP ===== */
const App = {
  async drawCard() {
    SoundEngine.play('card-draw');
    const category = CATEGORIES.find(c => c.id === state.activeCategoryId);
    if (!category) return;
    let result;
    if (state.apiKey) {
      UI.setLoading(true);
      try {
        result = await generateWithAI(category);
        if (!result.word) result = generateFallback(category);
        const used = Session.getUsed(category.id);
        if (used.includes(result.word)) result = generateFallback(category);
      } catch (e) {
        result = generateFallback(category);
      } finally {
        UI.setLoading(false);
      }
    } else {
      result = generateFallback(category);
    }
    Session.markUsed(category.id, result.word);
    state.currentWord = result.word;
    document.getElementById('challenge-word').textContent = result.word;
    document.getElementById('mode-label').textContent = result.modeName;
    document.getElementById('mode-icon').className = 'ti ' + (result.modeObj?.icon || 'ti-star');
    document.getElementById('challenge-desc').textContent = result.modeObj?.hint || '';
    UI.showState('card');
  },

  startTimer() {
    SoundEngine.play('timer-start');
    const secs = state.timerSecs;
    state.timeLeft = secs;
    const arc = document.getElementById('timer-arc');
    arc.style.strokeDasharray = CIRC;
    arc.style.transition = 'none';
    arc.style.strokeDashoffset = '0';
    arc.style.stroke = '#27c47a';
    document.getElementById('timer-num').textContent = secs;
    document.getElementById('timer-word-recap').textContent = state.currentWord || '';
    document.getElementById('btn-done').style.display = 'none';
    UI.showState('timer');

    setTimeout(() => {
      arc.style.transition = `stroke-dashoffset ${secs}s linear, stroke 1s ease`;
      arc.style.strokeDashoffset = CIRC;
    }, 80);

    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerRunning = true;
    state.timerInterval = setInterval(() => {
      state.timeLeft--;
      document.getElementById('timer-num').textContent = state.timeLeft;
      const pct = state.timeLeft / secs;

      // Hangok időzítés szerint
      if (state.timeLeft <= 3 && state.timeLeft > 0) {
        SoundEngine.play('beep');
      } else if (state.timeLeft <= 10 && state.timeLeft > 3) {
        SoundEngine.play('tick-fast');
      } else if (state.timeLeft > 10) {
        SoundEngine.play('tick');
      }

      // Szín
      if (pct < 0.25) arc.style.stroke = '#e84040';
      else if (pct < 0.5) arc.style.stroke = '#f5a623';

      if (state.timeLeft <= 0) {
        clearInterval(state.timerInterval);
        state.timerRunning = false;
        SoundEngine.play('buzzer');
        document.getElementById('btn-done').style.display = '';
        UI.showState('timeout');
      }
    }, 1000);
  },

  reset() {
    SoundEngine.play('btn-click');
    if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
    state.timerRunning = false;
    state.currentWord = null;
    UI.showState('idle');
  }
};

/* ===== INIT ===== */
function init() {
  const starsEl = document.getElementById('stars');
  for (let i = 0; i < 80; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2.5 + 1;
    s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;width:${size}px;height:${size}px;--dur:${(Math.random()*4+2).toFixed(1)}s;--op:${(Math.random()*0.5+0.2).toFixed(2)};animation-delay:${(Math.random()*5).toFixed(1)}s;`;
    starsEl.appendChild(s);
  }
  const cat = CATEGORIES.find(c => c.id === state.activeCategoryId);
  if (cat) document.getElementById('active-cat-name').textContent = cat.name;
  document.getElementById('gm-password-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') UI.gmLogin();
  });
  UI.showState('idle');
}

document.addEventListener('DOMContentLoaded', init);
