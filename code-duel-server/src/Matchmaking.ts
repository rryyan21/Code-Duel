import { Server } from 'socket.io';
import { GameManager } from './GameManager';
import { MatchmakingPlayer } from './types';

export class Matchmaking {
  private queue: MatchmakingPlayer[] = [];

  constructor(
    private gameManager: GameManager,
    private io: Server
  ) {}

  addPlayer(player: MatchmakingPlayer) {
    this.queue.push(player);
    console.log(`Player ${player.username} joined queue. Queue size: ${this.queue.length}`);

    player.socket.emit('queueJoined', { position: this.queue.length });

    if (this.queue.length >= 2) {
      this.createMatch();
    }
  }

  private createMatch() {
    const player1 = this.queue.shift()!;
    const player2 = this.queue.shift()!;

    console.log(`Creating match: ${player1.username} vs ${player2.username}`);

    const game = this.gameManager.createGame(player1, player2);

    player1.socket.join(game.id);
    player2.socket.join(game.id);

    player1.socket.emit('matchFound', {
      gameId: game.id,
      opponent: player2.username,
      yourBotId: player1.socketId
    });

    player2.socket.emit('matchFound', {
      gameId: game.id,
      opponent: player1.username,
      yourBotId: player2.socketId
    });

    console.log(`Match created! Starting in 3 seconds...`);

    setTimeout(() => {
      console.log(`Starting game ${game.id}`);
      game.start();
    }, 3000);
  }

  removePlayer(socketId: string) {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(p => p.socketId !== socketId);
    if (this.queue.length < initialLength) {
      console.log(`Removed player ${socketId} from queue`);
    }
  }
}

