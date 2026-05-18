import { TaskHandler } from '../TaskHandler';
import { ResourceTask } from '../../storage/ResourceStore';
import { DPPGenerator } from '../../tests/DPPGenerator';

export class DppHandler implements TaskHandler {
  public type = 'dpp';

  public async execute(task: ResourceTask): Promise<any> {
    return await DPPGenerator.generate({
      chapters: task.metadata.chapters || [{ id: task.chapterId, name: task.chapterId }],
      subject: task.metadata.subject || 'General',
      problemCount: task.metadata.problemCount || 10,
      difficulty: task.metadata.difficulty || 60,
      date: task.metadata.date || new Date().toISOString().split('T')[0]
    });
  }
}
