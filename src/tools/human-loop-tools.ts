import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolMessage } from "@langchain/core/messages";
import { Command, interrupt } from "@langchain/langgraph";

// 获取当前任务输入的辅助函数
declare function getCurrentTaskInput(): any;

// 人工协同工具
export function createHumanLoopTool() {
  const executor = (args: { question: string; context?: string }, config: any) => {
    const { question, context } = args;
    
    // 构造询问用户的消息
    const userQuestion = context ? 
      `${context}\n\n${question}` : 
      question;
    
    // 使用 interrupt 中断执行，等待用户输入
    const humanAnswer = interrupt(userQuestion);
    
    const msgs = [
      new ToolMessage({
        content: `Successfully asked human: ${question}\nHuman response: ${humanAnswer}`,
        name: 'askHuman',
        tool_call_id: config.toolCall.id,
      }),
    ];
    
    const state = getCurrentTaskInput();
    return new Command({
      goto: 'human_review',
      graph: Command.PARENT,
      update: {
        messages: state.messages.concat(msgs),
        requiresHumanReview: true,
      },
    });
  };

  return tool(executor, {
    name: 'askHuman',
    description: '当需要向用户确认需求、询问补充信息、向用户提问时，务必调用此工具。这个工具会中断当前执行流程，等待用户的输入和确认。',
    schema: z.object({
      question: z.string().describe('要向用户询问的问题'),
      context: z.string().optional().describe('可选的上下文信息，帮助用户理解问题'),
    }),
  });
}

// 工具权限检查工具
export function createToolPermissionTool() {
  const executor = (args: { toolName: string; operation: string }, config: any) => {
    const { toolName, operation } = args;
    
    // 构造权限确认消息
    const permissionQuestion = `请确认是否允许执行以下操作：
工具: ${toolName}
操作: ${operation}

请回复 "同意" 或 "拒绝"`;
    
    // 中断等待用户确认
    const userResponse = interrupt(permissionQuestion);
    
    const isApproved = userResponse?.toLowerCase().includes('同意') || 
                      userResponse?.toLowerCase().includes('yes') ||
                      userResponse?.toLowerCase().includes('approve');
    
    const msgs = [
      new ToolMessage({
        content: `Tool permission request: ${toolName} - ${operation}\nUser response: ${userResponse}\nApproved: ${isApproved}`,
        name: 'checkToolPermission',
        tool_call_id: config.toolCall.id,
      }),
    ];
    
    const state = getCurrentTaskInput();
    
    if (isApproved) {
      return new Command({
        goto: 'tools',
        update: {
          messages: state.messages.concat(msgs),
          requiresHumanReview: false,
        },
      });
    } else {
      return new Command({
        goto: 'llm',
        update: {
          messages: state.messages.concat(msgs),
          requiresHumanReview: false,
        },
      });
    }
  };

  return tool(executor, {
    name: 'checkToolPermission',
    description: '检查工具执行权限，需要用户确认的危险操作前调用此工具',
    schema: z.object({
      toolName: z.string().describe('需要权限确认的工具名称'),
      operation: z.string().describe('具体的操作描述'),
    }),
  });
}

// 导出人工协同工具
export function createHumanLoopTools() {
  return [
    createHumanLoopTool(),
    createToolPermissionTool()
  ];
}
