// 高级 Claude-Code Agent 演示 - 展示更完整的功能
const { ChatOpenAI } = require("@langchain/openai");
const { StateGraph, START, END } = require("@langchain/langgraph");
const { ToolNode } = require("@langchain/langgraph/prebuilt");
const { Annotation } = require("@langchain/langgraph");
const { HumanMessage, AIMessage, ToolMessage } = require("@langchain/core/messages");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const fs = require('fs/promises');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

// 任务状态枚举
const TaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// 扩展状态定义 - 包含 Todo 列表
const AgentState = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  todoList: Annotation({
    reducer: (x, y) => y || x,
    default: () => [],
  }),
  currentStatus: Annotation({
    reducer: (x, y) => y || x,
    default: () => 'idle',
  }),
});

// Todo 管理工具
const todoReadTool = tool(
  async ({}, config) => {
    const state = config.state;
    const currentTasks = state.todoList || [];
    return `当前任务列表 (${currentTasks.length} 个任务):\n${formatTodoList(currentTasks)}`;
  },
  {
    name: "TodoRead",
    description: "读取当前会话的任务列表",
    schema: z.object({}),
  }
);

const todoWriteTool = tool(
  async ({ todoList }) => {
    const processedTasks = todoList.map(task => ({
      ...task,
      id: task.id || uuidv4(),
      startTime: task.status === TaskStatus.IN_PROGRESS && !task.startTime ? new Date().toISOString() : task.startTime,
      endTime: (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) && !task.endTime ? new Date().toISOString() : task.endTime,
    }));
    
    return {
      result: `任务列表已更新，共 ${todoList.length} 个任务`,
      updateState: { todoList: processedTasks }
    };
  },
  {
    name: "TodoWrite",
    description: `更新任务列表。仅在用户需要任务跟踪时使用：
1. 开始任务时标记为 in_progress
2. 完成任务时标记为 completed  
3. 失败时标记为 failed
4. 新增任务时状态为 pending`,
    schema: z.object({
      todoList: z.array(z.object({
        id: z.string().nullable().optional(),
        name: z.string().describe('任务名称'),
        desc: z.string().describe('任务描述'),
        status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
        startTime: z.string().nullable().optional(),
        endTime: z.string().nullable().optional(),
        error: z.string().nullable().optional(),
      })).describe('完整任务列表'),
    }),
  }
);

// 文件操作工具
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

// SubAgent 模拟工具
const subAgentTool = tool(
  async ({ description, agentType }) => {
    console.log(`🤖 启动 SubAgent [${agentType}]: ${description}`);
    
    // 模拟 SubAgent 处理时间
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let result = '';
    switch (agentType) {
      case 'code-analyzer':
        result = `代码分析完成:\n- 发现 3 个潜在性能优化点\n- 建议重构 2 个函数\n- 代码质量评分: 85/100`;
        break;
      case 'document-writer':
        result = `文档生成完成:\n- 创建 API 文档 (15 个接口)\n- 生成用户指南 (8 个章节)\n- 添加代码示例 (12 个)`;
        break;
      default:
        result = `任务分析完成:\n- 任务复杂度: 中等\n- 预计工时: 2-3 小时\n- 建议分解为 4 个子任务`;
    }
    
    console.log(`✅ SubAgent [${agentType}] 完成`);
    return `SubAgent [${agentType}] 执行结果:\n\n任务: ${description}\n\n结果:\n${result}`;
  },
  {
    name: "SubAgent",
    description: `启动专门的 SubAgent 处理复杂任务。可用类型:
- general-purpose: 通用任务处理
- code-analyzer: 代码分析专家  
- document-writer: 文档编写专家`,
    schema: z.object({
      description: z.string().describe("详细的任务描述"),
      agentType: z.enum(["general-purpose", "code-analyzer", "document-writer"]),
    }),
  }
);

// 工具集合
const tools = [todoReadTool, todoWriteTool, readFileTool, writeFileTool, createDirTool, subAgentTool];

