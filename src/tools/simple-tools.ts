// 简化的工具集合，避免复杂的类型推导问题
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

// 文件读取工具
export const readFileTool = new DynamicStructuredTool({
  name: "ReadFile",
  description: "读取指定文件的内容",
  schema: z.object({
    filePath: z.string().describe("要读取的文件路径"),
  }),
  func: async ({ filePath }: { filePath: string }) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return `文件内容 (${filePath}):\n${content}`;
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
  func: async ({ filePath, content }: { filePath: string; content: string }) => {
    try {
      // 确保目录存在
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return `文件写入成功: ${filePath}`;
    } catch (error: any) {
      return `文件写入失败: ${error.message}`;
    }
  }
});

// 目录列表工具
export const listDirTool = new DynamicStructuredTool({
  name: "ListDir",
  description: "列出指定目录的内容",
  schema: z.object({
    dirPath: z.string().nullable().default(".").describe("目录路径，默认为当前目录"),
  }),
  func: async ({ dirPath }: { dirPath?: string }) => {
    try {
      const targetPath = dirPath || '.';
      const files = await fs.readdir(targetPath, { withFileTypes: true });
      const result = files.map((file: any) => {
        const type = file.isDirectory() ? '[DIR]' : '[FILE]';
        return `${type} ${file.name}`;
      }).join('\n');
      return `目录内容 (${targetPath}):\n${result}`;
    } catch (error: any) {
      return `列出目录失败: ${error.message}`;
    }
  }
});

// 导出简化工具集
export const simpleTools = [
  readFileTool,
  writeFileTool,
  listDirTool,
];
