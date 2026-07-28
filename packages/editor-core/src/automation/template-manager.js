import { clamp01 } from '../math-utils';
// ============================================================
// 工厂函数
// ============================================================
let _templateId = 1;
function genTemplateId() {
    return `tpl_${Date.now()}_${_templateId++}`;
}
/** 创建默认节奏参数 */
export function createDefaultRhythmParams() {
    return {
        style: 'medium',
        clipDurationRange: { min: 2, max: 15, preferred: 5 },
        beatSync: false,
        silenceTolerance: 1.0,
        sceneChangeWeight: 0.7,
        keyframeWeight: 0.5,
        qualityWeight: 0.3,
    };
}
/** 创建默认转场偏好 */
export function createDefaultTransitionPreference() {
    return {
        defaultType: 'dissolve',
        defaultDuration: 0.5,
        sceneTypeOverrides: {},
        autoAddTransitions: true,
    };
}
/** 创建默认字幕样式 */
export function createDefaultSubtitleStyleConfig() {
    return {
        autoGenerate: false,
        position: 'bottom',
        fontSize: 0.05,
        fontFamily: 'sans-serif',
        fontColor: '#FFFFFF',
        backgroundColor: '#00000080',
        bold: false,
        outlineWidth: 2,
        outlineColor: '#000000',
    };
}
/** 创建默认片段筛选规则 */
export function createDefaultClipFilterRule() {
    return {
        minQuality: 40,
        excludeSceneTypes: ['black', 'unknown'],
        preferSceneTypes: ['dialogue', 'action', 'close-up'],
        minClipDuration: 1.0,
        maxClipDuration: 30.0,
    };
}
/** 创建空模板 */
export function createEmptyTemplate(name, category) {
    const now = Date.now();
    return {
        id: genTemplateId(),
        name,
        description: '',
        category,
        version: 1,
        rhythm: createDefaultRhythmParams(),
        transition: createDefaultTransitionPreference(),
        subtitle: createDefaultSubtitleStyleConfig(),
        filter: createDefaultClipFilterRule(),
        maxClipsPerMedia: 10,
        shuffleOrder: false,
        createdAt: now,
        updatedAt: now,
        builtin: false,
        tags: [],
    };
}
// ============================================================
// 内置模板
// ============================================================
/** 内置 Vlog 模板 */
export const BUILTIN_vlog_TEMPLATE = {
    id: 'builtin-vlog',
    name: 'Vlog 日常',
    description: '适合日常 Vlog 的轻松节奏模板，片段时长适中，转场柔和',
    category: 'vlog',
    version: 1,
    rhythm: {
        style: 'medium',
        clipDurationRange: { min: 3, max: 12, preferred: 6 },
        beatSync: false,
        silenceTolerance: 1.5,
        sceneChangeWeight: 0.6,
        keyframeWeight: 0.4,
        qualityWeight: 0.5,
    },
    transition: {
        defaultType: 'dissolve',
        defaultDuration: 0.6,
        sceneTypeOverrides: {
            landscape: 'zoom-dissolve',
        },
        autoAddTransitions: true,
    },
    subtitle: {
        autoGenerate: true,
        position: 'bottom',
        fontSize: 0.045,
        fontFamily: 'sans-serif',
        fontColor: '#FFFFFF',
        backgroundColor: '#00000060',
        bold: false,
        outlineWidth: 1,
        outlineColor: '#333333',
    },
    filter: {
        minQuality: 50,
        excludeSceneTypes: ['black', 'unknown'],
        preferSceneTypes: ['dialogue', 'landscape', 'close-up'],
        minClipDuration: 2.0,
        maxClipDuration: 20.0,
    },
    maxClipsPerMedia: 8,
    shuffleOrder: false,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
    tags: ['vlog', '日常', '轻松'],
};
/** 内置短视频模板 */
export const BUILTIN_SHORT_VIDEO_TEMPLATE = {
    id: 'builtin-short-video',
    name: '短视频',
    description: '快节奏短视频模板，片段短促有力，适合抖音/快手等平台',
    category: 'short-video',
    version: 1,
    rhythm: {
        style: 'fast',
        clipDurationRange: { min: 1, max: 6, preferred: 3 },
        beatSync: true,
        targetBpm: 120,
        silenceTolerance: 0.5,
        sceneChangeWeight: 0.8,
        keyframeWeight: 0.6,
        qualityWeight: 0.2,
    },
    transition: {
        defaultType: 'flash-black',
        defaultDuration: 0,
        sceneTypeOverrides: {
            action: 'flash-black',
            dialogue: 'dissolve',
        },
        autoAddTransitions: true,
    },
    subtitle: {
        autoGenerate: true,
        position: 'center',
        fontSize: 0.06,
        fontFamily: 'sans-serif',
        fontColor: '#FFFFFF',
        backgroundColor: '#00000080',
        bold: true,
        outlineWidth: 3,
        outlineColor: '#000000',
    },
    filter: {
        minQuality: 40,
        excludeSceneTypes: ['black', 'unknown', 'transition'],
        preferSceneTypes: ['action', 'close-up', 'dialogue'],
        minClipDuration: 0.5,
        maxClipDuration: 8.0,
    },
    targetDurationRange: { min: 15, max: 60 },
    maxClipsPerMedia: 5,
    shuffleOrder: false,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
    tags: ['短视频', '快节奏', '抖音'],
};
/** 内置宣传片模板 */
export const BUILTIN_PROMO_TEMPLATE = {
    id: 'builtin-promo',
    name: '宣传片',
    description: '大气宣传片模板，注重画面质量，节奏由慢到快递进',
    category: 'promo',
    version: 1,
    rhythm: {
        style: 'dynamic',
        clipDurationRange: { min: 2, max: 10, preferred: 4 },
        beatSync: true,
        targetBpm: 100,
        silenceTolerance: 0.8,
        sceneChangeWeight: 0.9,
        keyframeWeight: 0.7,
        qualityWeight: 0.8,
    },
    transition: {
        defaultType: 'fade-black',
        defaultDuration: 0.8,
        sceneTypeOverrides: {
            'wide-shot': 'zoom-dissolve',
            action: 'flash-black',
        },
        autoAddTransitions: true,
    },
    subtitle: {
        autoGenerate: false,
        position: 'lower-third',
        fontSize: 0.05,
        fontFamily: 'serif',
        fontColor: '#FFFFFF',
        backgroundColor: '#00000000',
        bold: true,
        outlineWidth: 2,
        outlineColor: '#000000',
    },
    filter: {
        minQuality: 70,
        excludeSceneTypes: ['black', 'unknown', 'transition', 'title'],
        preferSceneTypes: ['wide-shot', 'landscape', 'action', 'close-up'],
        minClipDuration: 1.5,
        maxClipDuration: 15.0,
    },
    maxClipsPerMedia: 6,
    shuffleOrder: false,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
    tags: ['宣传片', '大气', '商业'],
};
/** 所有内置编辑模板 */
export const BUILTIN_EDIT_TEMPLATES = [
    BUILTIN_vlog_TEMPLATE,
    BUILTIN_SHORT_VIDEO_TEMPLATE,
    BUILTIN_PROMO_TEMPLATE,
];
// ============================================================
// 模板规范化
// ============================================================
/** 规范化节奏参数 */
export function normalizeRhythmParams(data) {
    const defaults = createDefaultRhythmParams();
    const range = data.clipDurationRange ?? defaults.clipDurationRange;
    return {
        style: data.style ?? defaults.style,
        clipDurationRange: {
            min: Math.max(0.1, range.min ?? defaults.clipDurationRange.min),
            max: Math.max(0.2, range.max ?? defaults.clipDurationRange.max),
            preferred: Math.max(0.1, range.preferred ?? defaults.clipDurationRange.preferred),
        },
        beatSync: data.beatSync ?? defaults.beatSync,
        targetBpm: data.targetBpm,
        silenceTolerance: Math.max(0, data.silenceTolerance ?? defaults.silenceTolerance),
        sceneChangeWeight: clamp01(data.sceneChangeWeight ?? defaults.sceneChangeWeight),
        keyframeWeight: clamp01(data.keyframeWeight ?? defaults.keyframeWeight),
        qualityWeight: clamp01(data.qualityWeight ?? defaults.qualityWeight),
    };
}
/** 规范化模板 */
export function normalizeTemplate(data) {
    const now = Date.now();
    return {
        id: typeof data.id === 'string' && data.id ? data.id : genTemplateId(),
        name: typeof data.name === 'string' ? data.name : '未命名模板',
        description: typeof data.description === 'string' ? data.description : '',
        category: data.category ?? 'custom',
        version: typeof data.version === 'number' ? data.version : 1,
        rhythm: normalizeRhythmParams(data.rhythm ?? {}),
        transition: { ...createDefaultTransitionPreference(), ...data.transition },
        subtitle: { ...createDefaultSubtitleStyleConfig(), ...data.subtitle },
        filter: { ...createDefaultClipFilterRule(), ...data.filter },
        targetDurationRange: data.targetDurationRange,
        maxClipsPerMedia: Math.max(1, data.maxClipsPerMedia ?? 10),
        shuffleOrder: data.shuffleOrder ?? false,
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : now,
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : now,
        builtin: data.builtin ?? false,
        tags: Array.isArray(data.tags) ? data.tags : [],
    };
}
// ============================================================
// 模板管理器
// ============================================================
/** 创建默认模板管理器配置 */
export function createDefaultTemplateManagerConfig() {
    return {
        maxCustomTemplates: 50,
        storageKey: 'open-factory-edit-templates',
    };
}
/**
 * 模板管理器
 * 管理编辑模板的增删改查及导入导出
 */
