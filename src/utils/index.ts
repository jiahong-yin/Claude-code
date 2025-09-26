import { v4 as uuidv4 } from 'uuid';
import { BaseMessage, AIMessage } from "@langchain/core/messages";
import { TodoItem, TaskStatus } from "../types";

// 生成唯一 ID
export function generateId(): string {
  return uuidv4();
}

// 生成时间戳
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// 检查消息是否为 AI 消息
export function isAIMessage(message: BaseMessage): message is AIMessage {
  return message instanceof AIMessage;
}

// 安全的 JSON 解析
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
}

// 创建 Todo 任务的辅助函数
export function createTodoItem(
  name: string, 
  desc: string, 
  status: TaskStatus = TaskStatus.PENDING
): TodoItem {
  return {
    id: generateId(),
    name,
    desc,
    status,
    startTime: status === TaskStatus.IN_PROGRESS ? getCurrentTimestamp() : undefined,
  };
}

// 更新 Todo 任务状态
export function updateTodoStatus(todo: TodoItem, newStatus: TaskStatus): TodoItem {
  const now = getCurrentTimestamp();
  const updatedTodo = { ...todo, status: newStatus };

  // 设置开始时间
  if (newStatus === TaskStatus.IN_PROGRESS && !todo.startTime) {
    updatedTodo.startTime = now;
  }

  // 设置结束时间
  if ((newStatus === TaskStatus.COMPLETED || newStatus === TaskStatus.FAILED) && !todo.endTime) {
    updatedTodo.endTime = now;
  }

  return updatedTodo;
}

// 格式化 Todo 列表为可读字符串
export function formatTodoList(todos: TodoItem[]): string {
  if (!todos || todos.length === 0) {
    return "没有任务";
  }

  return todos.map((todo, index) => {
    const statusIcon = getStatusIcon(todo.status);
    const timeInfo = getTaskTimeInfo(todo);
    return `${index + 1}. ${statusIcon} ${todo.name}\n   ${todo.desc}${timeInfo}`;
  }).join('\n\n');
}

// 获取状态图标
function getStatusIcon(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.PENDING:
      return '⏳';
    case TaskStatus.IN_PROGRESS:
      return '🔄';
    case TaskStatus.COMPLETED:
      return '✅';
    case TaskStatus.FAILED:
      return '❌';
    case TaskStatus.BLOCKED:
      return '🚫';
    default:
      return '📝';
  }
}

// 获取任务时间信息
function getTaskTimeInfo(todo: TodoItem): string {
  let timeInfo = '';
  if (todo.startTime) {
    timeInfo += `\n   开始时间: ${new Date(todo.startTime).toLocaleString()}`;
  }
  if (todo.endTime) {
    timeInfo += `\n   结束时间: ${new Date(todo.endTime).toLocaleString()}`;
  }
  if (todo.error) {
    timeInfo += `\n   错误: ${todo.error}`;
  }
  return timeInfo;
}

// 计算任务统计
export function calculateTodoStats(todos: TodoItem[]) {
  const stats = {
    total: todos.length,
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
    blocked: 0,
  };

  todos.forEach(todo => {
    switch (todo.status) {
      case TaskStatus.PENDING:
        stats.pending++;
        break;
      case TaskStatus.IN_PROGRESS:
        stats.inProgress++;
        break;
      case TaskStatus.COMPLETED:
        stats.completed++;
        break;
      case TaskStatus.FAILED:
        stats.failed++;
        break;
      case TaskStatus.BLOCKED:
        stats.blocked++;
        break;
    }
  });

  return stats;
}

// 延迟函数
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 重试函数
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await delay(delayMs);
        console.log(`重试第 ${attempt} 次失败，等待 ${delayMs}ms 后继续...`);
      }
    }
  }
  
  throw lastError;
}
