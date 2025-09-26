import dotenv from 'dotenv';
import { ClaudeCodeAgent } from './agents/claude-code-agent';
import { formatTodoList } from './utils';

// 加载环境变量
dotenv.config();

// 主演示函数
async function main() {
  console.log("🚀 Claude-Code Agent 演示开始");
  console.log("=====================================");

  // 检查环境变量
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ 请设置 OPENAI_API_KEY 环境变量");
    process.exit(1);
  }

  try {
    // 创建 Agent 实例
    const agent = new ClaudeCodeAgent(
      apiKey,
      process.env.DEFAULT_MODEL || "gpt-4-turbo-preview",
      {
        userId: "demo-user",
        maxTokens: parseInt(process.env.MAX_TOKENS || "128000"),
        compressionThreshold: parseFloat(process.env.COMPRESSION_THRESHOLD || "0.92")
      }
    );

    console.log("✅ Agent 创建成功");

    // 演示基本功能
    await demonstrateBasicFeatures(agent);

    // 演示任务管理
    await demonstrateTodoManagement(agent);

    // 演示文件操作
    await demonstrateFileOperations(agent);

    // 演示 SubAgent 功能
    await demonstrateSubAgentFeatures(agent);

    console.log("\n🎉 所有演示完成！");

  } catch (error: any) {
    console.error("❌ 演示过程中出错:", error.message);
  }
}

// 演示基本功能
async function demonstrateBasicFeatures(agent: ClaudeCodeAgent) {
  console.log("\n📋 演示基本对话功能");
  console.log("-------------------");

  const result = await agent.invoke(
    "你好！我是一个用户，请介绍一下你的功能和能力。"
  );

  console.log("🤖 Agent 回复:");
  const lastMessage = result.messages[result.messages.length - 1];
  console.log(lastMessage.content);
}

// 演示任务管理
async function demonstrateTodoManagement(agent: ClaudeCodeAgent) {
  console.log("\n📝 演示任务管理功能");
  console.log("-------------------");

  const result = await agent.invoke(`
    我需要创建一个新的 Node.js 项目，包含以下任务：
    1. 初始化 package.json
    2. 安装必要的依赖
    3. 创建基本的目录结构
    4. 编写一个简单的 Express 服务器
    5. 添加基本的测试
    
    请帮我制定详细的任务计划并开始执行。
  `);

  // 显示任务列表
  if (result.todoList && result.todoList.length > 0) {
    console.log("\n📋 当前任务列表:");
    console.log(formatTodoList(result.todoList));
  }
}

// 演示文件操作
async function demonstrateFileOperations(agent: ClaudeCodeAgent) {
  console.log("\n📂 演示文件操作功能");
  console.log("-------------------");

  const result = await agent.invoke(`
    请帮我：
    1. 查看当前目录的内容
    2. 创建一个名为 demo.txt 的文件，内容为 "Hello, Claude-Code!"
    3. 读取这个文件的内容并确认
  `);

  console.log("📁 文件操作完成");
}

// 演示 SubAgent 功能
async function demonstrateSubAgentFeatures(agent: ClaudeCodeAgent) {
  console.log("\n🤖 演示 SubAgent 功能");
  console.log("-------------------");

  const result = await agent.invoke(`
    我需要分析一个复杂的编程问题：如何设计一个高性能的缓存系统？
    请使用合适的专门 Agent 来帮我分析这个问题的各个方面。
  `);

  console.log("🎯 SubAgent 分析完成");
}

// 流式演示
async function demonstrateStreaming(agent: ClaudeCodeAgent) {
  console.log("\n🌊 演示流式响应功能");
  console.log("-------------------");

  const stream = await agent.stream(
    "请帮我创建一个简单的 React 组件，用于显示用户列表"
  );

  console.log("🔄 开始接收流式响应...");
  for await (const event of stream) {
    if (event.event === 'on_chat_model_stream') {
      process.stdout.write(event.data.chunk.content || '');
    }
  }
  console.log("\n✅ 流式响应完成");
}

// 交互式模式
async function interactiveMode() {
  const readline = require('readline');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ 请设置 OPENAI_API_KEY 环境变量");
    process.exit(1);
  }

  const agent = new ClaudeCodeAgent(apiKey);
  console.log("💬 交互模式启动！输入 'quit' 退出");

  const askQuestion = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question('👤 您: ', (answer) => {
        resolve(answer);
      });
    });
  };

  while (true) {
    try {
      const input = await askQuestion();
      
      if (input.toLowerCase() === 'quit') {
        console.log("👋 再见！");
        break;
      }

      if (input.trim() === '') {
        continue;
      }

      console.log("🤖 正在思考...");
      const result = await agent.invoke(input);
      const lastMessage = result.messages[result.messages.length - 1];
      
      console.log("🤖 Agent:", lastMessage.content);

      // 显示任务状态
      if (result.todoList && result.todoList.length > 0) {
        console.log("\n📋 任务状态:");
        console.log(formatTodoList(result.todoList));
      }

    } catch (error: any) {
      console.error("❌ 处理请求时出错:", error.message);
    }
  }

  rl.close();
}

// 主函数执行
if (require.main === module) {
  const mode = process.argv[2];
  
  if (mode === 'interactive' || mode === '-i') {
    interactiveMode();
  } else {
    main();
  }
}

export { ClaudeCodeAgent };
