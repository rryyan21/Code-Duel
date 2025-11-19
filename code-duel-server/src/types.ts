export interface Position {
  x: number;
  y: number;
}

export interface Bot {
  id: string;
  position: Position;
  health: number;
  maxHealth: number;
  facing: 'up' | 'down' | 'left' | 'right';
  move(direction: 'up' | 'down' | 'left' | 'right', gridWidth: number, gridHeight: number): boolean;
  takeDamage(amount: number): void;
  isAlive(): boolean;
}

export type SupportedLanguage = 'javascript' | 'typescript' | 'python';

export interface Player {
  id: string;
  socketId: string;
  username: string;
  bot: Bot;
  code: string;
  language: SupportedLanguage;
  wins: number;
  losses: number;
}

export interface GameState {
  id: string;
  players: Map<string, Player>;
  grid: {
    width: number;
    height: number;
    obstacles: Position[];
  };
  status: 'waiting' | 'running' | 'finished';
  winner: string | null;
  tick: number;
}

export interface Action {
  action: 'move' | 'attack' | 'none';
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface GameContext {
  myBot: {
    position: Position;
    health: number;
    facing: string;
  };
  opponent: {
    position: Position;
    health: number;
  };
  opponents: Array<{
    position: Position;
    health: number;
  }>;
  grid: {
    width: number;
    height: number;
  };
}

export interface MatchmakingPlayer {
  socketId: string;
  username: string;
  socket: any; // Socket.io socket
  numPlayers?: number;
}

