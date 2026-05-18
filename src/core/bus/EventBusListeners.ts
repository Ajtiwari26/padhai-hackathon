/**
 * EventBusListeners - Centralized event listener registration
 * 
 * This module wires up all EventBus listeners for logging, monitoring, and analytics.
 * Critical performance listeners are in their respective modules (CoreSelector, AdaptiveScheduler, etc.)
 */

import { EventBus } from './EventBus';

class EventBusListenerManager {
  private unsubscribers: Array<() => void> = [];

  /**
   * Initialize all event listeners
   */
  public initialize(): void {
    console.log('[EventBusListeners] Initializing event listeners...');

    // User interaction logging
    this.unsubscribers.push(
      EventBus.on('user:message', (data) => {
        console.log(`[User] Message in ${data.topic}: "${data.text.substring(0, 50)}..."`);
      })
    );

    // Memory update logging
    this.unsubscribers.push(
      EventBus.on('memory:updated', (data) => {
        console.log(`[Memory] Updated ${data.factCount} facts for topic: ${data.topic}`);
      })
    );

    this.unsubscribers.push(
      EventBus.on('memory:retrieved', (data) => {
        console.log(`[Memory] Retrieved ${data.facts} facts for topic: ${data.topic}`);
      })
    );

    // System pause/resume logging
    this.unsubscribers.push(
      EventBus.on('system:pause', (data) => {
        console.log(`[System] Paused: ${data.reason}`);
      })
    );

    this.unsubscribers.push(
      EventBus.on('system:resume', (data) => {
        console.log(`[System] Resumed: ${data.reason}`);
      })
    );

    // Resource management logging
    this.unsubscribers.push(
      EventBus.on('resource:paused', (data) => {
        console.log(`[Resource] Background tasks paused: ${data.reason}`);
      })
    );

    this.unsubscribers.push(
      EventBus.on('resource:resumed', (data) => {
        console.log(`[Resource] Background tasks resumed: ${data.reason}`);
      })
    );

    this.unsubscribers.push(
      EventBus.on('resource:generated', (data) => {
        console.log(`[Resource] Generated ${data.type} for ${data.topic} in ${data.duration}ms`);
      })
    );

    // Inference error logging
    this.unsubscribers.push(
      EventBus.on('inference:error', (data) => {
        console.error(`[Inference] Error (${data.priority}): ${data.error}`);
      })
    );

    // Module switching logging
    this.unsubscribers.push(
      EventBus.on('module:switch', (data) => {
        console.log(`[Module] Switched from ${data.from} to ${data.to}: ${data.reason}`);
      })
    );

    this.unsubscribers.push(
      EventBus.on('module:suggested', (data) => {
        console.log(`[Module] Suggested ${data.module} (confidence: ${data.confidence})`);
      })
    );

    // Syllabus generation logging
    this.unsubscribers.push(
      EventBus.on('syllabus:generated', (data) => {
        console.log(`[Syllabus] Generated for ${data.topicId}: ${data.chapterCount} chapters`);
      })
    );

    console.log('[EventBusListeners] ✅ All event listeners initialized');
  }

  /**
   * Cleanup all listeners
   */
  public cleanup(): void {
    console.log('[EventBusListeners] Cleaning up event listeners...');
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }

  /**
   * Get listener statistics
   */
  public getStats(): { event: string; listenerCount: number }[] {
    const events = EventBus.getRegisteredEvents();
    return events.map(event => ({
      event,
      listenerCount: EventBus.listenerCount(event)
    }));
  }
}

export const EventBusListeners = new EventBusListenerManager();
