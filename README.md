# Claude-Code Agent 使用说明

## 🚀 快速开始

### 1. 环境配置

首先需要配置 OpenAI API Key：

#### 方法1：使用环境变量
```bash
export OPENAI_API_KEY="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"
```

#### 方法2：创建 .env 文件
```bash
# 在项目根目录创建 .env 文件
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
```

### 2. 安装依赖

确保已经安装了 Node.js，然后安装项目依赖：

```bash
npm install
```

## 📖 演示脚本

我们提供了两个演示脚本，展示不同层次的功能：

### 基础演示 (demo.js)

展示基本的 ReAct Agent 功能：

```bash
# 运行基础演示
node demo.js

# 交互模式
node demo.js interactive
```

**功能特点：**
- 基础对话功能
- 文件读写操作
- 简单任务规划

### 高级演示 (advanced-demo.js)

展示完整的 Claude-Code 核心功能：

```bash
# 运行高级演示  
node advanced-demo.js

# 交互模式
node advanced-demo.js interactive
```

**功能特点：**
- 智能任务管理 (Todo系统)
- SubAgent 专家协作
- 状态持久化
- 复杂工作流

## 🎯 演示场景

### 场景1：项目初始化

```javascript
// 交互模式下输入：
"我需要创建一个新的 Node.js 项目，包含基本的目录结构、package.json 和 README 文件"
```

Agent 会：
1. 创建详细的任务列表
2. 逐步执行每个任务
3. 更新任务状态
4. 生成项目文件

### 场景2：代码分析

```javascript
// 交互模式下输入：
"请分析项目的代码架构，并生成技术文档"
```

Agent 会：
1. 调用代码分析专家 SubAgent
2. 调用文档编写专家 SubAgent  
3. 合成分析结果
4. 生成完整文档

### 场景3：任务跟踪

```javascript
// 在交互模式下任意时候输入：
"status"
```

会显示：
- 当前消息数量
- 任务列表状态
- 执行进度

## 🔧 核心功能详解

### 1. 任务管理系统

使用内置的 Todo 工具：

- **TodoRead**: 查看当前任务列表
- **TodoWrite**: 创建/更新任务状态

任务状态：
- `pending`: 待执行
- `in_progress`: 执行中
- `completed`: 已完成
- `failed`: 失败

### 2. SubAgent 专家系统

可用的专家类型：

- **general-purpose**: 通用任务处理
- **code-analyzer**: 代码分析专家
- **document-writer**: 文档编写专家

### 3. 文件操作

支持的文件操作：
- 读取文件内容
- 写入文件内容
- 创建目录结构

## 📋 交互命令

在交互模式下可用的特殊命令：

- `quit`: 退出程序
- `status`: 查看当前状态
- `help`: 显示帮助信息

## 🎨 自定义扩展

### 添加新工具

```javascript
const customTool = tool(
  async ({ param1, param2 }) => {
    // 工具实现逻辑
    return "工具执行结果";
  },
  {
    name: "CustomTool",
    description: "自定义工具描述",
    schema: z.object({
      param1: z.string().describe("参数1描述"),
      param2: z.number().describe("参数2描述"),
    }),
  }
);

// 添加到工具列表
const tools = [...existingTools, customTool];
```

### 添加新的 SubAgent 类型

```javascript
// 在 SubAgent 工具中添加新类型
case 'my-expert':
  result = `专家分析结果...`;
  break;
```

## 🐛 故障排除

### 常见问题

1. **API Key 错误**
   ```
   Error: OpenAI API key not found
   ```
   解决：确保正确设置了 `OPENAI_API_KEY` 环境变量

2. **依赖包问题**
   ```
   Cannot find module '@langchain/openai'
   ```
   解决：运行 `npm install` 安装依赖

3. **网络连接问题**
   ```
   Error: connect ECONNREFUSED
   ```
   解决：检查网络连接和 API 访问权限

### 调试模式

可以通过设置环境变量启用详细日志：

```bash
DEBUG=true node advanced-demo.js
```

## 📚 进阶使用

### 1. 自定义提示词

修改系统提示词来改变 Agent 行为：

```javascript
const systemPrompt = `你是一个专门的${domain}助手...`;
```

### 2. 状态管理

扩展状态定义：

```javascript
const ExtendedAgentState = Annotation.Root({
  messages: Annotation({...}),
  todoList: Annotation({...}),
  customField: Annotation({...}), // 新增字段
});
```

### 3. 工具权限控制

实现工具执行权限检查：

```javascript
const checkPermission = (toolName) => {
  const dangerousTools = ['WriteFile', 'DeleteFile'];
  return !dangerousTools.includes(toolName);
};
```

## 🔬 实验性功能

以下功能仍在开发中：

- **上下文压缩**: 自动压缩长对话历史
- **并发执行**: 多个 SubAgent 并行工作
- **持久化存储**: 跨会话状态保存

## 📞 获取帮助

如有问题或建议：

1. 查看项目 README.md
2. 检查代码注释
3. 在 GitHub 创建 Issue

---

**注意**: 这是一个学习和演示项目。在生产环境使用前请进行充分测试。
