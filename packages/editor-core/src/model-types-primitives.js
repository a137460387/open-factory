/**
 * 模型原始类型定义（零外部依赖）
 *
 * 本文件仅包含自包含的基础类型，不导入任何 feature 模块。
 * 所有需要在 model-types.ts 和 feature 模块之间共享的叶子类型都应定义在此处，
 * 以切断循环依赖链。
 *
 * 规则：
 * - 本文件不得 import 任何 ./ 开头的本地模块
 * - 只放纯数据接口/类型别名，不放业务逻辑
 */
export {};
//# sourceMappingURL=model-types-primitives.js.map