/**
 * 统一错误处理工具函数
 * 用于替换空catch块和.catch(() => undefined)，确保错误被记录
 */

/**
 * 带日志的catch处理器，用于替换.catch(() => undefined)
 * @param context 错误上下文描述
 * @returns 错误处理函数
 */
export function logError(context: string): (error: unknown) => undefined {
  return (error: unknown) => {
    console.error(`[${context}]`, error);
    return undefined;
  };
}

/**
 * 带日志的catch处理器，返回指定默认值
 * @param context 错误上下文描述
 * @param defaultValue 默认返回值
 * @returns 错误处理函数
 */
export function logErrorWithDefault<T>(context: string, defaultValue: T): (error: unknown) => T {
  return (error: unknown) => {
    console.error(`[${context}]`, error);
    return defaultValue;
  };
}

/**
 * 静默catch处理器（仅在确实需要静默处理时使用）
 * 会记录警告而非错误
 * @param context 错误上下文描述
 * @returns 错误处理函数
 */
export function silentError(context: string): (error: unknown) => undefined {
  return (error: unknown) => {
    console.warn(`[${context}] 静默处理:`, error);
    return undefined;
  };
}
