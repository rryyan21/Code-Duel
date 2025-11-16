import { Server } from 'socket.io';
import { GameState, Player, Action, GameContext } from './types';
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
    private player1: any,
    private player2: any,
    private io: Server
  ) {
    this.codeExecutor = new CodeExecutor();
    this.state = this.initializeGameState();
  }

  private initializeGameState(): GameState {
    const players = new Map<string, Player>();

    const bot1 = new Bot({ x: 1, y: 5 });
    players.set(this.player1.socketId, {
      id: uuidv4(),
      socketId: this.player1.socketId,
      username: this.player1.username,
      bot: bot1,
      code: '',
      wins: 0,
      losses: 0
    });

    const bot2 = new Bot({ x: 8, y: 5 });
    players.set(this.player2.socketId, {
      id: uuidv4(),
      socketId: this.player2.socketId,
      username: this.player2.username,
      bot: bot2,
      code: '',
      wins: 0,
      losses: 0
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

  start() {
    console.log(`Game ${this.id} starting!`);
    this.state.status = 'running';
    this.broadcastState();
    this.tickInterval = setInterval(() => this.tick(), this.TICK_RATE);
  }

  private tick() {
    for (const [playerId, player] of this.state.players.entries()) {
      if (player.code && player.bot.isAlive()) {
        const gameContext = this.buildGameContext(playerId);
        const action = this.codeExecutor.execute(player.code, gameContext);
        this.executeAction(player.bot, action, playerId);
      }
    }

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
    const opponent = Array.from(this.state.players.values())
      .find(p => p.socketId !== playerId)!;

    return {
      myBot: {
        position: { ...player.bot.position },
        health: player.bot.health,
        facing: player.bot.facing
      },
      opponent: {
        position: { ...opponent.bot.position },
        health: opponent.bot.health
      },
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

    const opponent = Array.from(this.state.players.values())
      .find(p => p.socketId !== attackerId);

    if (opponent && 
        opponent.bot.position.x === targetPos.x && 
        opponent.bot.position.y === targetPos.y) {
      opponent.bot.takeDamage(10);
      console.log(`Attack hit! ${opponent.username}'s bot now at ${opponent.bot.health} HP`);
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

  updatePlayerCode(socketId: string, code: string) {
    const player = this.state.players.get(socketId);
    if (player) {
      player.code = code;
      console.log(`Updated code for ${player.username}`);
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

