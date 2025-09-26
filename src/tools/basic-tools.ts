import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 文件读取工具
export const readFileTool = new DynamicStructuredTool({
  name: "ReadFile",
  description: "读取指定文件的内容",
  schema: z.object({
    filePath: z.string().describe("要读取的文件路径"),
  }),
  func: async (input: { filePath: string }) => {
    try {
      const content = await fs.readFile(input.filePath, 'utf-8');
      return `文件内容 (${input.filePath}):\n${content}`;
    } catch (error: any) {
      return `读取文件失败: ${error.message}`;
    }
  }
});

// 文件写入工具
export const writeFileTool = new DynamicStructuredTool({
  name: "WriteFile",
  description: "将内容写入指定文件",
  schema: z.object({
    filePath: z.string().describe("要写入的文件路径"),
    content: z.string().describe("要写入的文件内容"),
  }),
  func: async (input: { filePath: string; content: string }) => {
    try {
      // 确保目录存在
      await fs.mkdir(path.dirname(input.filePath), { recursive: true });
      await fs.writeFile(input.filePath, input.content, 'utf-8');
      return `文件写入成功: ${input.filePath}`;
    } catch (error: any) {
      return `文件写入失败: ${error.message}`;
    }
  }
});

// 文件编辑工具
export const editFileTool = tool(
  async (input: { filePath: string; searchText: string; replaceText: string }) => {
    try {
      const content = await fs.readFile(input.filePath, 'utf-8');
      const newContent = content.replace(input.searchText, input.replaceText);
      await fs.writeFile(input.filePath, newContent, 'utf-8');
      return `文件编辑成功: ${input.filePath}`;
    } catch (error: any) {
      return `文件编辑失败: ${error.message}`;
    }
  },
  {
    name: "EditFile",
    description: "编辑文件，将指定文本替换为新文本",
    schema: z.object({
      filePath: z.string().describe("要编辑的文件路径"),
      searchText: z.string().describe("要搜索的文本"),
      replaceText: z.string().describe("要替换的新文本"),
    }),
  }
);

// 文件搜索工具 (类似 grep)
export const grepTool = tool(
  async (input: { pattern: string; filePath?: string }) => {
    try {
      const grepCommand = input.filePath ? 
        `grep -n "${input.pattern}" "${input.filePath}"` : 
        `grep -r -n "${input.pattern}" .`;
      
      const { stdout } = await execAsync(grepCommand);
      return stdout || `未找到匹配的内容: ${input.pattern}`;
    } catch (error: any) {
      return `搜索失败: ${error.message}`;
    }
  },
  {
    name: "Grep",
    description: "在文件中搜索匹配的文本模式",
    schema: z.object({
      pattern: z.string().describe("要搜索的文本模式"),
      filePath: z.string().optional().describe("可选：指定搜索的文件路径"),
    }),
  }
);

// 目录列表工具
export const listDirTool = tool(
  async (input: { dirPath?: string }) => {
    try {
      const targetPath = input.dirPath || '.';
      const files = await fs.readdir(targetPath, { withFileTypes: true });
      const result = files.map((file: any) => {
        const type = file.isDirectory() ? '[DIR]' : '[FILE]';
        return `${type} ${file.name}`;
      }).join('\n');
      return `目录内容 (${targetPath}):\n${result}`;
    } catch (error: any) {
      return `列出目录失败: ${error.message}`;
    }
  },
  {
    name: "ListDir",
    description: "列出指定目录的内容",
    schema: z.object({
      dirPath: z.string().optional().describe("可选：目录路径，默认为当前目录"),
    }),
  }
);

// Bash 命令执行工具
export const bashTool = tool(
  async (input: { command: string }) => {
    try {
      const { stdout, stderr } = await execAsync(input.command, { timeout: 30000 });
      return stdout || stderr || "命令执行完成";
    } catch (error: any) {
      return `命令执行失败: ${error.message}`;
    }
  },
  {
    name: "Bash",
    description: "执行 bash 命令（请谨慎使用，仅用于安全操作）",
    schema: z.object({
      command: z.string().describe("要执行的 bash 命令"),
    }),
  }
);

// 导出所有基础工具
export const basicTools = [
  readFileTool,
  writeFileTool,
  editFileTool,
  grepTool,
  listDirTool,
  bashTool,
];
