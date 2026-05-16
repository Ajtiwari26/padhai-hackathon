import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'padh-resource-store' });

export interface ResourceTask {
  id: string;
  type: 'syllabus' | 'subtopic' | 'mcq' | 'numerical' | 'test' | 'dpp' | 'summary' | 'mcq_batch' | 'numerical_batch';
  chapterId: string;
  subtopic: string;
  priority: number;
  status: 'queued' | 'running' | 'done' | 'failed';
  createdAt: number;
  metadata?: any;
  result?: any;
  retryCount?: number;
  lastError?: string;
}

class ResourceStoreService {
  /**
   * Get all tasks for a specific chapter
   */
  public async getTasksForChapter(chapterId: string): Promise<ResourceTask[]> {
    const tasks = await this.getAllTasks();
    return tasks.filter(t => t.chapterId === chapterId);
  }

  /**
   * Save a single task to the store.
   */
  public async saveTask(task: ResourceTask): Promise<void> {
    const tasks = await this.getAllTasks();
    const index = tasks.findIndex(t => t.id === task.id);
    if (index > -1) {
      tasks[index] = task;
    } else {
      tasks.push(task);
    }
    storage.set('resource_tasks', JSON.stringify(tasks));
  }

  /**
   * Get all tasks
   */
  public async getAllTasks(): Promise<ResourceTask[]> {
    const raw = storage.getString('resource_tasks');
    return raw ? JSON.parse(raw) : [];
  }

  /**
   * Get tasks by status
   */
  public async getTasksByStatus(status: ResourceTask['status']): Promise<ResourceTask[]> {
    const tasks = await this.getAllTasks();
    return tasks.filter(t => t.status === status);
  }

  /**
   * Get a single task by ID
   */
  public async getTaskById(taskId: string): Promise<ResourceTask | null> {
    const tasks = await this.getAllTasks();
    return tasks.find(t => t.id === taskId) || null;
  }

  /**
   * Delete a task
   */
  public async deleteTask(taskId: string): Promise<void> {
    const tasks = await this.getAllTasks();
    const filtered = tasks.filter(t => t.id !== taskId);
    storage.set('resource_tasks', JSON.stringify(filtered));
  }

  /**
   * Retrieve ready MCQs for a specific chapter/subtopic
   */
  public async getReadyMCQs(chapterId: string, subtopic: string, count: number): Promise<any[]> {
    const tasks = await this.getAllTasks();
    const availableBatches = tasks.filter(t => 
      t.type === 'mcq_batch' && 
      t.status === 'done' && 
      t.chapterId === chapterId && 
      (subtopic ? t.subtopic === subtopic : true) &&
      t.result && 
      t.result.length > 0
    );

    let extracted: any[] = [];
    for (const batch of availableBatches) {
      if (extracted.length >= count) break;
      
      const needed = count - extracted.length;
      const taking = batch.result.splice(0, needed);
      extracted = [...extracted, ...taking];
      
      // Update the batch (if empty, we could delete it, but let's just save the reduced array)
      await this.saveTask(batch);
    }

    return extracted;
  }
  
  /**
   * Retrieve ready Numericals for a specific chapter/subtopic
   */
  public async getReadyNumericals(chapterId: string, subtopic: string, count: number): Promise<any[]> {
    const tasks = await this.getAllTasks();
    const availableBatches = tasks.filter(t => 
      t.type === 'numerical_batch' && 
      t.status === 'done' && 
      t.chapterId === chapterId && 
      (subtopic ? t.subtopic === subtopic : true) &&
      t.result && 
      t.result.length > 0
    );

    let extracted: any[] = [];
    for (const batch of availableBatches) {
      if (extracted.length >= count) break;
      
      const needed = count - extracted.length;
      const taking = batch.result.splice(0, needed);
      extracted = [...extracted, ...taking];
      
      await this.saveTask(batch);
    }

    return extracted;
  }

  /**
   * Clear tasks (useful for resetting/debugging)
   */
  public clearAll(): void {
    storage.set('resource_tasks', JSON.stringify([]));
  }
}

export const ResourceStore = new ResourceStoreService();
