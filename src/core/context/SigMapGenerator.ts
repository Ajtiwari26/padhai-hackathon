/**
 * SigMapGenerator — Project Context Compression Engine.
 * 
 * This service provides regex-based signature extraction.
 * Note: File system scanning is not supported on-device.
 */

export interface Signature {
  name: string;
  type: 'class' | 'function' | 'interface' | 'method' | 'variable';
  params?: string;
  returnType?: string;
  line: number;
}

export interface FileMap {
  path: string;
  signatures: Signature[];
  imports: string[];
}

export class SigMapGenerator {
  /**
   * Extract signatures from raw text content.
   * Strips implementation logic (everything between { }).
   */
  static extractFromContent(content: string): Signature[] {
    return this.extractSignatures(content);
  }
  private static extractSignatures(content: string): Signature[] {
    const signatures: Signature[] = [];
    const lines = content.split('\n');

    // Regex for: export class MyClass { ... }
    const classRegex = /(?:export\s+)?class\s+(\w+)/g;
    // Regex for: export function myFunc(a: string): void { ... }
    const funcRegex = /(?:export\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\{]+))?/g;
    // Regex for: interface IMyInterface { ... }
    const interfaceRegex = /(?:export\s+)?interface\s+(\w+)/g;
    // Regex for: public async myMethod(a: number) { ... }
    const methodRegex = /(?:public|private|protected|static|async)?\s*(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\{]+))?\s*\{/g;

    lines.forEach((line, index) => {
      let match;

      // Class
      while ((match = classRegex.exec(line)) !== null) {
        signatures.push({ name: match[1], type: 'class', line: index + 1 });
      }

      // Interface
      while ((match = interfaceRegex.exec(line)) !== null) {
        signatures.push({ name: match[1], type: 'interface', line: index + 1 });
      }

      // Function
      while ((match = funcRegex.exec(line)) !== null) {
        signatures.push({
          name: match[1],
          type: 'function',
          params: match[2],
          returnType: match[3]?.trim(),
          line: index + 1
        });
      }

      // Method (excluding common keywords)
      while ((match = methodRegex.exec(line)) !== null) {
        const name = match[1];
        if (!['if', 'for', 'while', 'switch', 'catch'].includes(name)) {
          signatures.push({
            name,
            type: 'method',
            params: match[2],
            returnType: match[3]?.trim(),
            line: index + 1
          });
        }
      }
    });

    return signatures;
  }

  private static extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*\s+from\s+['"](.+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }
}
