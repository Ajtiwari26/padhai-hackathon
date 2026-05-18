import { TaskHandler } from '../TaskHandler';
import { ResourceTask } from '../../storage/ResourceStore';
import { AdaptiveQuestionGenerator } from '../../questions/AdaptiveQuestionGenerator';

export class NumericalHandler implements TaskHandler {
  public type = 'numerical';

  public async execute(task: ResourceTask): Promise<any> {
    return await AdaptiveQuestionGenerator.generate({
      topic: task.chapterId,
      subtopic: task.subtopic,
      concepts: [task.subtopic],
      difficulty: task.metadata.difficulty || 60,
      mathComplexity: 'algebra',
      thinkingDepth: 'application',
      studentUnderstanding: 50,
      previousAttempts: { correct: 0, wrong: 0, avgTime: 0 },
      type: 'numerical',
      style: 'direct'
    }, 'background');
  }
}
