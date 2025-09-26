// 简单的测试脚本，验证 Agent 是否能正确创建文件
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function testFileCreation() {
  console.log("🧪 测试 Agent 文件创建功能...");
  
  const testInput = "创建一个名为 test_project 的文件夹，包含 index.html 和 style.css 两个文件";
  
  try {
    // 创建一个子进程来运行 demo，并自动输入测试命令
    console.log("📝 输入测试命令:", testInput);
    
    const process = require('child_process').spawn('node', ['demo.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // 发送测试输入
    process.stdin.write(testInput + '\n');
    
    // 等待一段时间让 Agent 处理
    setTimeout(() => {
      process.stdin.write('quit\n');
    }, 10000);
    
    let output = '';
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.on('close', (code) => {
      console.log("📋 Agent 输出:");
      console.log(output);
      
      // 检查是否真的创建了文件
      const fs = require('fs');
      if (fs.existsSync('test_project/index.html')) {
        console.log("✅ 测试成功: 文件已创建");
      } else {
        console.log("❌ 测试失败: 文件未创建");
      }
    });
    
  } catch (error) {
    console.error("❌ 测试执行失败:", error.message);
  }
}

// 运行测试
testFileCreation();
