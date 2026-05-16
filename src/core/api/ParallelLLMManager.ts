/**
 * Parallel LLM Manager
 * 
 * Manages multiple LLM instances on different ports
 * Enables parallel execution of text + diagram generation
 */

import { ModelManager } from './ModelManager';
import type { GeneratedDiagram } from '../../skills/DiagramGenerator';

export interface LLMInstance {
  port: number;
  role: 'main' | 'diagram' | 'formula' | 'auxiliary';
  status: 'idle' | 'busy' | 'error';
  lastUsed: number;
}

export interface ParallelTask {
  main: (port: number) => Promise<string>;
  diagram?: (port: number) => Promise<any>;
  formula?: (port: number) => Promise<GeneratedDiagram>;
  auxiliary?: (port: number) => Promise<any>;
}

export interface ParallelResult {
  text: string;
  diagram?: any;
  formula?: GeneratedDiagram;
  auxiliary?: any;
  executionTime: number;
}

class ParallelLLMManagerService {
  private instances: LLMInstance[] = [
    { port: 8080, role: 'main', status: 'idle', lastUsed: 0 },
    { port: 8081, role: 'diagram', status: 'idle', lastUsed: 0 },
    { port: 8082, role: 'formula', status: 'idle', lastUsed: 0 },
    { port: 8083, role: 'auxiliary', status: 'idle', lastUsed: 0 }
  ];

  /**
   * Execute multiple tasks in parallel
   */
  async executeParallel(tasks: ParallelTask): Promise<ParallelResult> {
    const startTime = Date.now();
    console.log('[ParallelLLM] Starting parallel execution...');

    const promises: Promise<any>[] = [];
    const taskNames: string[] = [];

    // Detect which ports are actually running. 
    // On most mobile devices, only 8080 will be available.
    // Route ALL tasks through 8080 — the ModelManager port lock ensures sequential execution.
    const INFERENCE_PORT = 8080;

    // Main conversation (always executed)
    promises.push(this.executeOnPort(INFERENCE_PORT, tasks.main, 'main'));
    taskNames.push('main');

    // Diagram generation — same port, queued behind main via port lock
    if (tasks.diagram) {
      promises.push(
        this.executeOnPort(INFERENCE_PORT, tasks.diagram, 'diagram')
          .catch(err => {
            console.warn('[ParallelLLM] Diagram task failed:', err);
            return null;
          })
      );
      taskNames.push('diagram');
    }

    // Formula rendering
    if (tasks.formula) {
      promises.push(
        this.executeOnPort(INFERENCE_PORT, tasks.formula, 'formula')
          .catch(err => {
            console.warn('[ParallelLLM] Formula task failed:', err);
            return null;
          })
      );
      taskNames.push('formula');
    }

    // Auxiliary task
    if (tasks.auxiliary) {
      promises.push(
        this.executeOnPort(INFERENCE_PORT, tasks.auxiliary, 'auxiliary')
          .catch(err => {
            console.warn('[ParallelLLM] Auxiliary task failed:', err);
            return null;
          })
      );
      taskNames.push('auxiliary');
    }

    try {
      // Wait for all tasks to complete (some might return null if they failed)
      const results = await Promise.all(promises);

      const executionTime = Date.now() - startTime;
      console.log(`[ParallelLLM] ✅ All tasks completed in ${executionTime}ms`);

      // Map results back to named fields
      const result: ParallelResult = {
        text: results[0],
        executionTime
      };

      if (taskNames.includes('diagram')) {
        result.diagram = results[taskNames.indexOf('diagram')] || undefined;
      }
      if (taskNames.includes('formula')) {
        result.formula = results[taskNames.indexOf('formula')] || undefined;
      }
      if (taskNames.includes('auxiliary')) {
        result.auxiliary = results[taskNames.indexOf('auxiliary')] || undefined;
      }

      return result;
    } catch (error) {
      console.error('[ParallelLLM] ❌ Critical failure in parallel execution:', error);
      throw error;
    }
  }

  /**
   * Execute task on specific LLM instance
   */
  private async executeOnPort(
    port: number,
    task: (port: number) => Promise<any>,
    role: string
  ): Promise<any> {
    const instance = this.instances.find(i => i.port === port);

    if (!instance) {
      throw new Error(`No LLM instance configured for port ${port}`);
    }

    // Check if instance is busy
    if (instance.status === 'busy') {
      console.warn(`[ParallelLLM] Port ${port} is busy, waiting...`);
      await this.waitForIdle(instance);
    }

    // Mark as busy
    instance.status = 'busy';
    instance.lastUsed = Date.now();

    console.log(`[ParallelLLM] 🚀 Executing ${role} task on port ${port}`);

    try {
      const result = await task(port);
      
      // Mark as idle
      instance.status = 'idle';
      
      console.log(`[ParallelLLM] ✅ ${role} task completed on port ${port}`);
      return result;
    } catch (error) {
      // Mark as error
      instance.status = 'error';
      console.error(`[ParallelLLM] ❌ ${role} task failed on port ${port}:`, error);
      
      // Reset to idle after 5 seconds
      setTimeout(() => {
        instance.status = 'idle';
      }, 5000);
      
      throw error;
    }
  }

  /**
   * Wait for instance to become idle
   */
  private async waitForIdle(instance: LLMInstance, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (instance.status === 'busy') {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for port ${instance.port} to become idle`);
      }
      await new Promise(resolve => setTimeout(() => resolve(null), 100));
    }
  }

  /**
   * Get instance status
   */
  getInstanceStatus(port: number): LLMInstance | undefined {
    return this.instances.find(i => i.port === port);
  }

  /**
   * Get all instances status
   */
  getAllInstancesStatus(): LLMInstance[] {
    return [...this.instances];
  }

  /**
   * Check if parallel execution is available
   */
  isParallelAvailable(): boolean {
    const idleInstances = this.instances.filter(i => i.status === 'idle');
    return idleInstances.length >= 2; // Need at least 2 idle instances
  }

  /**
   * Get next available instance
   */
  getNextAvailableInstance(excludePorts: number[] = []): LLMInstance | null {
    const available = this.instances.filter(
      i => i.status === 'idle' && !excludePorts.includes(i.port)
    );

    if (available.length === 0) return null;

    // Return least recently used
    return available.sort((a, b) => a.lastUsed - b.lastUsed)[0];
  }

  /**
   * Execute with automatic port selection
   */
  async executeAuto(task: () => Promise<any>, role: string = 'auxiliary'): Promise<any> {
    const instance = this.getNextAvailableInstance();

    if (!instance) {
      console.warn('[ParallelLLM] No available instances, using main port');
      return await this.executeOnPort(8080, task, role);
    }

    return await this.executeOnPort(instance.port, task, role);
  }

  /**
   * Reset all instances to idle
   */
  resetAllInstances(): void {
    console.log('[ParallelLLM] Resetting all instances to idle');
    this.instances.forEach(i => {
      i.status = 'idle';
      i.lastUsed = 0;
    });
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const now = Date.now();
    return {
      totalInstances: this.instances.length,
      idleInstances: this.instances.filter(i => i.status === 'idle').length,
      busyInstances: this.instances.filter(i => i.status === 'busy').length,
      errorInstances: this.instances.filter(i => i.status === 'error').length,
      instances: this.instances.map(i => ({
        port: i.port,
        role: i.role,
        status: i.status,
        idleTime: i.status === 'idle' ? now - i.lastUsed : 0
      }))
    };
  }
}

export const ParallelLLMManager = new ParallelLLMManagerService();
