import { ResourceStore, ResourceTask } from '../storage/ResourceStore';
import { EventBus } from '../bus/EventBus';
import { TaskHandlerRegistry } from './TaskHandlerRegistry';
import { SyllabusHandler } from './handlers/SyllabusHandler';
import { SubtopicHandler } from './handlers/SubtopicHandler';
import { McqHandler } from './handlers/McqHandler';
import { NumericalHandler } from './handlers/NumericalHandler';
import { TestHandler } from './handlers/TestHandler';
import { DppHandler } from './handlers/DppHandler';
import { SummaryHandler } from './handlers/SummaryHandler';

class ResourcePlannerService {
  private isRunning = false;
  private isPaused = false;
  private taskInterval: ReturnType<typeof setInterval> | null = null;
  private eventUnsubscribers: Array<() => void> = [];
  private currentTask: ResourceTask | null = null;
  private foregroundAbortController: AbortController | null = null;
  private isForegroundActive = false;
  
  // Weights for priority sorting
  private readonly PRIORITY_MAP: Record<string, number> = {
    'syllabus': 100,
    'subtopic': 200,
    'mcq': 300,
    'numerical': 400,
    'test': 500,
    'dpp': 600,
    'summary': 700,
    'mcq_batch': 300,
    'numerical_batch': 400,
  };

  /**
   * Starts the background scheduler
   */
  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Register all task handlers
    this.registerHandlers();
    
    // Clean up any tasks that were left in 'running' state (e.g. after a crash)
    await this.cleanupStaleTasks();
    
    console.log('[ResourcePlanner] Scheduler started');
    
    // Subscribe to events
    this.subscribeToEvents();
    
    // Check queue every 10 seconds
    this.taskInterval = setInterval(() => {
      this.processNextTask();
    }, 10000);
    
