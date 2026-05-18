import { TaskHandler } from '../TaskHandler';
import { ResourceTask, ResourceStore } from '../../storage/ResourceStore';
import { AISyllabusGenerator } from '../../curriculum/AISyllabusGenerator';

export class SubtopicHandler implements TaskHandler {
  public type = 'subtopic';

  public async execute(task: ResourceTask): Promise<any> {
    const chapter = task.metadata.chapterData;
    
    // Create subtasks for progress tracking
    task.subtasks = [
      { id: '1', name: 'Analyzing chapter structure', status: 'pending', progress: 0 },
      { id: '2', name: 'Generating subtopics', status: 'pending', progress: 0 },
      { id: '3', name: 'Extracting key concepts', status: 'pending', progress: 0 },
      { id: '4', name: 'Saving to storage', status: 'pending', progress: 0 }
    ];
    task.currentSubtask = 0;
    await ResourceStore.saveTask(task);
    
    try {
      // Subtask 1: Analyzing chapter structure
      task.subtasks[0].status = 'running';
      await ResourceStore.saveTask(task);
      console.log(`[SubtopicHandler] Analyzing chapter structure for '${chapter.name}'`);
      await new Promise<void>(resolve => setTimeout(() => resolve(), 500)); // Simulate analysis
      task.subtasks[0].status = 'done';
      task.subtasks[0].progress = 100;
      await ResourceStore.saveTask(task);
      
      // Subtask 2: Generating subtopics
      task.currentSubtask = 1;
      task.subtasks[1].status = 'running';
      await ResourceStore.saveTask(task);
      console.log(`[SubtopicHandler] Generating subtopics for '${chapter.name}'`);
      
      const result = await AISyllabusGenerator.generateChapterDetail(
        chapter, 
        task.metadata.subjectContext || "", 
        'background'
      );
      
      task.subtasks[1].status = 'done';
      task.subtasks[1].progress = 100;
      await ResourceStore.saveTask(task);
      
      if (!result) {
        throw new Error('Failed to generate chapter details');
      }
      
      // Subtask 3: Extracting key concepts
      task.currentSubtask = 2;
      task.subtasks[2].status = 'running';
      await ResourceStore.saveTask(task);
      console.log(`[SubtopicHandler] Extracting key concepts from ${result.subtopics?.length || 0} subtopics`);
      await new Promise<void>(resolve => setTimeout(() => resolve(), 500)); // Simulate extraction
      task.subtasks[2].status = 'done';
      task.subtasks[2].progress = 100;
      await ResourceStore.saveTask(task);
      
      // Subtask 4: Saving to storage
      task.currentSubtask = 3;
      task.subtasks[3].status = 'running';
      await ResourceStore.saveTask(task);
      console.log(`[SubtopicHandler] Saving enriched chapter '${result.name}'`);
      
      await AISyllabusGenerator.updateChapter(result);
      
      task.subtasks[3].status = 'done';
      task.subtasks[3].progress = 100;
      await ResourceStore.saveTask(task);
      
      const subtopicsCount = result.subtopics?.length || 0;
      console.log(`[SubtopicHandler] ✅ Chapter '${result.name}' enriched with ${subtopicsCount} subtopics.`);
      
      return result;
    } catch (error) {
      // Mark current subtask as failed
      if (task.currentSubtask !== undefined && task.subtasks) {
        task.subtasks[task.currentSubtask].status = 'failed';
        await ResourceStore.saveTask(task);
      }
      throw error;
    }
  }
}
