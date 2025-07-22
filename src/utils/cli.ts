import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';

export class CLIUtils {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async getFolderPath(): Promise<string> {
    while (true) {
      const folderPath = await this.askQuestion(
        '\n📁 Enter the path to the folder you want to organize: '
      );

      if (!folderPath) {
        console.log('❌ Please enter a valid folder path.');
        continue;
      }

      const absolutePath = path.resolve(folderPath);

      if (!fs.existsSync(absolutePath)) {
        console.log(`❌ Folder does not exist: ${absolutePath}`);
        continue;
      }

      const stat = fs.statSync(absolutePath);
      if (!stat.isDirectory()) {
        console.log(`❌ Path is not a directory: ${absolutePath}`);
        continue;
      }

      console.log(`✅ Folder confirmed: ${absolutePath}`);
      return absolutePath;
    }
  }

  async confirmAction(message: string): Promise<boolean> {
    const answer = await this.askQuestion(`${message} (y/n): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  close(): void {
    this.rl.close();
  }

  displayWelcome(): void {
    console.log('\n🤖 Legal Document Organizer');
    console.log('============================');
    console.log('This tool will organize your legal documents using AI classification.');
    console.log('Documents will be moved into a structured folder system based on their content.');
  }

  displayProgress(current: number, total: number, item?: string): void {
    const percentage = Math.round((current / total) * 100);
    const progressBar = this.createProgressBar(percentage);
    const itemText = item ? ` - ${path.basename(item)}` : '';
    process.stdout.write(`\r📊 Progress: ${progressBar} ${percentage}% (${current}/${total})${itemText}`);
  }

  private createProgressBar(percentage: number, length: number = 20): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  displaySummary(results: { success: number; failed: number; total: number; skipped?: number }): void {
    console.log('\n\n📊 Processing Summary');
    console.log('====================');
    console.log(`✅ Successfully processed: ${results.success} files`);
    console.log(`❌ Failed to process: ${results.failed} files`);
    
    if (results.skipped !== undefined) {
      console.log(`⏭️  Skipped (already exists): ${results.skipped} files`);
    }
    
    console.log(`📁 Total files processed: ${results.total} files`);
    
    if (results.success > 0) {
      console.log('\n🎉 Processing complete! Your documents have been processed.');
    }
    
    if (results.failed > 0) {
      console.log('\n⚠️  Some files could not be processed. Check the error messages above.');
    }
  }

  displayError(message: string, error?: Error): void {
    console.error(`\n❌ ${message}`);
    if (error) {
      console.error(`   Details: ${error.message}`);
    }
  }

  displayInfo(message: string): void {
    console.log(`ℹ️  ${message}`);
  }

  displaySuccess(message: string): void {
    console.log(`✅ ${message}`);
  }

  displayWarning(message: string): void {
    console.log(`⚠️  ${message}`);
  }
}