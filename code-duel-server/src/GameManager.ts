import { Server } from 'socket.io';
import { Game } from './Game';
import { v4 as uuidv4 } from 'uuid';

export class GameManager {
  private games: Map<string, Game> = new Map();
  private playerGameMap: Map<string, string> = new Map(); // socketId -> gameId

  constructor(private io: Server) {}

  createGame(players: any[]): Game {
    const gameId = uuidv4();
    const game = new Game(gameId, players, this.io);
    
    this.games.set(gameId, game);
    players.forEach(player => {
      this.playerGameMap.set(player.socketId, gameId);
    });

    return game;
  }

  getGameByPlayer(socketId: string): Game | undefined {
    const gameId = this.playerGameMap.get(socketId);
    if (!gameId) return undefined;
    return this.games.get(gameId);
  }

  removeGame(gameId: string) {
    const game = this.games.get(gameId);
    if (game) {
      // Remove player mappings
      game.getPlayers().forEach(player => {
        this.playerGameMap.delete(player.socketId);
      });
      this.games.delete(gameId);
    }
  }

  handleDisconnect(socketId: string) {
    const game = this.getGameByPlayer(socketId);
    if (game) {
      game.handlePlayerDisconnect(socketId);
    }
  }
}

