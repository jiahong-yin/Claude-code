import { BaseMessage, AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { TokenUsage, CompressionRecord } from "../types";

// 8段式压缩提示词
const COMPRESSION_PROMPT = `Your task is to create a detailed summary of the conversation so far, 
paying close attention to the user's explicit requests and your previous actions.
This summary should be thorough in capturing technical details, code patterns, 
and architectural decisions that would be essential for continuing development 
work without losing context.

Before providing your final summary, wrap your analysis in <analysis> tags to 
organize your thoughts and ensure you've covered all necessary points.

Your summary should include the following sections:

1. **Primary Request and Intent**: Capture all of the user's explicit requests and intents in detail
2. **Key Technical Concepts**: List all important technical concepts, technologies, and frameworks discussed.
3. **Files and Code Sections**: Enumerate specific files and code sections examined, modified, or created. Pay special attention to the most recent messages and include full code snippets where applicable.
4. **Errors and fixes**: List all errors that you ran into, and how you fixed them. Pay special attention to specific user feedback.
5. **Problem Solving**: Document problems solved and any ongoing troubleshooting efforts.
6. **All user messages**: List ALL user messages that are not tool results. These are critical for understanding the users' feedback and changing intent.
7. **Pending Tasks**: Outline any pending tasks that you have explicitly been asked to work on.
8. **Current Work**: Describe in detail precisely what was being worked on immediately before this summary request.
9. **Optional Next Step**: List the next step that you will take that is related to the most recent work you were doing.`;

// Token 使用统计类
export class TokenCounter {
  private maxTokens: number;
  private compressionThreshold: number;

  constructor(maxTokens: number = 128000, compressionThreshold: number = 0.92) {
    this.maxTokens = maxTokens;
    this.compressionThreshold = compressionThreshold;
  }

  // 获取最新的 Token 使用情况（倒序查找）
  getLatestTokenUsage(messages: BaseMessage[]): TokenUsage {
    console.log('🔍 检查记忆使用情况...');
    
    let totalTokens = 0;
    // 聪明的地方：从最新消息开始找，因为 usage 信息通常在最近的消息里
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message instanceof AIMessage && message.response_metadata?.usage) {
        const usage = message.response_metadata.usage;
        totalTokens = this.calculateTotalTokens(usage);
        break; // 找到就停止，不浪费时间
      }
    }

    // 如果没有找到 usage 信息，估算 token 数量
    if (totalTokens === 0) {
      totalTokens = this.estimateTokens(messages);
    }

    return {
      used: totalTokens,
      total: this.maxTokens,
      percentage: totalTokens / this.maxTokens,
    };
  }

  // 计算总 Token 数（包含缓存）
  private calculateTotalTokens(usage: any): number {
    return (usage.total_tokens || 0) + (usage.cache_creation_tokens || 0);
  }

  // 估算 Token 数量（回退方案）
  private estimateTokens(messages: BaseMessage[]): number {
    const totalContent = messages.map(m => m.content.toString()).join(' ');
    // 简单的估算：1个token约等于4个字符
    return Math.ceil(totalContent.length / 4);
  }

  // 检查是否需要压缩
  needsCompression(messages: BaseMessage[]): boolean {
    const usage = this.getLatestTokenUsage(messages);
    return usage.percentage >= this.compressionThreshold;
  }
}

// 上下文压缩器类
export class ContextCompressor {
  private model: ChatOpenAI;
  private tokenCounter: TokenCounter;

  constructor(model: ChatOpenAI, maxTokens?: number, compressionThreshold?: number) {
    this.model = model;
    this.tokenCounter = new TokenCounter(maxTokens, compressionThreshold);
  }

  // 执行8段式压缩
  async compress(messages: BaseMessage[]): Promise<{
    compressedMessage: AIMessage;
    compressionRecord: CompressionRecord;
    removedMessages: BaseMessage[];
  }> {
    const beforeUsage = this.tokenCounter.getLatestTokenUsage(messages);
    
    console.log(`🗜️ 开始压缩，当前使用: ${beforeUsage.used} tokens (${(beforeUsage.percentage * 100).toFixed(1)}%)`);

    // 生成压缩消息的内容
    const messagesContent = this.formatMessagesForCompression(messages);
    const compressionInput = `${COMPRESSION_PROMPT}\n\nConversation to summarize:\n${messagesContent}`;

    // 调用模型进行压缩
    const compressedSummary = await this.model.invoke([
      new HumanMessage(compressionInput)
    ]);

    // 创建压缩后的消息
    const compressedMessage = new AIMessage(
      `[COMPRESSED SUMMARY]\n\n${compressedSummary.content}`
    );

    // 计算压缩效果
    const afterTokens = this.tokenCounter.estimateTokens([compressedMessage]);
    const compressionRatio = afterTokens / beforeUsage.used;

    const compressionRecord: CompressionRecord = {
      timestamp: new Date().toISOString(),
      beforeTokens: beforeUsage.used,
      afterTokens,
      compressionRatio,
      summary: compressedSummary.content.toString().substring(0, 200) + '...'
    };

    console.log(`✅ 压缩完成: ${beforeUsage.used} -> ${afterTokens} tokens (${(compressionRatio * 100).toFixed(1)}%)`);

    // 决定移除哪些消息（保留最近的一些消息）
    const recentMessagesToKeep = 5;
    const removedMessages = messages.slice(0, -recentMessagesToKeep);

    return {
      compressedMessage,
      compressionRecord,
      removedMessages
    };
  }

  // 格式化消息用于压缩
  private formatMessagesForCompression(messages: BaseMessage[]): string {
    return messages.map((msg, index) => {
      const role = msg instanceof HumanMessage ? 'Human' : 
                   msg instanceof AIMessage ? 'Assistant' : 
                   'System';
      const content = msg.content.toString().substring(0, 1000); // 限制长度
      return `[${index + 1}] ${role}: ${content}`;
    }).join('\n\n');
  }

  // 检查是否需要压缩
  needsCompression(messages: BaseMessage[]): boolean {
    return this.tokenCounter.needsCompression(messages);
  }

  // 获取当前使用情况
  getCurrentUsage(messages: BaseMessage[]): TokenUsage {
    return this.tokenCounter.getLatestTokenUsage(messages);
  }
}
