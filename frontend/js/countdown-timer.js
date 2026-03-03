class CountdownTimer extends TimerEngine {
    constructor(gameData, template = null) {
        super(gameData);
        
        // Default template values if none provided
        this.template = template || {
            turn_time_seconds: 30,
            round_time_seconds: 180
        };
        
        this.initializeCountdowns();
    }

    initializeCountdowns() {
        this.players.forEach(player => {
            // roundTime is the only timer per player — it counts down while active
            // turn_time_seconds is the increment added back at end of each turn
            player.roundTime = this.template.round_time_seconds;
            player.isOvertime = false;
            player.overtimeSeconds = 0;
            player.alert10Triggered = false;
            player.alert5Triggered = false;
        });
    }

    updateTimer() {
        if (this.isPaused) return;

        const now = performance.now();
        const deltaTime = (now - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = now;

        const currentPlayer = this.players[this.currentPlayerIndex];

        if (this.mode === 2) {
            // Mode 2: Only round timer counts down.
            // turn_time_seconds is the increment added at end of turn (capped at initial round_time_seconds).
            currentPlayer.roundTime -= deltaTime;

            // Alerts based on round time remaining
            if (currentPlayer.roundTime <= 10 && currentPlayer.roundTime > 5 && !currentPlayer.alert10Triggered) {
                this.triggerTurnAlert(10);
                currentPlayer.alert10Triggered = true;
            }
            if (currentPlayer.roundTime <= 5 && currentPlayer.roundTime > 0 && !currentPlayer.alert5Triggered) {
                this.triggerTurnAlert(5);
                currentPlayer.alert5Triggered = true;
            }

            // Track overtime
            if (currentPlayer.roundTime <= 0) {
                if (!currentPlayer.isOvertime) {
                    currentPlayer.isOvertime = true;
                    this.triggerOvertimeAlert();
                }
                currentPlayer.overtimeSeconds += deltaTime;
            }

            // Track total time for statistics
            currentPlayer.totalTime += deltaTime;
            
            // Track total game time
            this.totalGameTime += deltaTime;
        } else {
            // Mode 1: Regular time tracking
            currentPlayer.totalTime += deltaTime;
            
            // Track total game time
            this.totalGameTime += deltaTime;
        }

        this.triggerUpdate();
        
        // Auto-save game state every 5 seconds (with debounce)
        const currentSecond = Math.floor(now / 1000);
        if (currentSecond % 5 === 0 && currentSecond !== this.lastSaveSecond) {
            this.lastSaveSecond = currentSecond;
            this.saveGameState();
        }
    }
    
    saveGameState() {
        if (window.StorageManager) {
            const gameState = {
                mode: this.mode,
                players: this.players,
                currentPlayerIndex: this.currentPlayerIndex,
                isPaused: this.isPaused,
                startTime: this.startTime,
                template: this.template,
                turnFlow: this.turnFlow,
                globalTurnNumber: this.globalTurnNumber,
                totalGameTime: this.totalGameTime,
                gameStarted: true
            };

            window.StorageManager.saveGameState(gameState);
        }
    }

    nextPlayer() {
        if (this.isPaused) return;

        // Get current player before changing
        const currentPlayer = this.players[this.currentPlayerIndex];
        
        // Record turn in history
        this.recordTurn(currentPlayer);
        
        // Mark current player as inactive and increment their turn count
        currentPlayer.isActive = false;
        currentPlayer.turnsCount++;

        if (this.mode === 2) {
            // Add turn increment to this player's round time, but never exceed the initial round_time_seconds
            currentPlayer.roundTime = Math.min(
                currentPlayer.roundTime + this.template.turn_time_seconds,
                this.template.round_time_seconds
            );
            // Reset overtime and alerts for next time this player is active
            currentPlayer.isOvertime = false;
            currentPlayer.alert10Triggered = false;
            currentPlayer.alert5Triggered = false;
        }

        // Move to next player
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        
        // Mark new current player as active
        this.players[this.currentPlayerIndex].isActive = true;

        this.triggerUpdate();
    }

    formatTime(seconds) {
        const isNegative = seconds < 0;
        const absSeconds = Math.abs(seconds);
        const mins = Math.floor(absSeconds / 60);
        const secs = Math.floor(absSeconds % 60);
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        return isNegative ? `-${timeStr}` : timeStr;
    }

    triggerTurnAlert(seconds) {
        // Visual alert
        const timerValue = document.getElementById('timer-value');
        if (timerValue) {
            timerValue.style.animation = 'alertPulse 0.5s ease-in-out';
            setTimeout(() => {
                timerValue.style.animation = '';
            }, 500);
        }
        
        // Sound alert
        if (window.SoundManager) {
            window.SoundManager.playTurnAlert();
        }
        
        // Haptic feedback
        if (window.HapticManager) {
            window.HapticManager.vibrateTurnAlert();
        }
        
        console.log(`Round time alert: ${seconds} seconds remaining`);
    }
    
    triggerOvertimeAlert() {
        // Visual urgent alert
        if (window.UIEffects) {
            window.UIEffects.triggerUrgentAlert();
        }
        
        // Sound alert
        if (window.SoundManager) {
            window.SoundManager.playOvertime();
        }
        
        // Haptic feedback
        if (window.HapticManager) {
            window.HapticManager.vibrateOvertime();
        }
        
        console.log('Overtime alert triggered');
    }

    getGameStats() {
        const totalGameTime = this.startTime ? (performance.now() - this.startTime) / 1000 : 0;
        
        return {
            totalGameTime,
            mode: this.mode,
            template: this.template,
            players: this.players.map(player => ({
                name: player.name,
                color: player.color,
                totalTime: player.totalTime,
                turnsCount: player.turnsCount,
                averageTurnTime: player.turnsCount > 0 ? player.totalTime / player.turnsCount : 0,
                finalRoundTime: player.roundTime,
                wasOvertime: player.isOvertime,
                overtimeSeconds: player.overtimeSeconds || 0
            }))
        };
    }
}
