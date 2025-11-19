import { Server } from 'socket.io';
import { GameState, Player, Action, GameContext, Position } from './types';
import { Bot } from './Bot';
import { CodeExecutor } from './CodeExecutor';
import { v4 as uuidv4 } from 'uuid';

export class Game {
  private state: GameState;
  private tickInterval: NodeJS.Timeout | null = null;
  private readonly TICK_RATE = 100;
  private codeExecutor: CodeExecutor;

  constructor(
    public readonly id: string,
    private playersList: any[],
    private io: Server
  ) {
    this.codeExecutor = new CodeExecutor();
    this.state = this.initializeGameState();
  }

  private initializeGameState(): GameState {
    const players = new Map<string, Player>();
    const numPlayers = this.playersList.length;

    // Position players based on count
    const positions = this.getPlayerPositions(numPlayers);

    this.playersList.forEach((playerData, index) => {
      const bot = new Bot(positions[index]);
      players.set(playerData.socketId, {
        id: uuidv4(),
        socketId: playerData.socketId,
        username: playerData.username,
        bot: bot,
        code: '',
        language: 'javascript',
        wins: 0,
        losses: 0
      });
    });

    return {
      id: this.id,
      players,
      grid: { width: 10, height: 10, obstacles: [] },
      status: 'waiting',
      winner: null,
      tick: 0
    };
  }

  private getPlayerPositions(numPlayers: number): Position[] {
    switch (numPlayers) {
      case 2:
        return [{ x: 1, y: 5 }, { x: 8, y: 5 }];
      case 3:
        return [{ x: 1, y: 5 }, { x: 9, y: 5 }, { x: 5, y: 1 }];
      case 4:
        return [{ x: 1, y: 1 }, { x: 8, y: 1 }, { x: 1, y: 8 }, { x: 8, y: 8 }];
      default:
        return [{ x: 1, y: 5 }, { x: 8, y: 5 }];
    }
  }

  start() {
    console.log(`Game ${this.id} starting!`);
    this.state.status = 'running';
    this.broadcastState();
    this.tickInterval = setInterval(() => this.tick(), this.TICK_RATE);
  }

  private async tick() {
    const actionPromises: Promise<void>[] = [];
    
    for (const [playerId, player] of this.state.players.entries()) {
      if (player.code && player.bot.isAlive()) {
        const gameContext = this.buildGameContext(playerId);
        actionPromises.push(
          this.codeExecutor.execute(player.code, player.language, gameContext)
            .then(action => this.executeAction(player.bot, action, playerId))
        );
      }
    }

    await Promise.all(actionPromises);

    const winner = this.checkWinner();
    if (winner) {
      this.endGame(winner);
      return;
    }

    this.broadcastState();
    this.state.tick++;
  }

  private buildGameContext(playerId: string): GameContext {
    const player = this.state.players.get(playerId)!;
    const allOpponents = Array.from(this.state.players.values())
      .filter(p => p.socketId !== playerId && p.bot.isAlive())
      .map(p => ({
        position: { ...p.bot.position },
        health: p.bot.health
      }));

    // Find closest opponent for backward compatibility
    const closestOpponent = allOpponents.length > 0 
      ? allOpponents.reduce((closest, current) => {
          const closestDist = Math.abs(closest.position.x - player.bot.position.x) + 
                             Math.abs(closest.position.y - player.bot.position.y);
          const currentDist = Math.abs(current.position.x - player.bot.position.x) + 
                             Math.abs(current.position.y - player.bot.position.y);
          return currentDist < closestDist ? current : closest;
        })
      : allOpponents[0] || { position: { x: 0, y: 0 }, health: 0 };

    return {
      myBot: {
        position: { ...player.bot.position },
        health: player.bot.health,
        facing: player.bot.facing
      },
      opponent: closestOpponent,
      opponents: allOpponents,
      grid: {
        width: this.state.grid.width,
        height: this.state.grid.height
      }
    };
  }

  private executeAction(bot: Bot, action: Action, playerId: string) {
    if (action.action === 'move') {
      bot.move(action.direction, this.state.grid.width, this.state.grid.height);
    } else if (action.action === 'attack') {
      this.performAttack(bot, action.direction, playerId);
    }
  }

  private performAttack(attackerBot: Bot, direction: string, attackerId: string) {
    const targetPos = { ...attackerBot.position };

    switch (direction) {
      case 'up': targetPos.y--; break;
      case 'down': targetPos.y++; break;
      case 'left': targetPos.x--; break;
      case 'right': targetPos.x++; break;
    }

    // Check all opponents for hits
    const opponents = Array.from(this.state.players.values())
      .filter(p => p.socketId !== attackerId && p.bot.isAlive());

    for (const opponent of opponents) {
      if (opponent.bot.position.x === targetPos.x && 
          opponent.bot.position.y === targetPos.y) {
        opponent.bot.takeDamage(10);
        console.log(`Attack hit! ${opponent.username}'s bot now at ${opponent.bot.health} HP`);
        break; // Only hit one opponent per attack
      }
    }
  }

  private checkWinner(): string | null {
    const alivePlayers = Array.from(this.state.players.values())
      .filter(p => p.bot.isAlive());

    if (alivePlayers.length === 1) {
      return alivePlayers[0].socketId;
    }

    return null;
  }

  private endGame(winnerId: string) {
    this.state.status = 'finished';
    this.state.winner = winnerId;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }

    console.log(`Game ${this.id} ended! Winner: ${winnerId}`);
    this.broadcastState();

    this.io.to(this.id).emit('gameOver', {
      winner: winnerId,
      winnerName: this.state.players.get(winnerId)?.username
    });
  }

  updatePlayerCode(socketId: string, code: string, language: string = 'javascript') {
    const player = this.state.players.get(socketId);
    if (player) {
      player.code = code;
      player.language = language as any;
      console.log(`Updated code for ${player.username} (${language})`);
    }
  }

  handlePlayerDisconnect(socketId: string) {
    console.log(`Player ${socketId} disconnected from game ${this.id}`);
    
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }

    this.state.status = 'finished';
    
    const remainingPlayer = Array.from(this.state.players.values())
      .find(p => p.socketId !== socketId);
    
    if (remainingPlayer) {
      this.state.winner = remainingPlayer.socketId;
      this.io.to(this.id).emit('gameOver', {
        winner: remainingPlayer.socketId,
        winnerName: remainingPlayer.username,
        reason: 'opponent_disconnected'
      });
    }
  }

  getPlayers(): Player[] {
    return Array.from(this.state.players.values());
  }

  private broadcastState() {
    this.io.to(this.id).emit('gameState', this.serializeState());
  }

  private serializeState() {
    return {
      ...this.state,
      players: Array.from(this.state.players.values())
    };
  }
}

