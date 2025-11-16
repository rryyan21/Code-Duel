import { VM } from 'vm2';
import { Action, GameContext } from './types';

export class CodeExecutor {
  private vm: VM;

  constructor() {
    this.vm = new VM({
      timeout: 100, // Kill after 100ms
      sandbox: {}
    });
  }

  execute(code: string, gameContext: GameContext): Action {
    try {
      const wrappedCode = `
        ${code}
        botStrategy(${JSON.stringify(gameContext)});
      `;

      const result = this.vm.run(wrappedCode);

      if (!this.isValidAction(result)) {
        return { action: 'none', direction: 'up' };
      }

      return result;
    } catch (error) {
      console.error('Code execution error:', error);
      return { action: 'none', direction: 'up' };
    }
  }

  private isValidAction(action: any): boolean {
    const validActions = ['move', 'attack', 'none'];
    const validDirections = ['up', 'down', 'left', 'right'];

    return (
      action &&
      typeof action === 'object' &&
      validActions.includes(action.action) &&
      validDirections.includes(action.direction)
    );
  }
}

