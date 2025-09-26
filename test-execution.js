// 测试真实执行能力的脚本
const fs = require('fs/promises');
const { spawn } = require('child_process');

async function testRealExecution() {
  console.log("🧪 测试 Agent 真实执行能力");
  console.log("============================");

  try {
    // 1. 创建测试文件
    console.log("\n📝 步骤1: 创建测试文件");
    const testContent = `<!DOCTYPE html>
<html>
<head>
    <title>测试网站</title>
</head>
<body>
    <h1>Hello World</h1>
    <p>这是原始内容</p>
    <p>作者: 旧名字</p>
</body>
</html>`;
    
    await fs.writeFile('test-website.html', testContent, 'utf-8');
    console.log("✅ 测试文件创建成功: test-website.html");

    // 2. 显示原始内容
    console.log("\n📖 步骤2: 原始文件内容");
    const original = await fs.readFile('test-website.html', 'utf-8');
    console.log("原始内容:", original.substring(0, 200) + "...");

    // 3. 通过 Agent 修改文件
    console.log("\n🤖 步骤3: 让 Agent 修改文件");
    console.log("发送指令: '将 test-website.html 中的标题改为 \"我的个人网站\"，将作者改为 \"殷嘉鸿\"'");
    
    return new Promise((resolve) => {
      const agentProcess = spawn('node', ['ultimate-claude-code.js'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      
      agentProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log(text);
      });

      agentProcess.stderr.on('data', (data) => {
        console.error("错误:", data.toString());
      });

      // 发送修改指令
      setTimeout(() => {
        const command = '将 test-website.html 中的标题改为 "我的个人网站"，将 "旧名字" 改为 "殷嘉鸿"\n';
        agentProcess.stdin.write(command);
      }, 2000);

      // 等待执行完成后退出
      setTimeout(() => {
        agentProcess.stdin.write('quit\n');
      }, 15000);

      agentProcess.on('close', async (code) => {
        console.log(`\n🏁 Agent 执行完成 (exit code: ${code})`);
        
        try {
          // 4. 检查文件是否真的被修改
          console.log("\n📊 步骤4: 验证修改结果");
          const modified = await fs.readFile('test-website.html', 'utf-8');
          
          console.log("修改后内容:", modified.substring(0, 300) + "...");
          
          // 验证具体修改
          const hasNewTitle = modified.includes('我的个人网站');
          const hasNewName = modified.includes('殷嘉鸿');
          const stillHasOldName = modified.includes('旧名字');
          
          console.log("\n✅ 修改验证结果:");
          console.log(`📝 标题修改: ${hasNewTitle ? '✅ 成功' : '❌ 失败'}`);
          console.log(`👤 名字修改: ${hasNewName ? '✅ 成功' : '❌ 失败'}`);
          console.log(`🗑️ 旧内容清除: ${!stillHasOldName ? '✅ 成功' : '❌ 失败'}`);
          
          if (hasNewTitle && hasNewName && !stillHasOldName) {
            console.log("\n🎉 测试结果: Agent 具备真实执行能力！");
          } else {
            console.log("\n⚠️ 测试结果: Agent 仍然不能真正执行修改");
          }

          // 清理测试文件
          await fs.unlink('test-website.html');
          console.log("🗑️ 测试文件已清理");
          
        } catch (error) {
          console.error("❌ 验证失败:", error.message);
        }
        
        resolve();
      });
    });

  } catch (error) {
    console.error("❌ 测试设置失败:", error.message);
  }
}

// 运行测试
if (require.main === module) {
  testRealExecution();
}

module.exports = { testRealExecution };
