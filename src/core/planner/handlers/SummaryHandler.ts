import { TaskHandler } from '../TaskHandler';
import { ResourceTask } from '../../storage/ResourceStore';
import { SummaryGenerator } from '../../tests/SummaryGenerator';

export class SummaryHandler implements TaskHandler {
  public type = 'summary';

  public async execute(task: ResourceTask): Promise<any> {
    return await SummaryGenerator.generate({
      chapterId: task.chapterId,
      chapterName: task.metadata.chapterName || task.chapterId,
      subtopics: task.metadata.subtopics || [],
      subject: task.metadata.subject || 'General',
      detailLevel: task.metadata.detailLevel || 'detailed'
    });
  }
}
