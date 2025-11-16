import { Position, Bot as BotInterface } from './types';
import { v4 as uuidv4 } from 'uuid';

export class Bot implements BotInterface {
  id: string;
  position: Position;
  health: number;
  maxHealth: number;
  facing: 'up' | 'down' | 'left' | 'right';

  constructor(startPosition: Position) {
    this.id = uuidv4();
    this.position = startPosition;
    this.health = 100;
    this.maxHealth = 100;
    this.facing = 'right';
  }

  move(direction: 'up' | 'down' | 'left' | 'right', gridWidth: number, gridHeight: number): boolean {
    const newPos = { ...this.position };

    switch (direction) {
      case 'up': newPos.y--; break;
      case 'down': newPos.y++; break;
      case 'left': newPos.x--; break;
      case 'right': newPos.x++; break;
    }

    // Validate bounds
    if (newPos.x < 0 || newPos.x >= gridWidth || newPos.y < 0 || newPos.y >= gridHeight) {
      return false;
    }

    this.position = newPos;
    this.facing = direction;
    return true;
  }

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount);
  }

  isAlive(): boolean {
    return this.health > 0;
  }
}

