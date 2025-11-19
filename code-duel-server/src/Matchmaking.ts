import { Server } from 'socket.io';
import { GameManager } from './GameManager';
import { MatchmakingPlayer } from './types';

export class Matchmaking {
  private queues: Map<number, MatchmakingPlayer[]> = new Map(); // numPlayers -> queue

  constructor(
    private gameManager: GameManager,
    private io: Server
  ) {
    // Initialize queues for 2, 3, 4 players
    this.queues.set(2, []);
    this.queues.set(3, []);
    this.queues.set(4, []);
  }

  addPlayer(player: MatchmakingPlayer, numPlayers: number = 2) {
    const queue = this.queues.get(numPlayers) || [];
    queue.push({ ...player, numPlayers });
    this.queues.set(numPlayers, queue);
    
    console.log(`Player ${player.username} joined ${numPlayers}-player queue. Queue size: ${queue.length}`);

    player.socket.emit('queueJoined', { position: queue.length, numPlayers });

    if (queue.length >= numPlayers) {
      this.createMatch(numPlayers);
    }
  }

  private createMatch(numPlayers: number) {
    const queue = this.queues.get(numPlayers) || [];
    const players: MatchmakingPlayer[] = [];
    
    for (let i = 0; i < numPlayers && queue.length > 0; i++) {
      players.push(queue.shift()!);
    }
    
    this.queues.set(numPlayers, queue);

    const usernames = players.map(p => p.username).join(', ');
    console.log(`Creating ${numPlayers}-player match: ${usernames}`);

    const game = this.gameManager.createGame(players);

    players.forEach(player => {
      player.socket.join(game.id);
    });

    const opponentNames = players.map(p => p.username);
    players.forEach(player => {
      const otherPlayers = opponentNames.filter(name => name !== player.username);
      player.socket.emit('matchFound', {
        gameId: game.id,
        opponents: otherPlayers,
        opponent: otherPlayers[0], // For backward compatibility
        yourBotId: player.socketId,
        numPlayers
      });
    });

    console.log(`Match created! Starting in 3 seconds...`);

    setTimeout(() => {
      console.log(`Starting game ${game.id}`);
      game.start();
    }, 3000);
  }

  removePlayer(socketId: string) {
    for (const [numPlayers, queue] of this.queues.entries()) {
      const initialLength = queue.length;
      const filtered = queue.filter(p => p.socketId !== socketId);
      if (filtered.length < initialLength) {
        this.queues.set(numPlayers, filtered);
        console.log(`Removed player ${socketId} from ${numPlayers}-player queue`);
        break;
      }
    }
  }
}