// 创建模型
const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  openAIApiKey: process.env.OPENAI_API_KEY || "your-api-key-here",
  temperature: 0.1,
});

const modelWithTools = model.bindTools(tools);

// 自定义工具节点 - 支持状态更新
class CustomToolNode {
  constructor(tools) {
    this.tools = tools;
  }

  async invoke(state) {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    
    if (!("tool_calls" in lastMessage) || !lastMessage.tool_calls?.length) {
      return { messages: [] };
    }

    const results = [];
    let stateUpdates = {};

    for (const toolCall of lastMessage.tool_calls) {
      const tool = this.tools.find(t => t.name === toolCall.name);
      if (tool) {
        try {
          const result = await tool.func(toolCall.args, { state });
          
          // 检查是否有状态更新
          if (typeof result === 'object' && result.updateState) {
            stateUpdates = { ...stateUpdates, ...result.updateState };
            results.push(new ToolMessage({
              content: result.result || JSON.stringify(result),
              tool_call_id: toolCall.id,
              name: tool.name,
            }));
          } else {
            results.push(new ToolMessage({
              content: result,
              tool_call_id: toolCall.id,
              name: tool.name,
            }));
          }
        } catch (error) {
          results.push(new ToolMessage({
            content: `工具执行失败: ${error.message}`,
            tool_call_id: toolCall.id,
            name: tool.name,
          }));
        }
      }
    }

    return {
      messages: results,
      ...stateUpdates
    };
  }
}

const toolNode = new CustomToolNode(tools);

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
  const { messages, todoList } = state;
  
  console.log(`🤖 调用模型，消息数量: ${messages.length}, 任务数量: ${todoList.length}`);
  
  // 只有在第一次调用或者消息很少时才添加系统指导
  let messagesToSend = messages;
  if (messages.length <= 2) {
    const systemGuidance = `你是一个具有文件操作能力的智能助手。你可以：

1. **创建文件和目录**：使用 WriteFile 工具创建任何文件，工具会自动创建所需的目录
2. **创建目录**：使用 CreateDir 工具创建任何目录结构  
3. **读取文件**：使用 ReadFile 工具读取文件内容
4. **任务管理**：在用户需要时使用 TodoRead/TodoWrite 工具
5. **专家协作**：使用 SubAgent 工具处理复杂任务

重要提示：
- 你有完整的文件系统访问权限
- 可以创建任何目录和文件
- WriteFile 工具会自动创建父目录，不要担心目录不存在
- 请自信地使用这些工具完成用户的请求

当用户要求创建项目、文件或目录时，请直接使用相应的工具，不要说无法创建。

**重要的停止规则**：
- 完成用户请求后，请停止调用工具并给出最终回复
- 不要无休止地调用 TodoRead 或其他工具
- 一旦任务完成，直接向用户报告结果`;
    messagesToSend = [
      { role: "system", content: systemGuidance },
      ...messages
    ];
  }
  
  const response = await modelWithTools.invoke(messagesToSend);
  return { 
    messages: [response],
    currentStatus: 'model_called'
  };
};

// 构建状态图
const workflow = new StateGraph(AgentState)
  .addNode("agent", callModel)
  .addNode("tools", (state) => toolNode.invoke(state))
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");

// 编译图
const agent = workflow.compile({
  recursionLimit: 10  // 进一步降低递归限制，防止无限循环
});

// 工具函数
function formatTodoList(todos) {
  if (!todos || todos.length === 0) {
    return "无任务";
  }

  return todos.map((todo, index) => {
    const statusIcon = {
      'pending': '⏳',
      'in_progress': '🔄', 
      'completed': '✅',
      'failed': '❌'
    }[todo.status] || '📝';
    
    let timeInfo = '';
    if (todo.startTime) {
      timeInfo += `\n   开始: ${new Date(todo.startTime).toLocaleString()}`;
    }
    if (todo.endTime) {
      timeInfo += `\n   结束: ${new Date(todo.endTime).toLocaleString()}`;
    }
    
    return `${index + 1}. ${statusIcon} ${todo.name}\n   ${todo.desc}${timeInfo}`;
  }).join('\n\n');
}

