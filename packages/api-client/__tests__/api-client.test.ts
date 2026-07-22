import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  OpenFactoryApiClient,
  createApiClient,
} from '../src/index.js';

// Mock fetch
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as unknown as Response;
}

describe('OpenFactoryApiClient', () => {
  let client: OpenFactoryApiClient;

  beforeEach(() => {
    fetchMock.mockReset();
    client = new OpenFactoryApiClient({
      baseUrl: 'https://api.example.com',
      token: 'test-token',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // 认证与令牌管理
  // ============================================================

  it('构造时存储 token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'p1' } }));
    await client.getPlugin('p1');

    const [url, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-token'
    );
  });

  it('setToken 更新令牌', async () => {
    client.setToken('new-token');
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'p1' } }));
    await client.getPlugin('p1');

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer new-token'
    );
  });

  it('clearToken 移除令牌', async () => {
    client.clearToken();
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'p1' } }));
    await client.getPlugin('p1');

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('无 token 时不发送 Authorization 头', async () => {
    const noTokenClient = new OpenFactoryApiClient({ baseUrl: 'https://api.example.com' });
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'p1' } }));
    await noTokenClient.getPlugin('p1');

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  // ============================================================
  // Plugin API
  // ============================================================

  it('searchPlugins 拼接查询参数', async () => {
    const searchData = {
      results: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    };
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: searchData }));

    await client.searchPlugins({
      keyword: 'video',
      category: 'effect',
      sortBy: 'downloads',
      sortOrder: 'desc',
      page: 2,
      limit: 10,
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('keyword=video');
    expect(url).toContain('category=effect');
    expect(url).toContain('sortBy=downloads');
    expect(url).toContain('sortOrder=desc');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
  });

  it('searchPlugins 忽略空参数', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { results: [], total: 0, page: 1, limit: 20, hasMore: false } })
    );
    await client.searchPlugins({});

    const [url] = fetchMock.mock.calls[0];
    expect(url).not.toContain('keyword');
    expect(url).not.toContain('category');
  });

  it('getPlugin 请求正确端点', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { plugin: {}, reviews: [], versions: [] } }));
    await client.getPlugin('plugin-123');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/v1/plugins/plugin-123');
    expect(init.method).toBeUndefined();
  });

  it('installPlugin 发送 POST 请求', async () => {
    const installData = { success: true, pluginId: 'p1', version: '1.0.0', installPath: '/plugins/p1' };
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: installData }));

    const result = await client.installPlugin('p1', '1.0.0');
    const [, init] = fetchMock.mock.calls[0];

    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ version: '1.0.0' });
    expect(result.pluginId).toBe('p1');
  });

  it('submitReview 发送评分数据', async () => {
    const reviewData = {
      id: 'r1', pluginId: 'p1', userId: 'u1', userName: 'tester',
      rating: 5, title: '好评', content: '很好用', version: '1.0.0',
      createdAt: '', updatedAt: '', helpful: 0, reported: false,
    };
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: reviewData }));

    const result = await client.submitReview('p1', 5, '好评', '很好用');
    const [, init] = fetchMock.mock.calls[0];

    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ rating: 5, title: '好评', content: '很好用' });
    expect(result.rating).toBe(5);
  });

  // ============================================================
  // Creator API
  // ============================================================

  it('getMyProfile 请求 /creators/me', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'c1', displayName: '创作者' } }));
    await client.getMyProfile();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/v1/creators/me');
  });

  it('getMyStats 请求 /creators/me/stats', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { totalRevenue: 1000 } }));
    await client.getMyStats();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/creators/me/stats');
  });

  it('getMyRevenue 请求 /creators/me/revenue', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { total: 1000, monthly: 100, breakdown: [] } }));
    await client.getMyRevenue();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/creators/me/revenue');
  });

  it('getDashboard 请求 /creators/me/dashboard', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          profile: { id: 'c1' },
          stats: {},
          revenue: {},
          recentPlugins: [],
          notifications: [],
        },
      })
    );
    await client.getDashboard();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/creators/me/dashboard');
  });

  it('updateProfile 发送 PUT 请求', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'c1', displayName: '新名' } }));
    await client.updateProfile({ displayName: '新名', bio: '简介' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ displayName: '新名', bio: '简介' });
  });

  it('getCreator 按指定 ID 请求', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'creator-99' } }));
    await client.getCreator('creator-99');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/creators/creator-99');
  });

  it('getCreatorStats 按 ID 请求 stats', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { totalRevenue: 0 } }));
    await client.getCreatorStats('creator-99');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/creators/creator-99/stats');
  });

  // ============================================================
  // 错误处理
  // ============================================================

  it('HTTP 非 2xx 响应抛出错误', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: false, error: { code: 'NOT_FOUND', message: '插件不存在' } }, false, 404)
    );

    await expect(client.getPlugin('missing')).rejects.toThrow('插件不存在');
  });

  it('HTTP 错误且无 message 时使用状态码', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 500));

    await expect(client.getPlugin('p1')).rejects.toThrow('HTTP 500');
  });

  it('网络错误转换为 Error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(client.getPlugin('p1')).rejects.toThrow('Failed to fetch');
  });

  it('非 Error 异常包装为网络错误', async () => {
    fetchMock.mockRejectedValue('字符串错误');

    await expect(client.getPlugin('p1')).rejects.toThrow('Network error');
  });

  // ============================================================
  // 工厂函数
  // ============================================================

  it('createApiClient 工厂函数返回客户端实例', () => {
    const c = createApiClient({ baseUrl: 'https://api.example.com' });
    expect(c).toBeInstanceOf(OpenFactoryApiClient);
  });
});
