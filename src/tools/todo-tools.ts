import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { TodoItem, TaskStatus, TaskPriority } from "../types";

// 获取当前任务输入（这是一个辅助函数，需要在运行时提供）
declare function getCurrentTaskInput(): any;

// Todo 工具名称映射
export const TASK_TOOL_NAME_MAP = {
  taskRead: 'TodoRead',
  taskWrite: 'TodoWrite'
};

// TodoWrite 工具的提示词
const TODO_WRITE_PROMPT = `更新当前会话的任务列表。主动使用此工具来跟踪进度和管理任务执行。

## 何时使用此工具
在以下场景中主动使用此工具：

1. **开始任务时** - 将任务标记为in_progress（可单个或批量，但每批最多5个）
2. **完成任务后** - 将任务标记为completed（可单个或批量完成）  
3. **任务失败时** - 将任务标记为failed并包含错误详情
4. **需要更新任务进度或添加详情时**

## 任务状态和管理

1. **任务状态**：使用这些状态来跟踪进度：
   - pending: 任务尚未开始
   - in_progress: 当前正在执行（同一时间最多5个任务）
   - completed: 任务成功完成
   - failed: 任务遇到错误

2. **任务管理规则**：
   - 实时更新任务状态
   - 支持批量执行：可以将多个相似简单任务同时标记为in_progress或completed
   - 批量限制：同一时间最多5个任务处于in_progress状态
   - 顺序执行：必须按任务列表顺序处理，不能跳跃
   - 任务失败时，将其标记为failed并包含错误详情

3. **任务完成要求**：
   - 只有在完全完成任务时才标记为completed
   - 如果遇到错误，将任务标记为failed并包含错误详情
   - 在以下情况下绝不要将任务标记为completed：
     - 实现不完整
     - 遇到未解决的错误  
     - 找不到必要的文件或依赖项

如有疑问，请使用此工具。主动进行任务管理可以展现专业性并确保您完成所有要求。`;

// TodoRead 工具
export function createTaskReadTool() {
  const executor = (args: {}, config: any) => {
    const state = getCurrentTaskInput() as any;
    const currentTasks = state.todoList || [];

    const content = `请继续使用任务列表更新和读取功能来跟踪您的进度。当前任务列表: ${JSON.stringify(currentTasks, null, 2)}`;

    return new ToolMessage({
      content,
      name: TASK_TOOL_NAME_MAP.taskRead,
      tool_call_id: config.toolCall.id,
    });
  };

  return tool(executor, {
    name: TASK_TOOL_NAME_MAP.taskRead,
    description: '读取当前会话的任务列表。主动且频繁地使用此工具，以确保您了解当前任务列表的状态。您应该尽可能多地使用此工具，特别是在开始工作、完成任务后或不确定下一步做什么时。',
    schema: z.object({}),
  });
}

// TodoWrite 工具  
export function createTaskWriteTool() {
  const executor = (args: { todoList: TodoItem[] }, config: any) => {
    const state = getCurrentTaskInput() as any;
    const { todoList } = args;
    
    // 生成时间戳
    const now = new Date().toISOString();
    
    // 处理任务时间戳
    const processedTodoList = todoList.map(task => {
      const existingTask = (state.todoList || []).find((t: TodoItem) => t.id === task.id);
      
      // 如果状态从 pending 变为 in_progress，设置开始时间
      if (existingTask?.status !== TaskStatus.IN_PROGRESS && task.status === TaskStatus.IN_PROGRESS) {
        task.startTime = now;
      }
      
      // 如果状态变为 completed 或 failed，设置结束时间
      if ((task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) && !task.endTime) {
        task.endTime = now;
      }
      
      return task;
    });
    
    const responseMsgs = [
      new ToolMessage({
        content: `任务列表已更新。当前有 ${todoList.length} 个任务。`,
        name: TASK_TOOL_NAME_MAP.taskWrite,
        tool_call_id: config.toolCall.id,
      })
    ];

    return new Command({
      update: {
        todoList: processedTodoList,
        messages: state.messages.concat(responseMsgs),
      },
    });
  };

  return tool(executor, {
    name: TASK_TOOL_NAME_MAP.taskWrite,
    description: TODO_WRITE_PROMPT,
    schema: z.object({
      todoList: z
        .array(
          z.object({
            id: z.string().describe('任务唯一标识'),
            name: z.string().describe('任务名称'),
            desc: z.string().describe('任务具体描述'),
            status: z
              .nativeEnum(TaskStatus)
              .describe('任务状态：pending(待执行)、in_progress(执行中)、completed(已完成)、failed(失败)'),
            priority: z.nativeEnum(TaskPriority).nullable().optional().describe('任务优先级'),
            startTime: z.string().nullable().optional().describe('任务开始时间'),
            endTime: z.string().nullable().optional().describe('任务结束时间'),
            error: z.string().nullable().optional().describe('失败原因(当状态为failed时必填)'),
          }),
        )
        .describe('更新后的完整任务列表'),
    }),
  });
}

// 导出 Todo 工具创建函数
export function createTodoTools() {
  return [
    createTaskReadTool(),
    createTaskWriteTool()
  ];
}
