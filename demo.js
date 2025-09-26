// 简单的 Claude-Code Agent 演示脚本 (JavaScript 版本)
// 用于演示核心概念，不依赖复杂的 TypeScript 配置

const { ChatOpenAI } = require("@langchain/openai");
const { StateGraph, START, END } = require("@langchain/langgraph");
const { ToolNode } = require("@langchain/langgraph/prebuilt");
const { Annotation } = require("@langchain/langgraph");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const fs = require('fs/promises');

// 检查环境变量
require('dotenv').config();

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ 请设置 OPENAI_API_KEY 环境变量");
  process.exit(1);
}

// 定义状态
const MessagesAnnotation = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

// 创建基础工具
const readFileTool = tool(
  async ({ filePath }) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return `文件内容 (${filePath}):\n${content}`;
    } catch (error) {
      return `读取文件失败: ${error.message}`;
    }
  },
  {
    name: "ReadFile",
    description: "读取指定文件的内容",
    schema: z.object({
      filePath: z.string().describe("要读取的文件路径"),
    }),
  }
);

const writeFileTool = tool(
  async ({ filePath, content }) => {
    try {
      // 自动创建目录（如果不存在）
      const path = require('path');
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(filePath, content, 'utf-8');
      return `文件写入成功: ${filePath}`;
    } catch (error) {
      return `文件写入失败: ${error.message}`;
    }
  },
  {
    name: "WriteFile",
    description: "将内容写入指定文件。可以创建任何路径的文件，工具会自动创建所需的目录结构。完全支持嵌套目录路径。",
    schema: z.object({
      filePath: z.string().describe("文件路径（支持嵌套目录，如 'project/src/index.js'）"),
      content: z.string().describe("要写入的文件内容"),
    }),
  }
);

// 工具集合
const tools = [readFileTool, writeFileTool];

// 创建模型
const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0.1,
});

const modelWithTools = model.bindTools(tools);

// 工具节点
const toolNode = new ToolNode(tools);

// 路由逻辑
const shouldContinue = (state) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  if ("tool_calls" in lastMessage && lastMessage.tool_calls?.length) {
    return "tools";
  }
  return END;
};

// 模型调用节点
const callModel = async (state) => {
  const { messages } = state;
  console.log(`🤖 调用模型，消息数量: ${messages.length}`);
  
  // 为第一次调用添加系统指导
  let messagesToSend = messages;
  if (messages.length === 1) {
    const systemGuidance = `你是一个具有文件操作能力的智能助手。你可以：

1. **创建文件**：使用 WriteFile 工具创建任何文件，工具会自动创建所需的目录
2. **读取文件**：使用 ReadFile 工具读取文件内容

重要提示：
- 你有完整的文件系统访问权限
- 可以创建任何目录和文件
- WriteFile 工具会自动创建父目录，不要担心目录不存在
- 请自信地使用这些工具完成用户的请求

当用户要求创建项目、文件或目录时，请直接使用相应的工具，不要说无法创建。`;
    messagesToSend = [
      { role: "system", content: systemGuidance },
      ...messages
    ];
  }
  
  const response = await modelWithTools.invoke(messagesToSend);
  return { messages: [response] };
};

// 构建图
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");

// 编译图
const agent = workflow.compile();

// 主演示函数
async function demo() {
  console.log("🚀 Claude-Code Agent 简化演示");
  console.log("================================");

  try {
    // 演示1：基本对话
    console.log("\n📝 演示1：基本对话");
    console.log("-----------------");
    
    let result = await agent.invoke({
      messages: [new HumanMessage("你好！请介绍一下你的功能")]
    });
    
    const lastMessage = result.messages[result.messages.length - 1];
    console.log("🤖 Agent:", lastMessage.content);

    // 演示2：文件操作
    console.log("\n📂 演示2：文件操作");
    console.log("-----------------");
    
    result = await agent.invoke({
      messages: [
        new HumanMessage("请创建一个名为 'demo.txt' 的文件，内容为 'Hello, Claude-Code Agent!'")
      ]
    });
    
    console.log("📁 文件操作结果:");
    const fileOpMessage = result.messages[result.messages.length - 1];
    console.log(fileOpMessage.content);

    // 演示3：任务规划
    console.log("\n📋 演示3：任务规划");
    console.log("-----------------");
    
    result = await agent.invoke({
      messages: [
        new HumanMessage(`
          我需要创建一个简单的 Node.js 项目。请帮我：
          1. 创建 package.json 文件
          2. 创建一个简单的 index.js 入口文件
          3. 创建 README.md 说明文件
        `)
      ]
    });
    
    console.log("📋 任务规划结果:");
    const taskMessage = result.messages[result.messages.length - 1];
    console.log(taskMessage.content);

    console.log("\n🎉 演示完成！");
    
  } catch (error) {
    console.error("❌ 演示失败:", error.message);
  }
}

// 交互式模式
async function interactive() {
  const readline = require('readline');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("💬 Claude-Code Agent 交互模式");
  console.log("输入 'quit' 退出");
  console.log("==============================");

  while (true) {
    try {
      const input = await new Promise(resolve => {
        rl.question('👤 您: ', resolve);
      });
      
      if (input.toLowerCase() === 'quit') {
        console.log("👋 再见！");
        break;
      }

      if (input.trim() === '') {
        continue;
      }

      console.log("🤖 正在思考...");
      const result = await agent.invoke({
        messages: [new HumanMessage(input)]
      });
      
      const lastMessage = result.messages[result.messages.length - 1];
      console.log("🤖 Agent:", lastMessage.content);

    } catch (error) {
      console.error("❌ 处理请求时出错:", error.message);
    }
  }

  rl.close();
}

// 主程序
if (require.main === module) {
  const mode = process.argv[2];
  
  if (mode === 'interactive' || mode === '-i') {
    interactive();
  } else {
    demo();
  }
}

module.exports = { demo, interactive };
