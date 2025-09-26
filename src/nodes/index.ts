import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { interrupt, Command } from "@langchain/langgraph";
import { AgentStateType } from "../states";
import { ContextCompressor } from "../tools/compression-tools";
import { ReviewAction } from "../types";

// 模型调用节点
export async function callModel(
  state: AgentStateType,
  config: { configurable: { model: ChatOpenAI } }
): Promise<Partial<AgentStateType>> {
  const { model } = config.configurable;
  const { messages } = state;
  
  try {
    console.log(`🤖 调用模型，消息数量: ${messages.length}`);
    const response = await model.invoke(messages);
    return { 
      messages: [response],
      currentStatus: 'model_called'
    };
  } catch (error: any) {
    console.error('❌ 模型调用失败:', error);
    const errorMessage = new AIMessage(`模型调用失败: ${error.message}`);
    return { 
      messages: [errorMessage],
      currentStatus: 'error'
    };
  }
}

// 人工审查节点
export async function humanReviewNode(
  state: AgentStateType
): Promise<Partial<AgentStateType> | Command> {
  const lastMessage = state.messages[state.messages.length - 1];
  
  // 检查最后一条消息是否包含工具调用
  if ('tool_calls' in lastMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    const toolCall = lastMessage.tool_calls[0];
    const toolName = toolCall.name;
    
    // 构造审查问题
    const reviewQuestion = `请确认是否执行以下操作：
工具: ${toolName}
参数: ${JSON.stringify(toolCall.args, null, 2)}

请回复:
- "同意" 或 "approve" - 执行操作
- "拒绝" 或 "reject" - 拒绝操作  
- "修改" 或 "modify" - 需要修改`;

    // 中断执行，等待用户输入
    const humanAnswer = interrupt(reviewQuestion);
    
    // 处理用户响应
    const response = humanAnswer?.toLowerCase() || '';
    
    if (response.includes('同意') || response.includes('approve')) {
      return new Command({
        goto: 'tools',
        update: {
          messages: [new HumanMessage("用户确认执行")],
          requiresHumanReview: false
        }
      });
    } else if (response.includes('拒绝') || response.includes('reject')) {
      return new Command({
        goto: 'llm',
        update: {
          messages: [new HumanMessage(`用户拒绝执行 ${toolName} 操作，请选择其他方案`)],
          requiresHumanReview: false
        }
      });
    } else {
      return new Command({
        goto: 'llm', 
        update: {
          messages: [new HumanMessage(`用户要求修改 ${toolName} 操作: ${humanAnswer}`)],
          requiresHumanReview: false
        }
      });
    }
  }
  
  // 如果没有工具调用，继续执行
  return { requiresHumanReview: false };
}

// 上下文压缩节点
export async function compressionNode(
  state: AgentStateType,
  config: { configurable: { compressor: ContextCompressor } }
): Promise<Partial<AgentStateType>> {
  const { compressor } = config.configurable;
  const { messages } = state;
  
  console.log('🔍 检查是否需要压缩...');
  
  // 检查是否需要压缩
  if (!compressor.needsCompression(messages)) {
    console.log('✅ 无需压缩，继续执行');
    return {}; // 无需更新状态
  }
  
  try {
    console.log('🗜️ 开始执行上下文压缩...');
    
    // 执行压缩
    const compressionResult = await compressor.compress(messages);
    
    // 保留最近的一些消息 + 压缩摘要
    const recentMessages = messages.slice(-5); // 保留最近5条消息
    const newMessages = [
      compressionResult.compressedMessage,
      ...recentMessages
    ];
    
    console.log(`✅ 压缩完成: ${messages.length} -> ${newMessages.length} 条消息`);
    
    return {
      messages: newMessages,
      compressionHistory: [compressionResult.compressionRecord],
      currentStatus: 'compressed'
    };
    
  } catch (error: any) {
    console.error('❌ 压缩失败:', error);
    return {
      currentStatus: 'compression_failed'
    };
  }
}

// 错误处理节点
export async function errorHandlingNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const lastMessage = state.messages[state.messages.length - 1];
  
  console.log('❌ 进入错误处理节点');
  
  const errorMessage = new AIMessage(
    `遇到错误，正在尝试恢复。最后的状态: ${state.currentStatus}\n` +
    `如果问题持续，请检查配置或联系管理员。`
  );
  
  return {
    messages: [errorMessage],
    currentStatus: 'error_handled'
  };
}

// 状态重置节点
export async function resetStateNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  console.log('🔄 重置状态...');
  
  return {
    currentStatus: 'reset',
    requiresHumanReview: false
  };
}

// 日志记录节点
export async function loggingNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const { messages, todoList, currentStatus } = state;
  
  console.log('📊 当前状态统计:');
  console.log(`  - 消息数量: ${messages.length}`);
  console.log(`  - 任务数量: ${todoList.length}`);
  console.log(`  - 当前状态: ${currentStatus}`);
  
  if (todoList.length > 0) {
    const completedTasks = todoList.filter(t => t.status === 'completed').length;
    const inProgressTasks = todoList.filter(t => t.status === 'in_progress').length;
    console.log(`  - 已完成任务: ${completedTasks}`);
    console.log(`  - 进行中任务: ${inProgressTasks}`);
  }
  
  return {}; // 不更新状态，仅记录日志
}
