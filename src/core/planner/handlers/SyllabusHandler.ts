import { TaskHandler } from '../TaskHandler';
import { ResourceTask } from '../../storage/ResourceStore';

export class SyllabusHandler implements TaskHandler {
  public type = 'syllabus';

  public async execute(task: ResourceTask): Promise<any> {
    // The outline is generated in the UI usually, but could be backgrounded
    // For now, this is a no-op handler
    console.log('[SyllabusHandler] Syllabus task - typically handled in UI');
    return null;
  }
}
