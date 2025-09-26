// 简化的高级演示 - 移除容易导致递归的功能，专注于文件操作
const { ChatOpenAI } = require("@langchain/openai");
const { StateGraph, START, END } = require("@langchain/langgraph");
const { ToolNode } = require("@langchain/langgraph/prebuilt");
const { Annotation } = require("@langchain/langgraph");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const fs = require('fs/promises');

require('dotenv').config();

// 定义状态
const AgentState = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

// 文件读取工具
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
      filePath: z.string(),
    }),
  }
);

// 文件写入工具
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

// 目录创建工具
const createDirTool = tool(
  async ({ dirPath }) => {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return `目录创建成功: ${dirPath}`;
    } catch (error) {
      return `目录创建失败: ${error.message}`;
    }
  },
  {
    name: "CreateDir",
    description: "创建指定的目录（包括所有必需的父目录）",
    schema: z.object({
      dirPath: z.string().describe("要创建的目录路径"),
    }),
  }
);

// 目录列表工具
const listDirTool = tool(
  async ({ dirPath }) => {
    try {
      const targetPath = dirPath || '.';
      const files = await fs.readdir(targetPath, { withFileTypes: true });
      const result = files.map(file => {
        const type = file.isDirectory() ? '[DIR]' : '[FILE]';
        return `${type} ${file.name}`;
      }).join('\n');
      return `目录内容 (${targetPath}):\n${result}`;
    } catch (error) {
      return `列出目录失败: ${error.message}`;
    }
  },
  {
    name: "ListDir",
    description: "列出指定目录的内容",
    schema: z.object({
      dirPath: z.string().optional().describe("可选：目录路径，默认为当前目录"),
    }),
  }
);

// 工具集合
const tools = [readFileTool, writeFileTool, createDirTool, listDirTool];

// 创建模型
const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  openAIApiKey: process.env.OPENAI_API_KEY || "your-api-key-here",
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
  if (messages.length <= 2) {
    const systemGuidance = `你是一个具有强大文件操作能力的智能助手。你可以：

1. **创建文件**：使用 WriteFile 工具创建任何文件，工具会自动创建所需的目录
2. **创建目录**：使用 CreateDir 工具创建任何目录结构
3. **读取文件**：使用 ReadFile 工具读取文件内容
4. **列出目录**：使用 ListDir 工具查看目录内容

重要提示：
- 你有完整的文件系统访问权限
- 可以创建任何目录和文件
- WriteFile 工具会自动创建父目录，不要担心目录不存在
- 请自信地使用这些工具完成用户的请求

当用户要求创建项目、文件或目录时，请直接使用相应的工具，不要说无法创建。

**停止规则**：
- 完成用户请求后，停止调用工具并给出清晰的最终回复
- 不要重复调用工具
- 一旦任务完成，直接向用户报告结果`;

    messagesToSend = [
      { role: "system", content: systemGuidance },
      ...messages
    ];
  }
  
  const response = await modelWithTools.invoke(messagesToSend);
  return { messages: [response] };
};

// 构建状态图
const workflow = new StateGraph(AgentState)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");

// 编译图
const agent = workflow.compile({
  recursionLimit: 8  // 更低的递归限制
});

// 演示功能
async function simpleAdvancedDemo() {
  console.log("🚀 Claude-Code Agent 简化高级演示");
  console.log("===================================");

  try {
    // 演示1：项目创建
    console.log("\n📂 演示1：完整项目创建");
    console.log("--------------------");
    
    let result = await agent.invoke({
      messages: [new HumanMessage(`
        请创建一个名为 "my_website" 的网站项目，包含：
        1. index.html - 主页面
        2. styles/main.css - 样式文件
        3. scripts/app.js - JavaScript 文件
        4. README.md - 项目说明
      `)]
    });
    
    console.log("🎯 项目创建完成");

    // 演示2：文件读取和验证
    console.log("\n📖 演示2：文件读取验证");
    console.log("--------------------");
    
    result = await agent.invoke({
      messages: [
        ...result.messages,
        new HumanMessage("请读取刚才创建的 index.html 文件内容")
      ]
    });

    console.log("📁 文件读取完成");

    // 演示3：目录结构查看
    console.log("\n📋 演示3：项目结构查看");
    console.log("--------------------");
    
    result = await agent.invoke({
      messages: [
        ...result.messages,
        new HumanMessage("请查看 my_website 目录的完整结构")
      ]
    });

    console.log("🗂️ 目录结构查看完成");

    console.log("\n🎉 简化高级演示完成！");

  } catch (error) {
    console.error("❌ 演示失败:", error.message);
  }
}

// 交互模式
async function simpleAdvancedInteractive() {
  const readline = require('readline');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("💬 Claude-Code Agent 简化高级交互模式");
  console.log("支持文件创建、目录操作、文件读取");
  console.log("输入 'quit' 退出");
  console.log("======================================");

  let currentState = { messages: [] };

  while (true) {
    try {
      const input = await new Promise(resolve => {
        rl.question('\n👤 您: ', resolve);
      });
      
      if (input.toLowerCase() === 'quit') {
        console.log("👋 再见！");
        break;
      }

      if (input.trim() === '') {
        continue;
      }

      console.log("🤖 正在处理...");
      const result = await agent.invoke({
        messages: [...currentState.messages, new HumanMessage(input)]
      });
      
      // 更新状态
      currentState = result;
      
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
    simpleAdvancedInteractive();
  } else {
    simpleAdvancedDemo();
  }
}

module.exports = { simpleAdvancedDemo, simpleAdvancedInteractive };