    // Process one immediately
    this.processNextTask();
  }

  /**
   * Register all task handlers with the registry
   */
  private registerHandlers(): void {
    TaskHandlerRegistry.register(new SyllabusHandler());
    TaskHandlerRegistry.register(new SubtopicHandler());
    TaskHandlerRegistry.register(new McqHandler());
    TaskHandlerRegistry.register(new NumericalHandler());
    TaskHandlerRegistry.register(new TestHandler());
    TaskHandlerRegistry.register(new DppHandler());
    TaskHandlerRegistry.register(new SummaryHandler());
    console.log('[ResourcePlanner] All task handlers registered');
  }

  public stop() {
    this.isRunning = false;
    if (this.taskInterval) {
      clearInterval(this.taskInterval);
      this.taskInterval = null;
    }
    
    // Unsubscribe from events
    this.unsubscribeFromEvents();
    
    console.log('[ResourcePlanner] Scheduler stopped');
  }

  /**
   * Subscribe to Event Bus events
   */
  private subscribeToEvents(): void {
    // Process chapter enrichment tasks when chapters are enriched
    const unsubChapterEnriched = EventBus.on('chapter:enriched', (data) => {
      console.log('[ResourcePlanner] 📚 Chapter enriched, checking for dependent tasks', data);
      // Could trigger follow-up tasks here
    });
    
    // Store unsubscribers
    this.eventUnsubscribers.push(unsubChapterEnriched);
  }

  /**
   * Unsubscribe from all events
   */
  private unsubscribeFromEvents(): void {
    this.eventUnsubscribers.forEach(unsub => unsub());
    this.eventUnsubscribers = [];
  }

  /**
   * Request foreground access for chat (preempts background tasks)
   * Called by MentorChat/OnboardingChat before inference
   */
  public async requestForegroundAccess(): Promise<void> {
    this.isForegroundActive = true;
    
    if (this.currentTask && this.currentTask.priority > 0) {
      // Background task is running, abort it
      console.log('[ResourcePlanner] 🚨 Preempting background task for foreground chat');
      
      if (this.foregroundAbortController) {
        this.foregroundAbortController.abort();
      }
      
      // Mark task as queued again (will retry later)
      this.currentTask.status = 'queued';
      await ResourceStore.saveTask(this.currentTask);
      this.currentTask = null;
      
      EventBus.emitSync('resource:paused', { reason: 'foreground_chat' });
    }
  }
  
  /**
   * Release foreground access (resumes background tasks)
   * Called by MentorChat/OnboardingChat after inference completes
   */
  public releaseForegroundAccess(): void {
    this.isForegroundActive = false;
    console.log('[ResourcePlanner] ✅ Foreground access released, resuming background tasks');
    
    EventBus.emitSync('resource:resumed', { reason: 'chat_complete' });
    
    // Process next task after 2s delay to let model settle
    setTimeout(() => this.processNextTask(), 2000);
  }
  
  /**
   * Get current running task (for UI display)
   */
  public getCurrentTask(): ResourceTask | null {
    return this.currentTask;
  }
  
  /**
   * Pause a specific task
   */
  public async pauseTask(taskId: string): Promise<void> {
    const task = await ResourceStore.getTaskById(taskId);
    if (!task) return;
    
    task.isPaused = true;
    task.status = 'paused';
    await ResourceStore.saveTask(task);
    
    // If this is the current task, abort it
    if (this.currentTask?.id === taskId) {
      if (this.foregroundAbortController) {
        this.foregroundAbortController.abort();
      }
      this.currentTask = null;
    }
    
    console.log('[ResourcePlanner] Task paused:', taskId);
  }
  
  /**
   * Resume a paused task
   */
  public async resumeTask(taskId: string): Promise<void> {
    const task = await ResourceStore.getTaskById(taskId);
    if (!task) return;
    
    task.isPaused = false;
    task.status = 'queued';
    await ResourceStore.saveTask(task);
    
    console.log('[ResourcePlanner] Task resumed:', taskId);
    this.processNextTask();
  }
  
  /**
   * Skip a task (mark as skipped, remove from queue)
   */
  public async skipTask(taskId: string): Promise<void> {
    const task = await ResourceStore.getTaskById(taskId);
    if (!task) return;
    
    task.isSkipped = true;
    task.status = 'skipped';
    await ResourceStore.saveTask(task);
    
    // If this is the current task, abort it
    if (this.currentTask?.id === taskId) {
      if (this.foregroundAbortController) {
        this.foregroundAbortController.abort();
      }
      this.currentTask = null;
    }
    
    console.log('[ResourcePlanner] Task skipped:', taskId);
    this.processNextTask();
  }
  
  /**
   * Prioritize a task (move to top of queue)
   */
  public async prioritizeTask(taskId: string): Promise<void> {
    const task = await ResourceStore.getTaskById(taskId);
    if (!task) return;
    
    task.userPriority = 1; // Highest user priority
    await ResourceStore.saveTask(task);
    
    console.log('[ResourcePlanner] Task prioritized:', taskId);
    this.processNextTask();
  }
  
  /**
   * Update task priorities after drag-to-reorder
   */
  public async reorderTasks(orderedTaskIds: string[]): Promise<void> {
    for (let i = 0; i < orderedTaskIds.length; i++) {
      const task = await ResourceStore.getTaskById(orderedTaskIds[i]);
      if (task) {
        task.userPriority = i + 1; // 1 = highest priority
        await ResourceStore.saveTask(task);
      }
    }
    
    console.log('[ResourcePlanner] Tasks reordered');
    this.processNextTask();
  }

  public pause() {
    this.isPaused = true;
    console.log('[ResourcePlanner] Scheduler paused');
  }

  public resume() {
    this.isPaused = false;
    console.log('[ResourcePlanner] Scheduler resumed');
    // Process immediately
    this.processNextTask();
  }

  public isPausedStatus(): boolean {
    return this.isPaused;
  }

  public isRunningStatus(): boolean {
    return this.isRunning;
  }

  /**
   * Moves any 'running' tasks back to 'queued' status.
   * This is essential to recover from app crashes or reloads where a task
   * was left in 'running' state and would otherwise block the serial queue.
   */
  private async cleanupStaleTasks() {
    try {
      const runningTasks = await ResourceStore.getTasksByStatus('running');
      if (runningTasks.length > 0) {
        console.log(`[ResourcePlanner] 🧹 Cleaning up ${runningTasks.length} stale running tasks.`);
        for (const task of runningTasks) {
          task.status = 'queued';
          // Don't increment retry count for stale tasks, just re-queue
          await ResourceStore.saveTask(task);
        }
      }
    } catch (e) {
      console.error('[ResourcePlanner] Failed to cleanup stale tasks:', e);
    }
  }

  /**
   * Cancel/remove a specific task
   */
  public async cancelTask(taskId: string) {
    const task = await ResourceStore.getTaskById(taskId);
    if (!task) {
      console.warn('[ResourcePlanner] Task not found:', taskId);
      return;
    }

    if (task.status === 'running') {
      // Mark as failed to stop it
      task.status = 'failed';
      await ResourceStore.saveTask(task);
      console.log('[ResourcePlanner] Running task cancelled:', taskId);
    } else {
      // Remove from queue
      await ResourceStore.deleteTask(taskId);
      console.log('[ResourcePlanner] Task removed:', taskId);
    }
  }

  /**
   * Get task statistics
   */
  public async getStats() {
    const tasks = await ResourceStore.getAllTasks();
    const queued = tasks.filter(t => t.status === 'queued').length;
    const running = tasks.filter(t => t.status === 'running').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    const total = tasks.length;
    const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      queued,
      running,
      done,
      failed,
      total,
      completionPercent
    };
  }

  /**
   * Queue a new task
   */
  public queueTask(
    type: ResourceTask['type'], 
    chapterId: string, 
    subtopic: string = '', 
    metadata: any = {},
    userInitiated: boolean = false
  ) {
    const basePriority = this.PRIORITY_MAP[type] || 1000;
    
    const task: ResourceTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type,
      chapterId,
      chapterName: metadata?.chapterData?.name || chapterId, // Use chapter name if available
      subtopic,
      priority: basePriority,
      basePriority,
      status: 'queued',
      createdAt: Date.now(),
      metadata,
      retryCount: 0,
      isPaused: false,
      isSkipped: false,
      userInitiated
    };

    ResourceStore.saveTask(task);
    console.log(`[ResourcePlanner] Queued task: ${type} for ${task.chapterName || chapterId}${userInitiated ? ' (USER-INITIATED)' : ''}`);
    
    // If user-initiated, pause other tasks for this chapter
    if (userInitiated) {
      this.pauseOtherChapterTasks(chapterId, task.id);
    }
    
    // Attempt to process immediately if not currently busy
    this.processNextTask();
  }
  
  /**
   * Pause all tasks for a chapter except the specified task
   */
  private async pauseOtherChapterTasks(chapterId: string, exceptTaskId: string): Promise<void> {
    const allTasks = await ResourceStore.getAllTasks();
    const chapterTasks = allTasks.filter(t => 
      t.chapterId === chapterId && 
      t.id !== exceptTaskId && 
      (t.status === 'queued' || t.status === 'running')
    );
    
    for (const task of chapterTasks) {
      task.isPaused = true;
      task.status = 'paused';
      await ResourceStore.saveTask(task);
    }
    
    if (chapterTasks.length > 0) {
      console.log(`[ResourcePlanner] Paused ${chapterTasks.length} other tasks for chapter ${chapterId}`);
    }
  }

  /**
   * Process the highest priority pending task
   */
  private async processNextTask() {
    // Check if paused
    if (this.isPaused) {
      console.log('[ResourcePlanner] ⏸️  Scheduler is paused');
      return;
    }
    
    // Check if foreground is active (chat in progress)
    if (this.isForegroundActive) {
      console.log('[ResourcePlanner] 💬 Foreground chat active, deferring background tasks');
      return;
    }

    // If a task is currently running, don't start another one (serial execution for local LLM)
    const activeTasks = await ResourceStore.getTasksByStatus('running');
    if (activeTasks.length > 0) {
      console.log(`[ResourcePlanner] ⏳ Task already in progress: ${activeTasks[0].type} (${activeTasks[0].id})`);
      return;
    }

    const pendingTasks = await ResourceStore.getTasksByStatus('queued');
    if (pendingTasks.length === 0) {
      // Quiet check - no pending work
      return;
    }
    
    // Filter out paused and skipped tasks
    const eligibleTasks = pendingTasks.filter(t => !t.isPaused && !t.isSkipped);
    if (eligibleTasks.length === 0) {
      console.log('[ResourcePlanner] No eligible tasks (all paused/skipped)');
      return;
    }

    // Sort by effective priority (user-initiated > user priority > base priority)
    eligibleTasks.sort((a, b) => {
      // User-initiated tasks always come first
      if (a.userInitiated && !b.userInitiated) return -1;
      if (!a.userInitiated && b.userInitiated) return 1;
      
      const aPriority = a.userPriority ?? a.basePriority ?? a.priority;
      const bPriority = b.userPriority ?? b.basePriority ?? b.priority;
      
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.createdAt - b.createdAt; // Older tasks first within same priority
    });

    const taskToRun = eligibleTasks[0];
    console.log(`[ResourcePlanner] 📋 Queue size: ${eligibleTasks.length}. Selecting highest priority: ${taskToRun.type} (priority: ${taskToRun.userPriority ?? taskToRun.basePriority})`);
    
    // Mark as running
    taskToRun.status = 'running';
    this.currentTask = taskToRun;
    this.foregroundAbortController = new AbortController();
    await ResourceStore.saveTask(taskToRun);

    try {
      console.log(`[ResourcePlanner] Executing task: ${taskToRun.type} for ${taskToRun.chapterId}`);
      
      // Use the task handler registry
      const handler = TaskHandlerRegistry.getHandler(taskToRun.type);
      
      let result;
      if (handler) {
        result = await handler.execute(taskToRun);
      } else {
        console.warn(`[ResourcePlanner] No handler registered for task type: ${taskToRun.type}`);
      }

      taskToRun.status = 'done';
      taskToRun.result = result;
      console.log(`[ResourcePlanner] Task complete: ${taskToRun.type}`);
      
      // Emit resource generated event
      EventBus.emitSync('resource:generated', {
        type: taskToRun.type,
        topic: taskToRun.chapterId,
        duration: Date.now() - taskToRun.createdAt
      });

    } catch (error: any) {
      const errorMsg = error.message || String(error);
      const isAbort = error.name === 'AbortError' || errorMsg.toLowerCase().includes('aborted');
      const isTimeout = errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('timed out');
      
      console.error(`[ResourcePlanner] Task failed: ${taskToRun.type} (${taskToRun.id})`, errorMsg);
      
      taskToRun.lastError = errorMsg;
      taskToRun.retryCount = (taskToRun.retryCount || 0) + 1;

      // If aborted by foreground activity or timed out, we should probably retry
      if ((isAbort || isTimeout) && taskToRun.retryCount <= 3) {
        console.log(`[ResourcePlanner] Task ${taskToRun.id} (type: ${taskToRun.type}) will be re-queued. Attempt: ${taskToRun.retryCount}/3`);
        taskToRun.status = 'queued';
        // Add artificial delay to creation time for simple backoff in priority sorting
        taskToRun.createdAt = Date.now() + (taskToRun.retryCount * 5000); 
      } else {
        console.warn(`[ResourcePlanner] Task ${taskToRun.id} failed permanently after ${taskToRun.retryCount} attempts or due to non-retriable error.`);
        taskToRun.status = 'failed';
      }
    } finally {
      this.currentTask = null;
      this.foregroundAbortController = null;
      await ResourceStore.saveTask(taskToRun);
      
      // Trigger next task if any with a small delay to let model engine settle
      setTimeout(() => this.processNextTask(), 2000);
    }
  }
}

export const ResourcePlanner = new ResourcePlannerService();
