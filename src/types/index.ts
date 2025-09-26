// 任务状态枚举
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress', 
  COMPLETED = 'completed',
  FAILED = 'failed',
  BLOCKED = 'blocked'
}

// 任务优先级
export enum TaskPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// Todo 任务项接口
export interface TodoItem {
  id: string;
  name: string;
  desc: string;
  status: TaskStatus;
  priority?: TaskPriority;
  startTime?: string;
  endTime?: string;
  error?: string;
}

// SubAgent 配置接口
export interface SubAgentConfig {
  type: string;
  systemPrompt: string;
  allowedTools: string[] | null;
  maxConcurrency?: number;
}

// 压缩记录接口
export interface CompressionRecord {
  timestamp: string;
  beforeTokens: number;
  afterTokens: number;
  compressionRatio: number;
  summary: string;
}

// Token 使用情况接口
export interface TokenUsage {
  used: number;
  total: number;
  percentage: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
}

// 人工审查选项
export enum ReviewAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  MODIFY = 'modify'
}

// 工具调用权限类型
export interface ToolPermission {
  toolName: string;
  requiresApproval: boolean;
  isBlocked: boolean;
}

// Agent 执行上下文
export interface AgentContext {
  sessionId: string;
  userId?: string;
  permissions: ToolPermission[];
  maxTokens: number;
  compressionThreshold: number;
}
