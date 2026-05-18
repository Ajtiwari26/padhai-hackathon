import { TaskHandler } from '../TaskHandler';
import { ResourceTask } from '../../storage/ResourceStore';
import { TestGenerator } from '../../tests/TestGenerator';

export class TestHandler implements TaskHandler {
  public type = 'test';

  public async execute(task: ResourceTask): Promise<any> {
    return await TestGenerator.generate({
      chapterId: task.chapterId,
      chapterName: task.metadata.chapterName || task.chapterId,
      subtopics: task.metadata.subtopics || [],
      subject: task.metadata.subject || 'General',
      questionCount: task.metadata.questionCount || 15,
      difficulty: task.metadata.difficulty || 60,
      timeLimit: task.metadata.timeLimit || 45
    });
  }
}
