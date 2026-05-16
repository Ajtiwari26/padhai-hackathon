import { ResourceStore, ResourceTask } from '../storage/ResourceStore';
import { AdaptiveQuestionGenerator } from '../questions/AdaptiveQuestionGenerator';
import { AISyllabusGenerator } from '../curriculum/AISyllabusGenerator';
import { TestGenerator } from '../tests/TestGenerator';
import { DPPGenerator } from '../tests/DPPGenerator';
import { SummaryGenerator } from '../tests/SummaryGenerator';

class ResourcePlannerService {
  private isRunning = false;
  private isPaused = false;
  private taskInterval: ReturnType<typeof setInterval> | null = null;
  
  // Weights for priority sorting
  private readonly PRIORITY_MAP: Record<string, number> = {
    'syllabus': 1,
    'subtopic': 2,
    'mcq': 3,
    'numerical': 4,
    'test': 5,
    'dpp': 6,
    'summary': 7,
    'mcq_batch': 3,
    'numerical_batch': 4,
  };

  /**
   * Starts the background scheduler
   */
  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Clean up any tasks that were left in 'running' state (e.g. after a crash)
    await this.cleanupStaleTasks();
    
    console.log('[ResourcePlanner] Scheduler started');
    
    // Check queue every 10 seconds
    this.taskInterval = setInterval(() => {
      this.processNextTask();
    }, 10000);
    
    // Process one immediately
    this.processNextTask();
  }

  public stop() {
    this.isRunning = false;
    if (this.taskInterval) {
      clearInterval(this.taskInterval);
      this.taskInterval = null;
    }
    console.log('[ResourcePlanner] Scheduler stopped');
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
    metadata: any = {}
  ) {
    const priority = this.PRIORITY_MAP[type] || 10;
    
    const task: ResourceTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type,
      chapterId,
      subtopic,
      priority,
      status: 'queued',
      createdAt: Date.now(),
      metadata,
      retryCount: 0
    };

    ResourceStore.saveTask(task);
    console.log(`[ResourcePlanner] Queued task: ${type} for ${chapterId}`);
    
    // Attempt to process immediately if not currently busy
    this.processNextTask();
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

    // Sort by priority (lower number = higher priority), then by age
    pendingTasks.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.createdAt - b.createdAt;
    });

    const taskToRun = pendingTasks[0];
    console.log(`[ResourcePlanner] 📋 Queue size: ${pendingTasks.length}. Selecting highest priority: ${taskToRun.type} (${taskToRun.id})`);
    
    // Mark as running
    taskToRun.status = 'running';
    await ResourceStore.saveTask(taskToRun);

    try {
      console.log(`[ResourcePlanner] Executing task: ${taskToRun.type} for ${taskToRun.chapterId}`);
      
      let result;
      switch (taskToRun.type) {
        case 'syllabus':
          // The outline is generated in the UI usually, but could be backgrounded
          break;
        case 'subtopic':
          // Pass subject context from metadata to ensure AI has full context for chapter enrichment
          result = await AISyllabusGenerator.generateChapterDetail(
            taskToRun.metadata.chapterData, 
            taskToRun.metadata.subjectContext || "", 
            'background'
          );
          if (result) {
            const subtopicsCount = result.subtopics?.length || 0;
            console.log(`[ResourcePlanner] Chapter '${result.name}' enriched with ${subtopicsCount} subtopics.`);
            await AISyllabusGenerator.updateChapter(result);
          }
          break;
        case 'mcq':
          result = await AdaptiveQuestionGenerator.generate({
            topic: taskToRun.chapterId,
            subtopic: taskToRun.subtopic,
            concepts: [taskToRun.subtopic],
            difficulty: taskToRun.metadata.difficulty || 50,
            mathComplexity: 'algebra',
            thinkingDepth: 'application',
            studentUnderstanding: 50,
            previousAttempts: { correct: 0, wrong: 0, avgTime: 0 },
            type: 'mcq',
            style: 'conceptual'
          }, 'background');
          break;
        case 'numerical':
          result = await AdaptiveQuestionGenerator.generate({
            topic: taskToRun.chapterId,
            subtopic: taskToRun.subtopic,
            concepts: [taskToRun.subtopic],
            difficulty: taskToRun.metadata.difficulty || 60,
            mathComplexity: 'algebra',
            thinkingDepth: 'application',
            studentUnderstanding: 50,
            previousAttempts: { correct: 0, wrong: 0, avgTime: 0 },
            type: 'numerical',
            style: 'direct'
          }, 'background');
          break;
        case 'test':
          result = await TestGenerator.generate({
            chapterId: taskToRun.chapterId,
            chapterName: taskToRun.metadata.chapterName || taskToRun.chapterId,
            subtopics: taskToRun.metadata.subtopics || [],
            subject: taskToRun.metadata.subject || 'General',
            questionCount: taskToRun.metadata.questionCount || 15,
            difficulty: taskToRun.metadata.difficulty || 60,
            timeLimit: taskToRun.metadata.timeLimit || 45
          });
          break;
        case 'dpp':
          result = await DPPGenerator.generate({
            chapters: taskToRun.metadata.chapters || [{ id: taskToRun.chapterId, name: taskToRun.chapterId }],
            subject: taskToRun.metadata.subject || 'General',
            problemCount: taskToRun.metadata.problemCount || 10,
            difficulty: taskToRun.metadata.difficulty || 60,
            date: taskToRun.metadata.date || new Date().toISOString().split('T')[0]
          });
          break;
        case 'summary':
          result = await SummaryGenerator.generate({
            chapterId: taskToRun.chapterId,
            chapterName: taskToRun.metadata.chapterName || taskToRun.chapterId,
            subtopics: taskToRun.metadata.subtopics || [],
            subject: taskToRun.metadata.subject || 'General',
            detailLevel: taskToRun.metadata.detailLevel || 'detailed'
          });
          break;
      }

      taskToRun.status = 'done';
      taskToRun.result = result;
      console.log(`[ResourcePlanner] Task complete: ${taskToRun.type}`);

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
      await ResourceStore.saveTask(taskToRun);
      
      // Trigger next task if any with a small delay to let model engine settle
      setTimeout(() => this.processNextTask(), 2000);
    }
  }
}

export const ResourcePlanner = new ResourcePlannerService();
