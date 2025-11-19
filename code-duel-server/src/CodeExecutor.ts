import { VM } from 'vm2';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Action, GameContext, SupportedLanguage } from './types';

const execAsync = promisify(exec);

export class CodeExecutor {
  constructor() {
    // No longer storing a single VM instance
    // We'll create a new one for each execution to avoid context pollution
  }

  async execute(code: string, language: SupportedLanguage, gameContext: GameContext): Promise<Action> {
    try {
      switch (language) {
        case 'javascript':
        case 'typescript':
          return this.executeJavaScript(code, gameContext);
        case 'python':
          return await this.executePython(code, gameContext);
        default:
          console.error(`Unsupported language: ${language}`);
          return { action: 'none', direction: 'up' };
      }
    } catch (error) {
      console.error('Code execution error:', error);
      return { action: 'none', direction: 'up' };
    }
  }

  private executeJavaScript(code: string, gameContext: GameContext): Action {
    try {
      // Create a new VM instance for each execution to avoid context pollution
      // This prevents "Identifier already declared" errors when classes are defined
      const vm = new VM({
        timeout: 100, // Kill after 100ms
        sandbox: {}
      });

      const wrappedCode = `
        ${code}
        botStrategy(${JSON.stringify(gameContext)});
      `;

      const result = vm.run(wrappedCode);

      if (!this.isValidAction(result)) {
        return { action: 'none', direction: 'up' };
      }

      return result;
    } catch (error) {
      console.error('JavaScript execution error:', error);
      return { action: 'none', direction: 'up' };
    }
  }

  private async executePython(code: string, gameContext: GameContext): Promise<Action> {
    try {
      // Create Python code that wraps the user's function
      const pythonCode = `
import json
import sys

${code}

# Call the function with game context
game_context = ${JSON.stringify(gameContext)}
result = bot_strategy(game_context)

# Output result as JSON
print(json.dumps(result))
sys.stdout.flush()
      `;

      // Execute Python code with timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), 100)
      );

      const execPromise = execAsync(`python3 -c ${JSON.stringify(pythonCode)}`, {
        maxBuffer: 1024 * 1024 // 1MB max buffer
      });

      const { stdout, stderr } = await Promise.race([execPromise, timeoutPromise]);

      if (stderr) {
        console.error('Python execution stderr:', stderr);
      }

      const result = JSON.parse(stdout.trim());

      if (!this.isValidAction(result)) {
        return { action: 'none', direction: 'up' };
      }

      return result;
    } catch (error) {
      console.error('Python execution error:', error);
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

