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

      socket.on('findMatch', (username: string) => {
        console.log(`${username} (${socket.id}) looking for match`);
        this.matchmaking.addPlayer({
          socketId: socket.id,
          username,
          socket
        });
      });

      socket.on('submitCode', (data: { code: string }) => {
        const game = this.gameManager.getGameByPlayer(socket.id);
        if (game) {
          game.updatePlayerCode(socket.id, data.code);
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

