import { StateGraph, START, END, ToolNode } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";

import { agentState, AgentStateType } from "../states";
import { callModel, humanReviewNode, compressionNode, errorHandlingNode } from "../nodes";
import { basicTools } from "../tools/basic-tools";
import { createTodoTools } from "../tools/todo-tools";
import { createHumanLoopTools } from "../tools/human-loop-tools";
import { createTaskTool, categorizeToolsByConcurrency, isSafeConcurrencyTool } from "../tools/subagent-tools";
import { ContextCompressor } from "../tools/compression-tools";
import { AgentContext } from "../types";
import { generateId } from "../utils";

export class ClaudeCodeAgent {
  private agent: any;
  private model: ChatOpenAI;
  private compressor: ContextCompressor;
  private context: AgentContext;
  private checkpointer: MemorySaver;

  constructor(
    apiKey: string,
    modelName: string = "gpt-4-turbo-preview",
    context?: Partial<AgentContext>
  ) {
    // 初始化模型
    this.model = new ChatOpenAI({
      model: modelName,
      openAIApiKey: apiKey,
      temperature: 0.1,
      maxTokens: 4000,
    });

    // 初始化上下文
    this.context = {
      sessionId: generateId(),
      maxTokens: 128000,
      compressionThreshold: 0.92,
      permissions: [],
      ...context
    };

    // 初始化压缩器
    this.compressor = new ContextCompressor(
      this.model, 
      this.context.maxTokens, 
      this.context.compressionThreshold
    );

    // 初始化检查点保存器
    this.checkpointer = new MemorySaver();

    // 构建 Agent
    this.buildAgent();
  }

  private buildAgent() {
    // 创建所有工具
    const todoTools = createTodoTools();
    const humanLoopTools = createHumanLoopTools();
    const taskTool = createTaskTool(basicTools, this.model);
    
    const allTools = [
      ...basicTools,
      ...todoTools,
      ...humanLoopTools,
      taskTool
    ];

    // 按并发安全性分类工具
    const { safeConcurrencyTools, unsafeConcurrencyTools } = categorizeToolsByConcurrency(allTools);
    
    // 创建工具节点
    const safeConcurrencyToolNode = new ToolNode(safeConcurrencyTools, {
      name: "safeConcurrencyTools"
    });
    
    const unsafeConcurrencyToolNode = new ToolNode(unsafeConcurrencyTools, {
      name: "unsafeConcurrencyTools"
    });

    // 路由逻辑：决定下一步去哪里
    const shouldContinue = (state: AgentStateType) => {
      const { messages } = state;
      const lastMessage = messages[messages.length - 1];
      
      // 检查是否有工具调用
      if ("tool_calls" in lastMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        const toolCall = lastMessage.tool_calls[0];
        const toolName = toolCall.name;
        
        // 检查是否需要人工审查
        const needsReview = this.needsHumanReview(toolName);
        if (needsReview) {
          return "human_review";
        }
        
        // 根据工具类型路由到不同的工具节点
        if (isSafeConcurrencyTool(toolName)) {
          return "safeConcurrencyTools";
        } else {
          return "unsafeConcurrencyTools";
        }
      }
      
      return END;
    };

    // 人工审查后的路由
    const shouldContinueAfterReview = (state: AgentStateType) => {
      if (state.requiresHumanReview) {
        return "human_review";
      }
      return "llm";
    };

    // 压缩检查路由
    const shouldCompress = (state: AgentStateType) => {
      if (this.compressor.needsCompression(state.messages)) {
        return "compression";
      }
      return "llm";
    };

    // 构建状态图
    const workflow = new StateGraph(agentState)
      // 添加节点
      .addNode("llm", (state: AgentStateType) => callModel(state, { 
        configurable: { model: this.model } 
      }))
      .addNode("safeConcurrencyTools", safeConcurrencyToolNode)
      .addNode("unsafeConcurrencyTools", unsafeConcurrencyToolNode)
      .addNode("human_review", humanReviewNode)
      .addNode("compression", (state: AgentStateType) => compressionNode(state, { 
        configurable: { compressor: this.compressor } 
      }))
      .addNode("error_handling", errorHandlingNode)
      
      // 设置边
      .addEdge(START, "compression") // 首先检查是否需要压缩
      .addConditionalEdges("compression", shouldCompress, ["llm", "compression"])
      .addConditionalEdges("llm", shouldContinue, ["human_review", "safeConcurrencyTools", "unsafeConcurrencyTools", END])
      .addConditionalEdges("human_review", shouldContinueAfterReview, ["human_review", "llm"])
      .addEdge("safeConcurrencyTools", "llm")
      .addEdge("unsafeConcurrencyTools", "llm");

    // 编译图
    this.agent = workflow.compile({
      checkpointer: this.checkpointer,
    });

    console.log("✅ Claude-Code Agent 初始化完成");
  }

  // 检查工具是否需要人工审查
  private needsHumanReview(toolName: string): boolean {
    const dangerousTools = ['WriteFile', 'EditFile', 'Bash'];
    return dangerousTools.includes(toolName);
  }

  // 调用 Agent
  async invoke(
    input: string, 
    sessionId?: string,
    options?: { streamMode?: string[] }
  ): Promise<any> {
    const config = {
      configurable: { 
        thread_id: sessionId || this.context.sessionId 
      },
      streamMode: options?.streamMode || ['values'],
    };

    const inputMessage = new HumanMessage(input);
    const initialState = {
      messages: [inputMessage],
      sessionId: config.configurable.thread_id
    };

    try {
      console.log(`🚀 执行任务: ${input.substring(0, 100)}...`);
      const result = await this.agent.invoke(initialState, config);
      console.log("✅ 任务执行完成");
      return result;
    } catch (error: any) {
      console.error("❌ 任务执行失败:", error);
      throw error;
    }
  }

  // 流式调用
  async stream(
    input: string,
    sessionId?: string,
    abortSignal?: AbortSignal
  ): Promise<AsyncIterable<any>> {
    const config = {
      configurable: { 
        thread_id: sessionId || this.context.sessionId 
      },
      streamMode: ['values', 'messages', 'updates'],
      version: 'v2' as const,
      signal: abortSignal,
    };

    const inputMessage = new HumanMessage(input);
    const initialState = {
      messages: [inputMessage],
      sessionId: config.configurable.thread_id
    };

    console.log(`🌊 开始流式执行: ${input.substring(0, 100)}...`);
    return this.agent.streamEvents(initialState, config);
  }

  // 继续中断的对话
  async resume(sessionId?: string): Promise<any> {
    const config = {
      configurable: { 
        thread_id: sessionId || this.context.sessionId 
      }
    };

    console.log("🔄 恢复中断的对话...");
    return this.agent.invoke(null, config);
  }

  // 获取当前状态
  async getState(sessionId?: string): Promise<any> {
    const config = {
      configurable: { 
        thread_id: sessionId || this.context.sessionId 
      }
    };

    return this.agent.getState(config);
  }

  // 获取状态历史
  async getStateHistory(sessionId?: string): Promise<any[]> {
    const config = {
      configurable: { 
        thread_id: sessionId || this.context.sessionId 
      }
    };

    const history = [];
    for await (const state of this.agent.getStateHistory(config)) {
      history.push(state);
    }
    return history;
  }

  // 清理会话
  async clearSession(sessionId?: string): Promise<void> {
    // 目前 MemorySaver 没有直接的清理方法
    // 可以通过重新创建 checkpointer 来实现
    console.log(`🗑️ 清理会话: ${sessionId || this.context.sessionId}`);
  }
}
