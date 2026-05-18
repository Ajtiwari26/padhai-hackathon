import { ResourceTask } from '../storage/ResourceStore';

export interface TaskHandler {
  type: string;
  execute(task: ResourceTask): Promise<any>;
}