export class TemplateManager {
    templates = new Map();
    listeners = new Map();
    config;
    constructor(config) {
        this.config = { ...createDefaultTemplateManagerConfig(), ...config };
        // 加载内置模板
        for (const tpl of BUILTIN_EDIT_TEMPLATES) {
            this.templates.set(tpl.id, tpl);
        }
    }
    /** 获取所有模板 */
    getAllTemplates() {
        return Array.from(this.templates.values());
    }
    /** 获取指定模板 */
    getTemplate(id) {
        return this.templates.get(id);
    }
    /** 按类别获取模板 */
    getTemplatesByCategory(category) {
        return this.getAllTemplates().filter((t) => t.category === category);
    }
    /** 获取自定义模板 */
    getCustomTemplates() {
        return this.getAllTemplates().filter((t) => !t.builtin);
    }
    /** 创建模板 */
    createTemplate(data) {
        const customCount = this.getCustomTemplates().length;
        if (customCount >= this.config.maxCustomTemplates) {
            throw new Error(`自定义模板数量已达上限 (${this.config.maxCustomTemplates})`);
        }
        const template = normalizeTemplate({ ...data, builtin: false });
        this.templates.set(template.id, template);
        this.emit('created', template);
        return template;
    }
    /** 更新模板 */
    updateTemplate(id, updates) {
        const existing = this.templates.get(id);
        if (!existing) {
            throw new Error(`模板不存在: ${id}`);
        }
        if (existing.builtin) {
            throw new Error(`不能修改内置模板: ${id}`);
        }
        const updated = normalizeTemplate({
            ...existing,
            ...updates,
            id: existing.id,
            builtin: false,
            createdAt: existing.createdAt,
            updatedAt: Date.now(),
        });
        this.templates.set(id, updated);
        this.emit('updated', updated);
        return updated;
    }
    /** 删除模板 */
    deleteTemplate(id) {
        const existing = this.templates.get(id);
        if (!existing)
            return false;
        if (existing.builtin) {
            throw new Error(`不能删除内置模板: ${id}`);
        }
        this.templates.delete(id);
        this.emit('deleted', existing);
        return true;
    }
    /** 导出模板 */
    exportTemplate(id) {
        const template = this.templates.get(id);
        if (!template) {
            throw new Error(`模板不存在: ${id}`);
        }
        const { id: _id, createdAt: _ca, updatedAt: _ua, builtin: _b, ...rest } = template;
        return {
            formatVersion: 1,
            template: rest,
            exportedAt: Date.now(),
        };
    }
    /** 导入模板 */
    importTemplate(data) {
        if (data.formatVersion !== 1) {
            throw new Error(`不支持的模板格式版本: ${data.formatVersion}`);
        }
        return this.createTemplate(data.template);
    }
    /** 导出所有自定义模板 */
    exportAllCustom() {
        return this.getCustomTemplates().map((t) => this.exportTemplate(t.id));
    }
    /** 批量导入模板 */
    importBatch(dataList) {
        return dataList.map((d) => this.importTemplate(d));
    }
    /** 注册事件监听器 */
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(listener);
    }
    /** 移除事件监听器 */
    off(event, listener) {
        this.listeners.get(event)?.delete(listener);
    }
    /** 触发事件 */
    emit(event, template) {
        this.listeners.get(event)?.forEach((fn) => fn(event, template));
    }
    /** 搜索模板 */
    searchTemplates(query) {
        const q = query.toLowerCase();
        return this.getAllTemplates().filter((t) => t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.tags.some((tag) => tag.toLowerCase().includes(q)));
    }
    /** 获取模板统计 */
    getStats() {
        const all = this.getAllTemplates();
        const byCategory = {};
        for (const t of all) {
            byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
        }
        return {
            total: all.length,
            builtin: all.filter((t) => t.builtin).length,
            custom: all.filter((t) => !t.builtin).length,
            byCategory,
        };
    }
}
//# sourceMappingURL=template-manager.js.map