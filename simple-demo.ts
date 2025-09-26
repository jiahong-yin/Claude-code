// 简化的 TypeScript 演示脚本 - 避免复杂类型问题
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { simpleTools } from "./src/tools/simple-tools";

// 检查环境变量
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.OPENAI_API_KEY || "your-api-key-here";

// 定义简单状态
const SimpleState = Annotation.Root({
  messages: Annotation({
    reducer: (x: any[], y: any[]) => x.concat(y),
    default: () => [],
  }),
});

// 创建模型
const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  openAIApiKey: apiKey,
  temperature: 0.1,
});

const modelWithTools = model.bindTools(simpleTools);

// 工具节点
const toolNode = new ToolNode(simpleTools);

// 路由逻辑
const shouldContinue = (state: any) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  if ("tool_calls" in lastMessage && lastMessage.tool_calls?.length) {
    return "tools";
  }
  return END;
};

// 模型调用节点
const callModel = async (state: any) => {
  const { messages } = state;
  console.log(`🤖 调用模型，消息数量: ${messages.length}`);
  
  const response = await modelWithTools.invoke(messages);
  return { messages: [response] };
};

// 构建图
const workflow = new StateGraph(SimpleState)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");

// 编译图
const agent = workflow.compile();

// 演示函数
async function simpleDemo() {
  console.log("🚀 简化版 Claude-Code Agent 演示 (TypeScript)");
  console.log("============================================");

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
        new HumanMessage("请创建一个名为 'test.txt' 的文件，内容为 'Hello from TypeScript!'，然后读取它")
      ]
    });
    
    console.log("📁 文件操作完成");

    // 演示3：目录查看
    console.log("\n📋 演示3：目录查看");
    console.log("-----------------");
    
    result = await agent.invoke({
      messages: [
        new HumanMessage("请查看当前目录的内容")
      ]
    });
    
    console.log("📋 目录查看完成");

    console.log("\n🎉 简化演示完成！");

  } catch (error: any) {
    console.error("❌ 演示失败:", error.message);
  }
}

// 主程序
if (require.main === module) {
  simpleDemo();
}

export { simpleDemo };
