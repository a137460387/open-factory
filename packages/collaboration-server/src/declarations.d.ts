declare module 'socket.io' {
  export class Server<
    C2S extends Record<string, (...args: any[]) => void> = Record<string, (...args: any[]) => void>,
    S2C extends Record<string, (...args: any[]) => void> = Record<string, (...args: any[]) => void>,
    IS extends Record<string, (...args: any[]) => void> = Record<string, (...args: any[]) => void>,
    SD extends Record<string, any> = Record<string, any>,
  > {
    constructor(httpServer?: any, opts?: any);
    use(fn: (socket: Socket<C2S, S2C, IS, SD>, next: (err?: Error) => void) => void): this;
    on(event: 'connection', fn: (socket: Socket<C2S, S2C, IS, SD>) => void): this;
    to(room: string): this;
    emit(event: string, ...args: any[]): this;
    close(): void;
    disconnectSockets(close?: boolean): void;
  }

  export class Socket<
    C2S extends Record<string, (...args: any[]) => void> = Record<string, (...args: any[]) => void>,
    S2C extends Record<string, (...args: any[]) => void> = Record<string, (...args: any[]) => void>,
    IS extends Record<string, (...args: any[]) => void> = Record<string, (...args: any[]) => void>,
    SD extends Record<string, any> = Record<string, any>,
  > {
    id: string;
    handshake: { auth: any; address: string; query: Record<string, string> };
    data: SD;
    join(room: string): void;
    leave(room: string): void;
    to(room: string): this;
    emit<K extends keyof S2C>(event: K, ...args: Parameters<S2C[K]>): this;
    on<K extends keyof C2S>(event: K, fn: C2S[K]): this;
    disconnect(close?: boolean): void;
    broadcast: { to(room: string): { emit(event: string, ...args: any[]): void } };
  }
}

declare module 'express' {
  export interface Request {
    params: Record<string, string>;
    query: Record<string, string>;
    body: any;
    headers: Record<string, string | undefined>;
  }

  export interface Response {
    status(code: number): this;
    json(data: any): this;
    send(data: any): this;
  }

  export type NextFunction = (err?: any) => void;

  export interface Application {
    use(...args: any[]): this;
    get(path: string, ...handlers: any[]): this;
    post(path: string, ...handlers: any[]): this;
    put(path: string, ...handlers: any[]): this;
    delete(path: string, ...handlers: any[]): this;
    listen(port: number, fn?: () => void): any;
  }

  export function express(): Application;
  export default express;
}

declare module 'cors' {
  export default function cors(options?: any): any;
}

declare module 'jsonwebtoken' {
  export function sign(payload: any, secret: string, options?: any): string;
  export function verify(token: string, secret: string, options?: any): any;
  export function decode(token: string): any;
  export class TokenExpiredError extends Error {}
  export class NotBeforeError extends Error {}
  export class JsonWebTokenError extends Error {}
}

declare module 'zod' {
  export const z: {
    object: <T extends Record<string, any>>(shape: T) => any;
    string: () => any;
    number: () => any;
    boolean: () => any;
    enum: <T extends string[]>(values: T) => any;
    optional: <T>(schema: T) => any;
    array: <T>(schema: T) => any;
    union: <T extends any[]>(schemas: T) => any;
    coerce: {
      number: () => any;
      string: () => any;
    };
    infer: <T>(schema: T) => any;
  };
}

declare module 'ioredis' {
  export default class Redis {
    constructor(url?: string, opts?: any);
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ...args: any[]): Promise<string>;
    del(key: string): Promise<number>;
    publish(channel: string, message: string): Promise<number>;
    subscribe(channel: string): Promise<void>;
    unsubscribe(channel: string): Promise<void>;
    sadd(key: string, ...members: string[]): Promise<number>;
    srem(key: string, ...members: string[]): Promise<number>;
    smembers(key: string): Promise<string[]>;
    on(event: string, fn: (...args: any[]) => void): this;
    quit(): Promise<void>;
    disconnect(): void;

    static Cluster: typeof Redis;
  }
}
