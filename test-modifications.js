// 测试Agent是否能执行具体的文件修改
const { ultimateInteractive } = require('./ultimate-claude-code.js');

// 模拟交互测试
async function testModifications() {
  console.log("🧪 测试Agent的具体修改能力");
  console.log("==============================");
  
  // 导入必要的模块
  const { ChatOpenAI } = require("@langchain/openai");
  const { createReactAgent } = require("@langchain/langgraph/prebuilt");
  const { HumanMessage } = require("@langchain/core/messages");
  const { DynamicStructuredTool } = require("@langchain/core/tools");
  const { z } = require("zod");
  const fs = require('fs/promises');
  const path = require('path');
  
  require('dotenv').config();

  // 创建简化的测试工具
  const testEditTool = new DynamicStructuredTool({
    name: "EditFile",
    description: "编辑文件内容",
    schema: z.object({
      filePath: z.string(),
      newContent: z.string()
    }),
    func: async ({ filePath, newContent }) => {
      try {
        console.log(`📝 正在编辑文件: ${filePath}`);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, newContent, 'utf-8');
        console.log(`✅ 文件编辑成功: ${filePath}`);
        return `✅ 文件编辑成功: ${filePath}`;
      } catch (error) {
        console.error(`❌ 文件编辑失败:`, error);
        return `❌ 文件编辑失败: ${error.message}`;
      }
    }
  });

  const testSearchReplaceTool = new DynamicStructuredTool({
    name: "SmartSearchReplace", 
    description: "智能搜索替换工具",
    schema: z.object({
      searchText: z.string(),
      replaceText: z.string(),
      targetFiles: z.array(z.string()).nullable().optional()
    }),
    func: async ({ searchText, replaceText, targetFiles }) => {
      try {
        console.log(`🔍 搜索并替换: "${searchText}" → "${replaceText}"`);
        const searchPaths = targetFiles || ['project/index.html'];
        const results = [];
        
        for (const filePath of searchPaths) {
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            if (content.includes(searchText)) {
              const newContent = content.replace(new RegExp(searchText, 'g'), replaceText);
              await fs.writeFile(filePath, newContent, 'utf-8');
              console.log(`✅ ${filePath} 修改成功`);
              results.push(`✅ ${filePath}: 已修改`);
            }
          } catch (error) {
            console.log(`⚠️ 跳过 ${filePath}: ${error.message}`);
          }
        }
        
        return results.length > 0 ? 
          `🎯 修改完成:\n${results.join('\n')}` : 
          `⚠️ 未找到要替换的文本: "${searchText}"`;
      } catch (error) {
        return `❌ 修改失败: ${error.message}`;
      }
    }
  });

  // 创建测试Agent
  const model = new ChatOpenAI({
    model: "gpt-4-turbo-preview",
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.3,
  });

  const agent = createReactAgent({
    llm: model,
    tools: [testEditTool, testSearchReplaceTool],
    messageModifier: `你是一个测试Agent。当用户要求修改文件时，你必须立即使用工具执行：

🚨 重要：
- 用户说"修改XX"时 → 立即调用 SmartSearchReplace 或 EditFile 工具
- 不要只给建议，要真正执行修改
- 你的工具完全可用，有完整权限

例子：
用户: "将殷嘉鸿改为张三"
你: 立即调用 SmartSearchReplace(searchText="殷嘉鸿", replaceText="张三")

现在开始真正执行！`
  });

  // 测试案例
  const testCases = [
    {
      name: "测试1: 搜索替换功能",
      input: "将project/index.html中的'殷嘉鸿'改为'张三'",
      expectedAction: "应该调用SmartSearchReplace工具"
    },
    {
      name: "测试2: 文件编辑功能", 
      input: "在project目录创建一个test.txt文件，内容为'Hello Test'",
      expectedAction: "应该调用EditFile工具"
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔬 ${testCase.name}`);
    console.log(`📝 输入: ${testCase.input}`);
    console.log(`🎯 期望: ${testCase.expectedAction}`);
    console.log("----------------------------------------");
    
    try {
      const result = await agent.invoke({
        messages: [new HumanMessage(testCase.input)]
      }, { configurable: { thread_id: `test-${Date.now()}` } });
      
      const lastMessage = result.messages[result.messages.length - 1];
      console.log("🤖 Agent响应:", lastMessage.content);
      
      // 检查是否有工具调用
      const hasToolCalls = result.messages.some(msg => 
        "tool_calls" in msg && msg.tool_calls?.length > 0
      );
      
      if (hasToolCalls) {
        console.log("✅ 成功: Agent调用了工具执行修改");
      } else {
        console.log("❌ 失败: Agent只给了建议，没有调用工具");
      }
      
    } catch (error) {
      console.error("❌ 测试出错:", error.message);
    }
    
    console.log("\n" + "=".repeat(50));
  }
  
  console.log("\n🎉 测试完成！");
}

// 运行测试
testModifications();
