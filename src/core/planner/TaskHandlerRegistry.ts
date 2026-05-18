import { TaskHandler } from './TaskHandler';

class TaskHandlerRegistryService {
  private handlers = new Map<string, TaskHandler>();

  public register(handler: TaskHandler): void {
    this.handlers.set(handler.type, handler);
    console.log(`[TaskHandlerRegistry] Registered handler for task type: ${handler.type}`);
  }

  public getHandler(type: string): TaskHandler | undefined {
    return this.handlers.get(type);
  }

  public hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }
}

export const TaskHandlerRegistry = new TaskHandlerRegistryService();
