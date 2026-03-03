class GameTimer {
    constructor() {
        this.timerEngine = null;
        this.handleTouch = null;
        this.isInitialized = false;
        this.uiEffects = null;
        this.lastPlayerIndex = -1;
    }

    init(gameData) {
        this.cleanup();
        if (gameData.mode === 2) {
            this.timerEngine = new CountdownTimer(gameData, gameData.template);
        } else {
            this.timerEngine = new TimerEngine(gameData);
        }
        this.timerEngine.turnFlow = gameData.turnFlow || 'sequential';
        this.timerEngine.globalTurnNumber = gameData.globalTurnNumber || 0;
        this.uiEffects = window.UIEffects;
        this.lastPlayerIndex = -1;
        this.turnFlow = gameData.turnFlow || 'sequential';
        if (!this.isInitialized) {
            this.setupUI();
            this.bindEvents();
            this.setupTouchHandler();
            this.isInitialized = true;
        } else {
            this.setupUI();
        }
        this.timerEngine.start();
        if (window.SoundManager) window.SoundManager.playGameStart();
        if (window.HapticManager) window.HapticManager.vibrateGameStart();
        if (window.WakeLockManager) window.WakeLockManager.requestWakeLock();
        console.log('Game Timer initialized with mode:', gameData.mode);
    }
    
    resume(savedState) {
        this.cleanup();
        if (savedState.mode === 2) {
            this.timerEngine = new CountdownTimer(savedState, savedState.template);
        } else {
            this.timerEngine = new TimerEngine(savedState);
        }
        this.timerEngine.players = savedState.players;
        this.timerEngine.currentPlayerIndex = savedState.currentPlayerIndex;
        this.timerEngine.isPaused = savedState.isPaused;
        this.timerEngine.startTime = savedState.startTime;
        this.uiEffects = window.UIEffects;
        this.lastPlayerIndex = -1;
        if (!this.isInitialized) {
            this.setupUI();
            this.bindEvents();
            this.setupTouchHandler();
            this.isInitialized = true;
        } else {
            this.setupUI();
        }
        if (!savedState.isPaused) {
            this.timerEngine.start();
        } else {
            this.timerEngine.triggerUpdate();
        }
        console.log('Game resumed from saved state');
    }

    setupUI() {
        this.timerEngine.onUpdate((gameState) => {
            this.updateDisplay(gameState);
        });
        setTimeout(() => {
            this.updateDisplay({
                currentPlayer: this.timerEngine.getCurrentPlayer(),
                players: this.timerEngine.players,
                isPaused: false,
                mode: this.timerEngine.mode
            });
            if (this.timerEngine.turnFlow === 'manual') {
                this.setupManualSelection();
                const keyboardHints = document.getElementById('keyboard-hints');
                if (keyboardHints) {
                    keyboardHints.innerHTML = '<span>⌨️ ESC: Pause • Click players to switch</span>';
                }
            }
        }, 100);
    }

    updateDisplay(gameState) {
        const currentPlayerEl = document.getElementById('current-player');
        const timerValueEl = document.getElementById('timer-value');
        const allPlayersEl = document.getElementById('all-players');
        const pauseBtn = document.getElementById('pause-btn');

        if (currentPlayerEl && gameState.currentPlayer) {
            const currentIndex = gameState.players.findIndex(p => p.isActive);
            if (this.lastPlayerIndex !== -1 && this.lastPlayerIndex !== currentIndex) {
                this.uiEffects?.animatePlayerChange(currentPlayerEl);
                this.uiEffects?.flashScreen(gameState.currentPlayer.color + '20', 150);
            }
            this.lastPlayerIndex = currentIndex;
            currentPlayerEl.textContent = gameState.currentPlayer.name;
            currentPlayerEl.style.backgroundColor = gameState.currentPlayer.color;
            currentPlayerEl.style.color = this.getContrastColor(gameState.currentPlayer.color);
        }

        // Main timer: Mode 1 = elapsed, Mode 2 = round time remaining
        if (timerValueEl && gameState.currentPlayer) {
            const timeToShow = gameState.mode === 1
                ? gameState.currentPlayer.totalTime
                : (gameState.currentPlayer.roundTime || 0);
            timerValueEl.textContent = this.timerEngine.formatTime(timeToShow);
            if (gameState.mode === 2 && gameState.currentPlayer.isOvertime) {
                this.uiEffects?.applyOvertimeEffect(timerValueEl, true);
            } else {
                this.uiEffects?.applyOvertimeEffect(timerValueEl, false);
            }
        }
        
        const gameDurationEl = document.getElementById('game-duration');
        if (gameDurationEl) {
            gameDurationEl.textContent = `Game: ${this.timerEngine.formatTime(this.timerEngine.totalGameTime || 0)}`;
        }

        // Player list
        if (allPlayersEl) {
            allPlayersEl.innerHTML = '';
            gameState.players.forEach((player) => {
                const playerDiv = document.createElement('div');
                playerDiv.className = 'player-time smooth-transition';
                playerDiv.style.borderLeftColor = player.color;
                if (player.isActive) {
                    playerDiv.style.backgroundColor = player.color + '20';
                    playerDiv.classList.add('active-player');
                }
                if (player.isOvertime) playerDiv.classList.add('overtime-player');

                let displayContent = `
                    <div style="font-weight: bold; color: ${player.color}">
                        ${player.name}${player.isOvertime ? ' 😞' : ''}
                    </div>
                `;
                if (gameState.mode === 1) {
                    displayContent += `
                        <div>${this.timerEngine.formatTime(player.totalTime)}</div>
                        <div style="font-size: 0.8em; opacity: 0.7">Turns: ${player.turnsCount}</div>
                    `;
                } else {
                    // Mode 2: only round time shown (no turn timer)
                    displayContent += `
                        <div style="font-size: 0.9em">${this.timerEngine.formatTime(player.roundTime)}</div>
                        <div style="font-size: 0.8em; opacity: 0.7">Turns: ${player.turnsCount}</div>
                    `;
                }
                playerDiv.innerHTML = displayContent;
                allPlayersEl.appendChild(playerDiv);
            });
        }

        if (pauseBtn) pauseBtn.textContent = gameState.isPaused ? 'Resume' : 'Pause';

        const gameScreen = document.getElementById('game-screen');
        const timerDisplay = document.getElementById('timer-display');
        if (gameState.isPaused) {
            gameScreen.classList.add('paused');
            timerDisplay.classList.add('paused');
            if (!document.getElementById('pause-overlay')) {
                const overlay = document.createElement('div');
                overlay.id = 'pause-overlay';
                overlay.className = 'pause-overlay';
                overlay.innerHTML = `
                    <div class="pause-content">
                        <div class="pause-icon">⏸️</div>
                        <div class="pause-text">GAME PAUSED</div>
                        <div class="pause-subtitle">Touch Resume to continue</div>
                    </div>
                `;
                gameScreen.appendChild(overlay);
            }
        } else {
            gameScreen.classList.remove('paused');
            timerDisplay.classList.remove('paused');
            const overlay = document.getElementById('pause-overlay');
            if (overlay) overlay.remove();
        }

        document.title = gameState.isPaused
            ? 'PAUSED - BoardGame Timer'
            : `${gameState.currentPlayer?.name || 'Player'}'s Turn - BoardGame Timer`;
        this.updateManualButtons();
    }

    setupTouchHandler() {
        const gameScreen = document.getElementById('game-screen');
        if (this.handleTouch) {
            gameScreen.removeEventListener('touchstart', this.handleTouch);
            gameScreen.removeEventListener('click', this.handleTouch);
        }
        let lastTouchTime = 0;
        const touchDebounceMs = 300;
        this.handleTouch = (e) => {
            if (e.target.tagName === 'BUTTON') return;
            const now = Date.now();
            if (now - lastTouchTime < touchDebounceMs) return;
            lastTouchTime = now;
            if (this.timerEngine) {
                if (!this.timerEngine.isPaused) {
                    if (this.timerEngine.turnFlow === 'sequential') {
                        const rect = gameScreen.getBoundingClientRect();
                        const x = (e.clientX || e.touches?.[0]?.clientX || rect.width / 2) - rect.left;
                        const y = (e.clientY || e.touches?.[0]?.clientY || rect.height / 2) - rect.top;
                        this.uiEffects?.createTouchRipple(x, y, gameScreen);
                        this.timerEngine.nextPlayer();
                    }
                } else {
                    this.uiEffects?.shakeElement(document.getElementById('pause-overlay'));
                }
            }
        };
        gameScreen.addEventListener('touchstart', this.handleTouch, { passive: true });
        gameScreen.addEventListener('click', this.handleTouch);
    }

    bindEvents() {
        document.getElementById('pause-btn').addEventListener('click', (e) => {
            this.uiEffects?.animateButtonPress(e.target);
            if (this.timerEngine.isPaused) { this.timerEngine.start(); } else { this.timerEngine.pause(); }
        });
        document.getElementById('end-game-btn').addEventListener('click', (e) => {
            this.uiEffects?.animateButtonPress(e.target);
            this.endGame();
        });
        document.getElementById('history-toggle').addEventListener('click', (e) => {
            this.uiEffects?.animateButtonPress(e.target);
            this.toggleTurnHistory();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.timerEngine && !this.timerEngine.isPaused) {
                console.log('Tab hidden - timer continues running');
            }
        });
    }

    endGame() {
        if (!this.timerEngine) return;
        const confirmEnd = confirm('Are you sure you want to end the game?');
        if (!confirmEnd) return;
        const gameStats = this.timerEngine.getGameStats();
        this.timerEngine.pause();
        this.showGameStats(gameStats);
    }

    showGameStats(stats) {
        if (window.SoundManager) window.SoundManager.playGameEnd();
        if (window.UIEffects) window.UIEffects.createConfetti();
        if (window.HapticManager) window.HapticManager.vibrateGameEnd();
        setTimeout(() => { this.showStatsModal(stats); }, 500);
        if (window.WakeLockManager) window.WakeLockManager.releaseWakeLock();
    }
    
    showStatsModal(stats) {
        const modal = document.createElement('div');
        modal.className = 'stats-modal-overlay';
        modal.innerHTML = `
            <div class="stats-modal">
                <div class="stats-header">
                    <h2>🎉 Game Complete!</h2>
                    <button class="stats-close">×</button>
                </div>
                <div class="stats-content">
                    <div class="game-summary">
                        <div class="summary-item">
                            <span class="summary-label">Total Time:</span>
                            <span class="summary-value">${this.timerEngine.formatTime(stats.totalGameTime)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Mode:</span>
                            <span class="summary-value">${stats.mode === 1 ? 'Time Tracking' : 'Countdown Timer'}</span>
                        </div>
                    </div>
                    <div class="player-stats">
                        ${stats.players.map(player => `
                            <div class="player-stat" style="border-left-color: ${player.color}">
                                <div class="player-stat-name" style="color: ${player.color}">${player.name}</div>
                                <div class="player-stat-details">
                                    <div class="stat-row"><span>Total Time:</span><span>${this.timerEngine.formatTime(player.totalTime)}</span></div>
                                    <div class="stat-row"><span>Turns:</span><span>${player.turnsCount}</span></div>
                                    ${player.turnsCount > 0 ? `<div class="stat-row"><span>Avg Turn:</span><span>${this.timerEngine.formatTime(player.averageTurnTime)}</span></div>` : ''}
                                    ${stats.mode === 2 ? `
                                        <div class="stat-row"><span>Final Time:</span><span>${this.timerEngine.formatTime(player.finalRoundTime)}</span></div>
                                        ${player.wasOvertime ? `<div class="stat-row overtime-stat"><span>Overtime:</span><span>${this.timerEngine.formatTime(player.overtimeSeconds)}</span></div>` : ''}
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="stats-footer">
                    <button class="btn-primary stats-ok">New Game</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.stats-close').onclick = () => this.closeStatsModal(modal);
        modal.querySelector('.stats-ok').onclick = () => this.closeStatsModal(modal);
        modal.onclick = (e) => { if (e.target === modal) this.closeStatsModal(modal); };
        setTimeout(() => { modal.classList.add('show'); }, 50);
    }
    
    closeStatsModal(modal) {
        modal.classList.remove('show');
        setTimeout(() => { if (modal.parentNode) modal.parentNode.removeChild(modal); }, 300);
        this.cleanup();
        if (window.StorageManager) window.StorageManager.clearGameState();
        if (window.WakeLockManager) window.WakeLockManager.releaseWakeLock();
        document.getElementById('game-screen').classList.remove('active');
        document.getElementById('setup-screen').classList.add('active');
        document.title = 'BoardGame Timer';
        const resumeBanner = document.getElementById('resume-banner');
        if (resumeBanner) resumeBanner.remove();
        if (window.app) {
            window.app.gameJustEnded = true;
            setTimeout(() => { window.app.gameJustEnded = false; }, 1000);
        }
        if (window.app && window.app.playerSetup) window.app.playerSetup.resetForNewGame();
    }

    cleanup() {
        if (this.timerEngine) {
            this.timerEngine.pause();
            if (this.timerEngine.timerInterval) {
                clearInterval(this.timerEngine.timerInterval);
                this.timerEngine.timerInterval = null;
            }
            this.timerEngine.updateCallback = null;
            this.timerEngine = null;
        }
        this.lastPlayerIndex = -1;
    }

    toggleTurnHistory() {
        const historyPanel = document.getElementById('turn-history');
        const toggleBtn = document.getElementById('history-toggle');
        if (historyPanel.classList.contains('collapsed')) {
            historyPanel.classList.remove('collapsed');
            toggleBtn.innerHTML = '📁 Hide History';
        } else {
            historyPanel.classList.add('collapsed');
            toggleBtn.innerHTML = '📜 Turn History';
        }
    }
    
    setupManualSelection() {
        const manualSection = document.getElementById('manual-selection');
        const buttonsContainer = document.getElementById('manual-player-buttons');
        manualSection.style.display = 'block';
        buttonsContainer.innerHTML = '';
        this.timerEngine.players.forEach((player, index) => {
            const button = document.createElement('button');
            button.className = 'manual-player-btn';
            button.textContent = player.name;
            button.style.borderColor = player.color;
            button.style.color = player.color;
            button.dataset.playerIndex = index;
            button.addEventListener('click', () => { this.selectPlayer(index); });
            buttonsContainer.appendChild(button);
        });
        this.updateManualButtons();
    }
    
    selectPlayer(playerIndex) {
        if (playerIndex === this.timerEngine.currentPlayerIndex) return;
        const currentPlayer = this.timerEngine.getCurrentPlayer();
        this.timerEngine.recordTurn(currentPlayer);
        currentPlayer.isActive = false;
        currentPlayer.turnsCount++;
        // Mode 2: add turn increment to departing player's round time (capped at initial)
        if (this.timerEngine.mode === 2) {
            currentPlayer.roundTime = Math.min(
                currentPlayer.roundTime + (this.timerEngine.template?.turn_time_seconds || 0),
                this.timerEngine.template?.round_time_seconds || Infinity
            );
            currentPlayer.isOvertime = false;
            currentPlayer.alert10Triggered = false;
            currentPlayer.alert5Triggered = false;
        }
        this.timerEngine.currentPlayerIndex = playerIndex;
        this.timerEngine.players[playerIndex].isActive = true;
        if (window.SoundManager) window.SoundManager.playTurnChange();
        if (window.HapticManager) window.HapticManager.vibrateTurnChange();
        this.timerEngine.triggerUpdate();
        this.updateManualButtons();
    }
    
    updateManualButtons() {
        if (this.timerEngine.turnFlow !== 'manual') return;
        const buttons = document.querySelectorAll('.manual-player-btn');
        buttons.forEach((button, index) => {
            if (index === this.timerEngine.currentPlayerIndex) {
                button.classList.add('current-player');
            } else {
                button.classList.remove('current-player');
            }
        });
    }
    
    getContrastColor(hexColor) {
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 128 ? '#000000' : '#FFFFFF';
    }
}

window.GameTimer = new GameTimer();
