declare module 'vue' {
  export function ref<T>(value: T): { value: T };
  export function inject<T>(key: InjectionKey<T>): T | undefined;
  export function inject<T>(key: string): T | undefined;
  export function onUnmounted(fn: () => void): void;
  export interface InjectionKey<T> extends Symbol {}
  export interface App {
    provide(key: symbol | InjectionKey<any>, value: any): void;
    config: { globalProperties: Record<string, any> };
  }
  export type Ref<T> = { value: T };
}