// 演示功能
async function advancedDemo() {
  console.log("🚀 Claude-Code Agent 高级功能演示");
  console.log("===================================");

  try {
    // 演示1：任务管理
    console.log("\n📋 演示1：智能任务管理");
    console.log("---------------------");
    
    let result = await agent.invoke({
      messages: [new HumanMessage(`
        我需要创建一个完整的 Node.js Web 应用。请帮我制定详细的任务计划，包括：
        1. 项目初始化
        2. 安装依赖
        3. 创建基本结构
        4. 实现 API 接口
        5. 添加前端页面
        6. 编写文档
        
        请创建任务列表并开始执行第一个任务。
      `)]
    });
    
    console.log("📋 任务规划完成:");
    if (result.todoList?.length > 0) {
      console.log(formatTodoList(result.todoList));
    }

    // 演示2：SubAgent 协作
    console.log("\n🤖 演示2：SubAgent 专家协作");
    console.log("---------------------------");
    
    result = await agent.invoke({
      messages: [
        ...result.messages,
        new HumanMessage("现在请使用代码分析专家来分析我们需要实现的 API 架构，并使用文档专家来规划文档结构。")
      ]
    });

    console.log("🎯 专家协作完成");

    // 演示3：文件操作与任务更新
    console.log("\n📂 演示3：文件操作与任务状态更新");
    console.log("-------------------------------");
    
    result = await agent.invoke({
      messages: [
        ...result.messages,
        new HumanMessage("请创建项目的 package.json 和 README.md 文件，并更新相应的任务状态为已完成。")
      ]
    });

    console.log("📁 文件操作完成");
    
    // 显示最终状态
    console.log("\n📊 最终任务状态:");
    if (result.todoList?.length > 0) {
      console.log(formatTodoList(result.todoList));
    }

    console.log("\n🎉 高级演示完成！");

  } catch (error) {
    console.error("❌ 演示失败:", error.message);
  }
}

// 交互模式
async function advancedInteractive() {
  const readline = require('readline');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("💬 Claude-Code Agent 高级交互模式");
  console.log("支持任务管理、SubAgent 协作、文件操作");
  console.log("输入 'quit' 退出，'status' 查看任务状态");
  console.log("======================================");

  let currentState = { messages: [], todoList: [], currentStatus: 'idle' };

  while (true) {
    try {
      const input = await new Promise(resolve => {
        rl.question('\n👤 您: ', resolve);
      });
      
      if (input.toLowerCase() === 'quit') {
        console.log("👋 再见！");
        break;
      }

      if (input.toLowerCase() === 'status') {
        console.log("📊 当前状态:");
        console.log(`消息数量: ${currentState.messages.length}`);
        console.log(`任务数量: ${currentState.todoList.length}`);
        console.log(`当前状态: ${currentState.currentStatus}`);
        if (currentState.todoList.length > 0) {
          console.log("\n任务列表:");
          console.log(formatTodoList(currentState.todoList));
        }
        continue;
      }

      if (input.trim() === '') {
        continue;
      }

      console.log("🤖 正在思考...");
      const result = await agent.invoke({
        messages: [...currentState.messages, new HumanMessage(input)],
        todoList: currentState.todoList,
        currentStatus: currentState.currentStatus
      });
      
      // 更新状态
      currentState = result;
      
      const lastMessage = result.messages[result.messages.length - 1];
      console.log("🤖 Agent:", lastMessage.content);

      // 显示任务状态更新
      if (result.todoList?.length > 0) {
        console.log("\n📋 任务状态:");
        console.log(formatTodoList(result.todoList));
      }

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
    advancedInteractive();
  } else {
    advancedDemo();
  }
}

module.exports = { advancedDemo, advancedInteractive };
