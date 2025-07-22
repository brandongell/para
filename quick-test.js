const { spawn } = require('child_process');

console.log('Testing improved classification...');

const child = spawn('npm', ['run', 'dev'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: process.cwd()
});

let step = 0;

child.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('OUT:', output);
  
  if (output.includes('Enter the path to the folder') && step === 0) {
    setTimeout(() => {
      console.log('→ Sending: test-files');
      child.stdin.write('test-files\n');
      step = 1;
    }, 1000);
  }
  
  if (output.includes('Do you want to organize existing files') && step === 1) {
    setTimeout(() => {
      console.log('→ Sending: y');
      child.stdin.write('y\n');
      step = 2;
    }, 1000);
  }
  
  if (output.includes('Continue?') && step === 2) {
    setTimeout(() => {
      console.log('→ Sending: y');
      child.stdin.write('y\n');
      step = 3;
    }, 1000);
  }
  
  if (output.includes('Organization complete') || output.includes('Do you want to monitor') && step === 3) {
    setTimeout(() => {
      console.log('→ Sending: n');
      child.stdin.write('n\n');
      step = 4;
    }, 1000);
  }
});

child.stderr.on('data', (data) => {
  console.log('ERR:', data.toString());
});

child.on('close', (code) => {
  console.log(`\n✅ Test completed. Check the results!`);
  process.exit(0);
});

// Safety timeout
setTimeout(() => {
  console.log('⏰ Timeout reached, stopping...');
  child.kill('SIGTERM');
}, 45000);