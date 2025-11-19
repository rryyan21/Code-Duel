import { Server, Socket } from 'socket.io';
import { GameManager } from './GameManager';
import { Matchmaking } from './Matchmaking';

export class GameServer {
  private gameManager: GameManager;
  private matchmaking: Matchmaking;

  constructor(private io: Server) {
    this.gameManager = new GameManager(io);
    this.matchmaking = new Matchmaking(this.gameManager, io);
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log('Player connected:', socket.id);

      socket.on('findMatch', (data: { username: string; numPlayers?: number }) => {
        const numPlayers = data.numPlayers || 2;
        console.log(`${data.username} (${socket.id}) looking for ${numPlayers}-player match`);
        this.matchmaking.addPlayer({
          socketId: socket.id,
          username: data.username,
          socket
        }, numPlayers);
      });

      socket.on('submitCode', (data: { code: string; language?: string }) => {
        const game = this.gameManager.getGameByPlayer(socket.id);
        if (game) {
          game.updatePlayerCode(socket.id, data.code, data.language || 'javascript');
        }
      });

      socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        this.matchmaking.removePlayer(socket.id);
        this.gameManager.handleDisconnect(socket.id);
      });
    });
  }
}

