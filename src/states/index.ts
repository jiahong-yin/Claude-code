import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { TodoItem, CompressionRecord } from "../types";

// 消息状态 reducer - 安全的消息合并
export const safeMessagesStateReducer = (x: BaseMessage[], y: BaseMessage[]): BaseMessage[] => {
  if (!x || !Array.isArray(x)) x = [];
  if (!y || !Array.isArray(y)) y = [];
  return [...x, ...y];
};

// Todo 列表 reducer
export const todoListReducer = (x: TodoItem[], y: TodoItem[]): TodoItem[] => {
  if (!y || y.length === 0) return x || [];
  return y; // 直接替换为新的 todo 列表
};

// 压缩历史 reducer
export const compressionHistoryReducer = (x: CompressionRecord[], y: CompressionRecord[]): CompressionRecord[] => {
  return [...(x || []), ...(y || [])];
};

// 主要的 Agent 状态定义
export const agentState = Annotation.Root({
  // 消息历史
  messages: Annotation<BaseMessage[]>({
    reducer: safeMessagesStateReducer,
    default: () => [],
  }),
  
  // Todo 任务列表
  todoList: Annotation<TodoItem[]>({
    reducer: todoListReducer,
    default: () => [],
  }),
  
  // 压缩历史记录
  compressionHistory: Annotation<CompressionRecord[]>({
    reducer: compressionHistoryReducer,
    default: () => [],
  }),
  
  // 会话 ID
  sessionId: Annotation<string>({
    reducer: (x, y) => y || x,
    default: () => '',
  }),
  
  // 当前执行状态
  currentStatus: Annotation<string>({
    reducer: (x, y) => y || x,
    default: () => 'idle',
  }),
  
  // 是否需要人工审查
  requiresHumanReview: Annotation<boolean>({
    reducer: (x, y) => y !== undefined ? y : x,
    default: () => false,
  }),
});

// 导出状态类型
export type AgentStateType = typeof agentState.State;
