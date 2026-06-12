const zh = {
  common: {
    saved: '已保存',
    unsavedChanges: '未保存更改',
    idle: '空闲',
    clear: '清除',
    close: '关闭',
    cancel: '取消',
    retry: '重试',
    reset: '重置',
    unavailable: '不可用',
    available: '可用',
    missing: '缺失',
    auto: '自动',
    none: '无',
    secondsShort: '秒',
    noVideo: '无视频',
    audioOnly: '仅音频'
  },
  project: {
    defaultName: '未命名项目'
  },
  projectTemplates: {
    title: '从模板新建',
    subtitle: '选择一个项目起点',
    select: '使用模板',
    close: '关闭',
    templates: {
      verticalShort: { name: '竖版短视频', description: '9:16, 30fps, 1080x1920' },
      youtubeHorizontal: { name: '横版 YouTube', description: '16:9, 30fps, 1920x1080' },
      squareSocial: { name: '正方形社交', description: '1:1, 30fps, 1080x1080' },
      podcast: { name: '播客', description: '纯音频轨，导出 M4A' },
      cinema: { name: '电影', description: '16:9, 24fps, 4K, LUT 预设' }
    }
  },
  clips: {
    defaultTextName: '文字',
    defaultTextContent: '标题',
    defaultAdjustmentName: '调整层'
  },
  toolbar: {
    fileMenu: '文件',
    editMenu: '编辑',
    toolsMenu: '工具',
    newProject: '新建项目',
    newFromTemplate: '从模板新建',
    openProject: '打开项目',
    saveProject: '保存项目',
    archiveProject: '归档项目',
    mediaReport: '素材报告',
    createSharePackage: '创建分享包',
    batchTranscode: '批量转码',
    importMedia: '导入媒体',
    importSubtitles: '导入字幕',
    exportVideo: '导出视频',
    exportTimeline: '导出时间线',
    exportCurrentFrame: '导出当前帧',
    exportDisabled: '请先向时间线添加媒体',
    settings: '设置',
    clearMediaCache: '清除媒体缓存',
    autosaveInterval: '自动保存间隔',
    autosave: '自动保存',
    whisperExecutable: 'Whisper 可执行文件',
    whisperModel: 'Whisper 模型',
    chooseWhisperExecutable: '选择 Whisper 可执行文件',
    chooseWhisperModel: '选择 Whisper 模型文件',
    undo: '撤销',
    redo: '重做',
    history: '历史',
    splitSelectedClip: '分割选中片段',
    smartRoughCut: '智能粗剪',
    createMulticamSequence: '创建多机位序列',
    play: '播放',
    pause: '暂停',
    cancelExport: '取消导出',
    openExportFolder: '打开导出文件夹',
    localExport: '本地多轨导出',
    projectHealthCheck: '项目健康检查'
  },
  editMenu: {
    saveSnapshot: '保存快照',
    snapshotHistory: '快照历史'
  },
  historyPanel: {
    title: '编辑历史',
    subtitle: '撤销与重做状态',
    empty: '还没有可用历史。',
    affectedClips: (count: number) => `${count} 个片段`,
    position: (position: number, total: number) => `当前位置 ${position}/${total}`,
    jumpFailed: '历史跳转失败',
    jumpFailedMessage: '无法跳转到该历史状态。'
  },
  settings: {
    title: '设置',
    subtitle: '本地配置和素材库',
    tabs: {
      general: '通用',
      lutLibrary: 'LUT库',
      shortcuts: '快捷键',
      translation: '字幕翻译',
      proxy: '代理媒体',
      plugins: '插件'
    },
    general: {
      title: '通用',
      description: '配置界面语言和本机偏好。',
      language: '界面语言',
      languageDescription: '语言会保存到本机设置文件。',
      saveFailed: '语言保存失败',
      saveFailedMessage: '无法写入设置文件。',
      options: {
        zh: '中文',
        en: 'English'
      }
    },
    lutLibrary: {
      title: 'LUT库',
      loading: '正在扫描 LUT...',
      empty: '配置目录中没有 .cube LUT 文件。',
      refresh: '刷新',
      preview: '预览',
      apply: '确认应用',
      favorite: '收藏',
      unfavorite: '取消收藏',
      applied: 'LUT 已应用',
      applyFailed: 'LUT 应用失败',
      applyFailedMessage: '无法应用该 LUT。',
      favoriteFailed: '收藏失败',
      favoriteFailedMessage: '无法更新 LUT 收藏。',
      loadFailed: 'LUT 库加载失败',
      loadFailedMessage: '无法读取配置目录中的 LUT。',
      noClipSelected: '未选择可用片段',
      noClipSelectedMessage: '请选择视频或图片片段后再预览或应用 LUT。',
      readyForClip: (name: string) => `将应用到 ${name}`
    },
    shortcuts: {
      title: '快捷键',
      description: '重新绑定时间线和导出快捷键。',
      pressKeys: '按下按键...',
      resetAll: '全部重置',
      saveFailed: '快捷键保存失败',
      saveFailedMessage: '无法写入快捷键配置。',
      loadFailed: '快捷键加载失败',
      conflict: (keys: string) => `冲突：${keys}`,
      actions: {
        'toggle-playback': '播放/暂停',
        'reverse-playback': '反向播放',
        'pause-playback': '暂停',
        'forward-playback': '正向播放',
        'step-back': '后退一帧',
        'step-forward': '前进一帧',
        'set-in-point': '设置入点',
        'set-out-point': '设置出点',
        'split-selected': '分割选中片段',
        'delete-selected': '删除选中片段',
        'ripple-delete': '波纹删除',
        'select-all': '全选片段',
        'clear-selection': '清除选择',
        'add-annotation': '添加批注',
        undo: '撤销',
        redo: '重做',
        save: '保存项目',
        'export-current-frame': '导出当前帧'
      }
    },
    translation: {
      title: '字幕翻译',
      description: '配置本地保存的翻译 API，用于把字幕复制到新的字幕轨。',
      provider: '服务',
      apiKey: 'API Key',
      targetLanguage: '目标语言',
      keyStorageNote: 'Key 仅存储在您的设备上',
      localOnlyNote: '只发送字幕文本，不上传媒体文件；密钥保存在本机浏览器存储。'
    },
    proxy: {
      title: '代理媒体',
      description: '自动生成本地 H.264 代理文件，导出仍使用原始媒体。',
      resolution: '代理分辨率',
      triggerThreshold: '触发阈值',
      thresholdOption: (value: number) => `短边 > ${value}p`,
      reset: '恢复默认'
    },
    plugins: {
      title: '插件',
      description: '从本机插件目录加载可信 JS 插件，Hook 在 Worker 中运行；仅安装来自可信来源的插件。',
      refresh: '刷新',
      loading: '正在加载插件...',
      empty: '没有加载到插件。',
      builtin: '内置',
      user: '用户',
      hooks: 'Hook',
      permissions: '权限',
      status: '状态',
      errors: '错误',
      enable: '启用',
      disable: '禁用',
      uninstall: '卸载',
      noDescription: '无描述',
      builtinLocked: '内置插件不能卸载',
      enabledTitle: '插件已启用',
      disabledTitle: '插件已禁用',
      uninstallFailed: '卸载失败',
      uninstallFailedMessage: '无法删除插件文件。',
      state: {
        enabled: '已启用',
        disabled: '已禁用',
        error: '错误'
      },
      permissionLabels: {
        'read-project': '读取项目',
        'write-project': '写入项目',
        'export-hook': '导出 Hook',
        'menu-register': '注册菜单'
      },
      loadFailed: '插件加载失败',
      loadFailedMessage: '无法读取插件目录。'
    }
  },
  timelineExport: {
    title: '导出时间线',
    description: '导出主序列为剪辑交换格式。',
    format: '格式',
    export: '导出',
    exporting: '正在导出...',
    success: '时间线已导出',
    failed: '时间线导出失败',
    failedMessage: '无法导出时间线。',
    filterName: (format: string) => (format === 'fcp-xml' ? 'Final Cut Pro XML' : 'CMX3600 EDL'),
    formats: {
      edl: 'CMX3600 EDL',
      fcpXml: 'Final Cut Pro 7 XML'
    }
  },
  mediaBin: {
    title: '媒体',
    itemCount: (count: number) => `${count} 个素材`,
    relinkFolder: '重连文件夹',
    import: '导入',
    newAdjustmentLayer: '新建调整层',
    batchTranscode: '批量转码',
    scanDuplicates: '扫描重复',
    searchPlaceholder: '搜索媒体',
    filters: {
      all: '全部',
      video: '视频',
      audio: '音频',
      image: '图片',
      tagged: '已标记',
      titles: '标题'
    },
    label: '标签',
    clearLabel: '清除标签',
    labelColors: {
      red: '红色',
      orange: '橙色',
      yellow: '黄色',
      green: '绿色',
      blue: '蓝色',
      purple: '紫色'
    },
    mediaJobs: '媒体任务',
    preparingQueue: '正在准备队列',
    pendingCount: (count: number) => `${count} 个待处理`,
    failedCount: (count: number) => `${count} 个失败`,
    emptyDrop: '将媒体文件拖到这里，或点击导入。',
    addToTimeline: '添加到时间线',
    relink: '重连',
    generateProxy: '生成代理',
    sequenceSuffix: '序列',
    proxyStatus: {
      ready: '代理就绪',
      pending: '代理排队中',
      error: '代理失败',
      recommended: '建议生成代理',
      notNeeded: '无需代理'
    },
    jobType: {
      proxy: '代理',
      waveform: '波形'
    },
    assetType: {
      video: '视频',
      audio: '音频',
      image: '图片'
    },
    titleTemplateCount: (count: number) => `${count} 个标题模板`,
    addTitleTemplate: '添加标题模板'
  },
  duplicateMedia: {
    title: (count: number) => `${count} 组重复素材`,
    subtitle: '按文件大小和前 4KB 内容 hash 检测。',
    keep: '保留',
    merge: '合并引用',
    cancel: '取消',
    empty: '没有发现重复素材。',
    groupSummary: (count: number, size: string) => `${count} 个文件 · ${size}`,
    scanFailed: '重复素材扫描失败',
    scanFailedMessage: '无法扫描媒体文件。',
    mergedTitle: '重复素材已合并',
    mergedMessage: (count: number) => `已合并 ${count} 组重复素材。`
  },
  projectHealth: {
    title: '项目健康检查',
    subtitle: '扫描媒体引用、代理文件和字幕字体。',
    scanning: '正在扫描项目...',
    empty: '未发现项目健康问题。',
    total: (count: number) => `发现 ${count} 项`,
    rescan: '重新检查',
    sections: {
      missingMedia: '缺失媒体',
      duplicateMedia: '重复素材',
      orphanMedia: '孤立媒体',
      proxyMissing: '代理未生成',
      missingFonts: '缺失字幕字体'
    },
    sectionCount: (count: number) => `${count} 项`,
    actions: {
      relink: '跳转重连',
      removeOrphan: '从媒体库移除',
      mergeDuplicate: '合并引用',
      enqueueProxy: '加入生成队列'
    },
    detail: {
      clipRef: (clipName: string, trackName: string) => `${clipName} / ${trackName}`,
      duplicateGroup: (count: number, size: number) => `${count} 个路径，${formatBytes(size)}`,
      proxyResolution: (width: number, height: number) => `${width} x ${height}`,
      missingFont: (fontFamily: string) => `字幕字体：${fontFamily}`
    },
    toasts: {
      scanFailed: '健康检查失败',
      scanFailedMessage: '无法完成项目健康检查。',
      orphanRemoved: '孤立素材已移除',
      duplicateMerged: '重复素材引用已合并',
      proxyQueued: '代理任务已加入队列',
      fixFailed: '修复失败',
      fixFailedMessage: '无法应用该修复。'
    }
  },
  titleTemplates: {
    'lower-third': {
      name: '下三分之一',
      defaultText: '人物姓名'
    },
    'fullscreen-title': {
      name: '全屏标题',
      defaultText: '项目标题'
    },
    'caption-bar': {
      name: '字幕条',
      defaultText: '重点说明'
    },
    'corner-bug': {
      name: '角标',
      defaultText: '直播'
    },
    counter: {
      name: '计数器',
      defaultText: '00:05'
    }
  },
  preview: {
    title: '预览',
    canvasSize: '1280 x 720 画布',
    colorScopes: '颜色示波器',
    compareToggle: 'A/B 对比预览',
    compareLeftRight: '左右分割对比',
    compareTopBottom: '上下分割对比',
    compareDifference: '叠加差值对比',
    compareDivider: '对比分割线',
    canvasEditMode: '画布编辑模式',
    canvasEditModeActive: '关闭画布编辑模式',
    transformAnchor: '中心锚点',
    rotateHandle: '旋转手柄',
    multicamGrid: '多机位预览',
    multicamCutFailedTitle: '多机位切换失败',
    multicamCutFailedMessage: '无法记录该机位切换点。',
    multicamAngle: (name: string) => `切换到 ${name}`,
    renderFailedTitle: '预览渲染失败',
    renderFailedMessage: '无法绘制预览。',
    missingMedia: (name: string) => `媒体缺失：${name}`
  },
  scopes: {
    histogram: '直方图',
    waveform: '波形图',
    vectorscope: '矢量示波器'
  },
  mixer: {
    title: '音频混音器',
    master: '主控',
    output: '输出',
    muteTrack: '静音轨道',
    soloTrack: '独奏轨道',
    volume: '音量',
    pan: '声像',
    expandChannel: '展开通道处理',
    collapseChannel: '收起通道处理',
    eq: 'EQ',
    eqEnabled: '启用 EQ',
    compressor: '压缩器',
    compressorEnabled: '启用压缩器',
    frequency: '频率',
    gain: '增益',
    q: 'Q',
    threshold: '阈值',
    ratio: '比率',
    attack: '启动',
    release: '释放',
    makeupGain: '补偿',
    bandNames: {
      low: '低频',
      lowMid: '中低',
      highMid: '中高',
      high: '高频'
    }
  },
  timeline: {
    title: '时间线',
    subtitle: '拖拽片段、修剪边缘、在播放头处分割',
    tracks: '轨道',
    renderCache: '缓存',
    addVideoTrack: '添加视频轨道',
    addAudioTrack: '添加音频轨道',
    addSubtitleTrack: '添加字幕轨道',
    addTextClip: '添加文字片段',
    addAdjustmentLayer: '新建调整层',
    adjustmentTrackName: (index: number) => `调整层 ${index}`,
    addMarker: '在播放头添加标记',
    annotationMode: '批注模式',
    annotations: '批注',
    annotationList: '批注列表',
    annotationListEmpty: '暂无批注',
    annotationLabel: (index: number) => `批注 ${index}`,
    annotationNewTitle: '添加批注',
    annotationEditTitle: '编辑批注',
    annotationText: '批注文字',
    annotationColor: '颜色',
    annotationSave: '保存批注',
    annotationDelete: '删除批注',
    annotationJump: '跳转',
    annotationRejectedTitle: '批注被拒绝',
    addAnnotationFailed: '无法添加批注。',
    updateAnnotationFailed: '无法更新批注。',
    removeAnnotationFailed: '无法删除批注。',
    splitSelectedClip: '分割选中片段',
    deleteSelectedClip: '删除选中片段',
    zoom: '时间线缩放',
    inPoint: '入点',
    outPoint: '出点',
    muteTrack: '静音轨道',
    soloTrack: '独奏轨道',
    lockTrack: '锁定轨道',
    trackVolume: '轨道音量',
    mediaMissing: '媒体文件缺失',
    sampledWaveform: '抽样波形预览',
    waveform: '波形预览',
    keyframeTitle: (property: string, time: number) => `${property} 关键帧 ${time.toFixed(2)}s`,
    transitionUnavailableTitle: '过渡不可用',
    transitionUnavailableMessage: '无法添加该过渡。',
    noTextTrackTitle: '没有文字轨道',
    noTextTrackMessage: '请先添加文字轨道。',
    markerLabel: (index: number) => `标记 ${index}`,
    markerRejectedTitle: '标记被拒绝',
    addMarkerFailed: '无法添加标记。',
    removeMarkerFailed: '无法移除标记。',
    splitUnavailableTitle: '无法分割',
    splitUnavailableMessage: '请将播放头移动到片段内部。',
    clipOverlapTitle: '片段重叠',
    clipOverlapMessage: '当前位置会与其他片段重叠。',
    editRejectedTitle: '时间线编辑被拒绝',
    editRejectedMessage: '无法应用该编辑。',
    closeGapAction: '关闭间隙',
    closeGapFailedTitle: '无法关闭间隙',
    addTransition: '添加过渡',
    transitionType: '类型',
    transitionDuration: '时长',
    transitionNames: {
      dissolve: '叠化',
      'fade-black': '淡出到黑'
    },
    add: '添加',
    remove: '移除',
    close: '关闭',
    silenceAction: '自动剪切静音段',
    sceneAction: '自动按场景分割',
    generateSubtitlesAction: '自动生成字幕',
    silenceUnavailableTitle: '无法检测静音',
    silenceUnavailableMessage: '请选择带音频的音频或视频片段。',
    silenceRemovedTitle: '静音段已删除',
    silenceRemovedMessage: (count: number) => `删除 ${count} 段静音。`,
    silenceRemoveFailedTitle: '静音删除失败',
    sceneSplitTitle: '场景已分割',
    sceneSplitMessage: (count: number) => `分割 ${count} 个切点。`,
    sceneSplitFailedTitle: '场景分割失败',
    sceneUnavailableTitle: '无法检测场景',
    sceneUnavailableMessage: '请选择视频片段。',
    noSceneCutsTitle: '未检测到场景切点',
    sceneDetectFailedTitle: '场景检测失败',
    sceneDetectFailedMessage: '无法运行 FFmpeg 场景检测。',
    whisperUnavailableTitle: '无法生成字幕',
    whisperRunningTitle: '字幕生成中',
    whisperRunningMessage: (progress: number) => `Whisper ${Math.round(progress * 100)}%`,
    whisperCompleteTitle: '字幕已生成',
    whisperFailedTitle: '字幕生成失败',
    timelineRejectedMessage: '时间线拒绝了该操作。',
    packNestedSequence: '打包为嵌套序列',
    nestedSequenceName: (index: number) => `嵌套序列 ${index}`,
    multicamSequenceName: (index: number) => `多机位序列 ${index}`,
    mainSequence: '主序列',
    backToMainSequence: '返回主序列',
    nestedSequenceDepthTitle: '嵌套序列过深',
    nestedSequenceDepthMessage: '预览最多递归显示 3 层嵌套序列。',
    silenceDialogTitle: '静音检测',
    silenceScanning: '正在解码并扫描音频...',
    silenceThreshold: '静音阈值 dB',
    silenceMinDuration: '最小静音时长 s',
    silenceMargin: '边距 ms',
    silencePreview: (count: number, duration: string) => `将删除 ${count} 段，合计 ${duration}s`,
    noSilenceFound: '未找到符合条件的静音段。',
    silenceDecodeFailed: '无法解码音频。',
    confirmSilenceCut: '确认剪切',
    startSilenceDetect: '开始检测',
    sceneDialogTitle: '场景检测',
    sceneScanning: '正在分析视频切点...',
    trackTypes: {
      video: '视频',
      audio: '音频',
      text: '文字',
      subtitle: '字幕'
    },
    newTrackName: (type: string, index: number) => `${formatTrackType(type)} ${index}`
  },
  smartRoughCut: {
    title: '智能粗剪',
    noSelection: '请选择音频或视频片段。',
    steps: {
      scene: '场景检测',
      silence: '静音检测',
      whisper: 'Whisper 字幕'
    },
    statuses: {
      idle: '未运行',
      running: '运行中',
      complete: '完成',
      error: '错误'
    },
    sceneDescription: '检测选中视频片段的切换点，确认后按场景分割。',
    silenceDescription: '检测选中片段中的静音段，预览后再删除。',
    whisperDescription: '使用本地 Whisper 配置生成字幕轨。',
    sceneUnavailable: '请选择视频片段后再检测场景。',
    silenceUnavailable: '请选择带音频的音频或视频片段。',
    whisperUnavailable: '请先选择可生成字幕的音频或视频片段，并配置 Whisper 路径。',
    detectScene: '检测场景',
    applySceneSplit: '按场景分割',
    applySelectedScene: '应用选中项',
    detectSilence: '检测静音',
    applySilenceRemoval: '确认删除静音',
    applySelectedSilence: '应用选中项',
    generateSubtitles: '生成字幕',
    scenePreview: (times: number[]) => (times.length > 0 ? `检测到 ${times.length} 个切点：${times.map((time) => `${time.toFixed(2)}s`).join(', ')}` : '未检测到可用切点。'),
    silencePreview: (count: number, duration: string) => `将删除 ${count} 段静音，合计 ${duration}s。`,
    selectAll: '全选',
    selectNone: '全不选',
    selectedCount: (selected: number, total: number) => `${selected}/${total} 已选`,
    sceneRange: (start: string, end: string) => `${start} - ${end}`,
    silenceRange: (start: string, end: string, duration: string) => `${start} - ${end}（${duration}）`,
    report: (removedSeconds: string, sceneSplits: number, subtitleClips: number) => `删除了 ${removedSeconds}s 静音，分割为 ${sceneSplits > 0 ? sceneSplits + 1 : 0} 段，生成 ${subtitleClips} 条字幕。`,
    stepComplete: (step: string) => `${step}完成`,
    stepFailed: (step: string) => `${step}失败`
  },
  inspector: {
    multipleSelected: (count: number) => `多个片段已选中（${count}）`,
    empty: '选择一个片段以编辑属性。',
    propertyRejectedTitle: '属性被拒绝',
    propertyRejectedMessage: '无法更新片段。',
    lutFilterName: 'Cube LUT',
    lutUnavailableTitle: 'LUT 不可用',
    lutUnavailableMessage: '无法选择 LUT 文件。',
    keyframeRejectedTitle: '关键帧被拒绝',
    addKeyframeFailed: '无法添加关键帧。',
    updateKeyframeFailed: '无法更新关键帧。',
    removeKeyframeFailed: '无法移除关键帧。',
    locked: '已锁定',
    sections: {
      clip: '片段',
      speed: '速度',
      transform: '变换',
      chromaKey: '抠像',
      masks: '遮罩',
      frameInterpolation: '补帧',
      stabilization: '稳定化',
      colorMatch: '颜色匹配',
      imageSequence: 'PNG 序列',
      keyframe: '关键帧',
      kenBurns: 'Ken Burns',
      audioDenoise: '降噪',
      curves: '曲线',
      colorWheels: '色轮',
      effects: '特效',
      audio: '音频',
      subtitle: '字幕',
      text: '文字'
    },
    colorMatch: {
      apply: '应用',
      applying: '正在匹配...',
      applied: '颜色匹配已应用',
      failed: '颜色匹配失败',
      failedMessage: '无法完成颜色匹配。',
      noReference: '没有可用参考片段',
      referenceRequired: '请选择参考片段。'
    },
    fields: {
      name: '名称',
      start: '开始',
      duration: '时长',
      speed: '速度',
      speedCurve: '变速曲线',
      speedCurveMin: '0.25x',
      speedCurveMax: '4x',
      scale: '缩放',
      scaleX: '缩放 X',
      scaleY: '缩放 Y',
      rotation: '旋转',
      opacity: '不透明度',
      chromaKeyColor: '目标颜色',
      similarity: '相似度',
      blend: '混合',
      addMask: '添加遮罩',
      maskType: '形状',
      rectMask: '矩形',
      ellipseMask: '椭圆',
      inverted: '反转',
      feather: '羽化',
      removeMask: '删除遮罩',
      smoothing: '平滑',
      zoom: '缩放补偿',
      analyzeStabilization: '分析稳定化',
      stabilizationAnalyzed: '已分析',
      stabilizationNotAnalyzed: '未分析',
      stabilizationProgress: (progress: number) => `分析 ${Math.round(progress * 100)}%`,
      targetFrameRate: '目标帧率',
      frameInterpolationUnsupported: '当前FFmpeg版本不支持',
      audioDenoiseUnsupported: '当前FFmpeg版本不支持',
      referenceClip: '参考片段',
      sequenceFrameRate: '序列帧率',
      time: '时间',
      value: '数值',
      easing: '缓动',
      startScale: '起始',
      endScale: '结束',
      endScaleControl: '结束缩放',
      colorCorrection: '颜色校正',
      inputColorSpace: '输入色彩空间',
      brightness: '亮度',
      contrast: '对比度',
      saturation: '饱和度',
      hue: '色相',
      clearLut: '清除 LUT',
      loadLut: '加载 .cube LUT',
      noLutLoaded: '未加载 LUT',
      masterCurve: '主',
      redCurve: 'R',
      greenCurve: 'G',
      blueCurve: 'B',
      resetCurve: '重置曲线',
      lift: 'Lift',
      gamma: 'Gamma',
      gain: 'Gain',
      red: '红',
      green: '绿',
      blue: '蓝',
      intensity: '强度',
      addEffect: '添加特效',
      effectType: '特效类型',
      enabled: '启用',
      removeEffect: '删除特效',
      moveEffectUp: '上移特效',
      moveEffectDown: '下移特效',
      radius: '半径',
      size: '大小',
      strength: '强度',
      style: '样式',
      height: '高度',
      position: '位置',
      sensitivity: '灵敏度',
      volume: '音量',
      pitchShift: '音高',
      semitones: '半音',
      reverseAudio: '音频反转',
      fadeIn: '淡入',
      fadeOut: '淡出',
      fadeInCurve: '淡入曲线',
      fadeOutCurve: '淡出曲线',
      text: '文本',
      fontSize: '字号',
      fontFamily: '字体',
      color: '颜色',
      background: '背景',
      backgroundOpacity: '背景不透明度',
      bottomMargin: '底部边距',
      exportMode: '导出模式',
      bold: '加粗',
      italic: '斜体'
    },
    inputColorSpaces: {
      rec709: 'Rec.709 / 标准',
      slog2: 'Sony S-Log2',
      slog3: 'Sony S-Log3',
      clog: 'Canon Log',
      clog3: 'Canon Log 3',
      llog: 'Leica L-Log',
      vlog: 'Panasonic V-Log'
    },
    subtitleMode: {
      burnIn: '烧录字幕',
      softSub: '软字幕'
    },
    translation: {
      button: '翻译字幕轨',
      notConfigured: '请先在设置中配置翻译 API。',
      progress: (completed: number, total: number) => `翻译 ${completed}/${total}`,
      tosTitle: '启用联网字幕翻译',
      tosMessage: '字幕翻译需将文本发送至 DeepL / Google Translate 等第三方服务。\n启用即表示您同意将字幕内容发送至上述服务；本项目不代理第三方翻译服务责任。',
      trackName: (name: string, language: string) => `${name} ${language}`,
      clipName: (name: string, language: string) => `${name} ${language}`,
      completeTitle: '字幕翻译完成',
      completeMessage: (count: number) => `已生成 ${count} 条翻译字幕。`,
      failedTitle: '字幕翻译失败',
      failedMessage: '无法完成字幕翻译。'
    },
    easing: {
      linear: '线性',
      easeIn: '缓入',
      easeOut: '缓出',
      easeInOut: '缓入缓出'
    },
    effectNames: {
      blur: '高斯模糊',
      sharpen: '锐化',
      vignette: '暗角',
      'film-grain': '胶片颗粒',
      'chromatic-aberration': '色散',
      'audio-spectrum': '音频频谱'
    },
    audioSpectrumStyles: {
      bars: '柱状',
      waveform: '波形',
      circle: '圆形'
    },
    audioSpectrumPositions: {
      top: '顶部',
      bottom: '底部'
    },
    missingFile: '文件缺失',
    title: '检查器',
    subtitle: '片段属性',
    removeKeyframe: '移除关键帧',
    addKeyframeTitle: (label: string) => `添加${label}关键帧`,
    keyframeProperty: {
      x: 'X',
      y: 'Y',
      opacity: '不透明度',
      volume: '音量',
      scaleX: '缩放 X',
      scaleY: '缩放 Y',
      speed: '速度'
    }
  },
  exportDialog: {
    title: '导出视频',
    subtitle: '命名预设、本地 FFmpeg 队列、无云端上传',
    close: '关闭导出弹窗',
    output: '输出',
    chooseOutputPath: '选择输出路径',
    preset: '预设',
    delete: '删除',
    saveAs: '另存为',
    customPresetName: '自定义预设名称',
    save: '保存',
    fields: {
      width: '宽度',
      height: '高度',
      fps: '帧率',
      format: '格式',
      videoBitrate: '视频码率',
      audioBitrate: '音频码率',
      subtitles: '字幕',
      scale: '缩放',
      targetAspectRatio: '目标比例',
      reframeOffsetX: '水平偏移',
      reframeOffsetY: '垂直偏移',
      hardwareEncoding: '硬件编码',
      loudnessNormalization: '响度标准化'
    },
    loudnessNormalization: {
      off: '关闭',
      youtube: 'YouTube -14 LUFS',
      'ebu-r128': 'EBU R128 广播 -23 LUFS'
    },
    watermark: {
      title: '水印',
      on: '已开启',
      off: '已关闭',
      enabled: '启用水印',
      type: '类型',
      types: {
        text: '文字',
        image: '图片'
      },
      imageFilter: 'PNG 水印',
      chooseImage: '选择 PNG',
      chooseImageFailed: '无法选择水印图片。',
      imagePath: 'PNG 文件',
      position: '位置',
      scalePercent: '宽度占比 %',
      opacity: '不透明度',
      text: '文字',
      fontFamily: '字体',
      color: '颜色',
      fontSize: '字号',
      defaultText: '水印',
      positions: {
        'top-left': '左上',
        'top-center': '上中',
        'top-right': '右上',
        'middle-left': '左中',
        center: '居中',
        'middle-right': '右中',
        'bottom-left': '左下',
        'bottom-center': '下中',
        'bottom-right': '右下'
      }
    },
    info: {
      resolution: '分辨率',
      fps: '帧率',
      format: '格式',
      bitrate: '码率',
      videoCodec: '视频编码',
      audioCodec: '音频编码',
      ffmpeg: 'FFmpeg',
      drawtext: 'Drawtext',
      hardwareEncoder: '硬件编码器',
      estimatedSize: '预估大小'
    },
    batchPaths: '批量路径',
    batchPlaceholder: '可选：每行一个输出路径',
    priority: '优先级',
    priorityOptions: {
      high: '高',
      normal: '普通',
      low: '低'
    },
    queueTitle: '导出队列',
    queueRunning: (count: number) => `最多 ${count} 个任务并行导出`,
    queuePausedForMemory: '可用内存低于 2GB，暂停启动新任务',
    maxConcurrent: '并发数',
    noTasks: '暂无导出任务。',
    historyTitle: '导出历史',
    noHistory: '暂无导出历史。',
    clearFinished: '清除已完成',
    addToQueue: '加入队列',
    cancelTask: '取消',
    openFolder: '打开文件夹',
    viewLog: '查看日志',
    retryTask: '重试',
    loudnessReport: (value: string) => `实际响度：${value} LUFS`,
    detectFfmpegFailed: '无法检测 FFmpeg。',
    loadPresetsFailed: '无法加载导出预设。',
    completeTitle: '导出完成',
    presetSavedTitle: '预设已保存',
    savePresetFailed: '无法保存预设。',
    presetDeletedTitle: '预设已删除',
    deletePresetFailed: '无法删除预设。',
    exportWarningTitle: '导出警告',
    queuedTitle: '已加入导出队列',
    queuedMessage: (count: number, presetName: string) => `${count} 个任务使用 ${presetName}。`,
    exportFailed: '无法导出视频。',
    preflight: {
      blockedTitle: '导出预检未通过',
      blockedMessage: '以下阻断项必须修复后才能加入导出队列。',
      warningTitle: '导出预检发现警告',
      warningMessage: '这些警告可能影响导出结果，可忽略后继续。',
      relink: '跳转重连',
      continue: '忽略警告继续',
      severity: {
        blocking: '阻断',
        warning: '警告'
      },
      issueTitle: {
        'missing-media': '缺失媒体',
        'missing-font': '缺失字体',
        'whisper-path': 'Whisper 路径无效',
        ffmpeg: 'FFmpeg 不可用'
      },
      missingMediaMessage: (count: number) => `时间线引用了 ${count} 个缺失媒体文件。`,
      missingFontMessage: (count: number) => `${count} 个字体未在系统中检测到，文字导出可能回退到默认字体。`,
      whisperMessage: '时间线包含字幕片段，但 Whisper 路径未配置或不可用。',
      ffmpegMessage: '未在 PATH 中检测到 FFmpeg，无法执行本地导出。'
    },
    exportFilterName: (extension: string) => `${extension.toUpperCase()} 导出`,
    framePngFilterName: 'PNG 图片',
    frameJpegFilterName: 'JPEG 图片',
    ffmpegDrawtextUnavailable: '当前 FFmpeg 不支持 drawtext/libfreetype。请安装包含 libfreetype 的 FFmpeg 版本以导出文字叠加。',
    hardwareEncodingFallback: '未检测到可用的 H.264 硬件编码器，将回退为软编码。',
    textClipSkippedDrawtext: (clipId: string) => `文字片段 ${clipId} 已跳过：FFmpeg drawtext/libfreetype 不可用。`,
    transitionSkippedVisualOnly: (transitionId: string) => `过渡 ${transitionId} 已跳过：两侧片段都必须是可视媒体。`,
    transitionSkippedChained: (transitionId: string) => `过渡 ${transitionId} 已跳过：单个导出片段暂不支持连续过渡。`,
    transitionSkippedMissingInput: (transitionId: string) => `过渡 ${transitionId} 已跳过：其中一个片段没有媒体输入。`,
    clipSkippedMissingMedia: (clipId: string) => `片段 ${clipId} 没有媒体路径，已跳过。`,
    speedRampSetptsFallback: (clipId: string) => `片段 ${clipId} 的变速曲线过长，已回退为平均速度导出。`,
    presetCopySuffix: '副本',
    status: {
      pending: '等待中',
      running: '导出中',
      success: '成功',
      error: '失败',
      canceled: '已取消'
    },
    options: {
      default: '默认',
      burnIn: '烧录字幕',
      softSub: '软字幕',
      none: '不缩放',
      fit: '适配留边',
      source: '原始比例',
      pngSequence: 'PNG 序列',
      gif: 'GIF 动图',
      webp: 'WebP 动图',
      apng: 'APNG'
    }
  },
  exportPresets: {
    customDescription: '自定义导出预设。',
    nameRequired: '请输入预设名称。',
    cannotDeleteBuiltin: '内置导出预设不能删除。',
    builtins: {
      web1080p: {
        name: 'Web 1080p',
        description: '用于本地审看和网页分享的全高清 MP4。'
      },
      fourK: {
        name: '4K',
        description: '用于高分辨率交付的 UHD MP4 导出。'
      },
      youtubeShorts: {
        name: 'YouTube Shorts',
        description: '9:16 竖屏 MP4，使用适配留边缩放。'
      },
      twitterX: {
        name: 'Twitter/X',
        description: '适合社交预览的紧凑 MP4。'
      },
      gif: {
        name: 'GIF 动图',
        description: '两遍调色板导出的循环 GIF，自动限制帧率和尺寸。'
      },
      webp: {
        name: 'WebP 动图',
        description: '使用 libwebp_anim 的本地 WebP 动图导出。'
      },
      apng: {
        name: 'APNG',
        description: '透明友好的 APNG 动图导出。'
      },
      audioM4a: {
        name: '仅音频 m4a',
        description: '无视频流的 AAC 音频导出。'
      }
    }
  },
  editorToasts: {
    projectSaved: '项目已保存',
    autosaveCheckFailed: '无法检查自动保存恢复',
    duplicateTitle: '已存在',
    duplicateMessage: (count: number) => `已跳过 ${count} 个重复文件。`,
    mediaImported: '媒体已导入',
    mediaImportedMessage: (count: number) => `已添加 ${count} 个文件。`,
    importFailed: '导入失败',
    importFailedMessage: '无法导入媒体。',
    subtitleImportFailed: '字幕导入失败',
    subtitleImportFailedMessage: '无法导入字幕。',
    noCompatibleTrack: '没有兼容轨道',
    noCompatibleTrackMessage: '请先添加匹配轨道，再放置该素材。',
    addClipFailed: '无法添加片段',
    addClipFailedMessage: '时间线拒绝了该片段。',
    mediaRelinked: '媒体已重连',
    relinkFailed: '重连失败',
    relinkFailedMessage: '无法重连媒体。',
    relinkMissingFailedMessage: '无法重连缺失媒体。',
    relinkComplete: '重连完成',
    relinkCompleteMessage: (count: number, warningCount: number) => `${count} 个缺失文件已重连。${warningCount > 0 ? ` ${warningCount} 个警告。` : ''}`,
    projectOpened: '项目已打开',
    openFailed: '打开失败',
    openFailedMessage: '无法打开项目。',
    splitUnavailable: '无法分割',
    splitUnavailableMessage: '请将播放头移动到片段内部。',
    multicamCreated: '多机位序列已创建',
    multicamCreateFailed: '无法创建多机位序列',
    multicamCreateFailedMessage: '请选择 2-8 个视频或图片片段。',
    currentFrameExported: '当前帧已导出',
    currentFrameExportFailed: '当前帧导出失败',
    currentFrameExportFailedMessage: '无法导出当前帧。',
    exportCanceled: '导出已取消',
    proxyReady: '代理已就绪',
    proxyFailed: '代理生成失败',
    proxyFailedMessage: '无法生成代理。',
    cacheCleared: '缓存已清除',
    cacheClearFailed: '清除缓存失败',
    cacheClearFailedMessage: '无法清除媒体缓存。',
    recoveryRestored: '恢复点已还原',
    recoveryFailed: '恢复失败',
    recoveryFailedMessage: '无法还原自动保存。',
    recoveryDiscarded: '恢复点已放弃',
    discardFailed: '放弃失败',
    discardFailedMessage: '无法放弃自动保存。',
    dropImportFailed: '拖放导入失败',
    dropImportFailedMessage: '无法导入拖放文件。',
    noSubtitlesFound: '未找到字幕',
    subtitlesImported: '字幕已导入',
    subtitlesImportedMessage: (count: number) => `已添加 ${count} 个字幕片段。`,
    subtitlesGenerated: (count: number) => `已生成 ${count} 个字幕片段。`,
    saveFailed: '保存失败',
    saveFailedMessage: '无法保存项目。'
  },
  whisper: {
    notConfigured: 'Whisper 路径未配置。',
    executableMissing: 'Whisper 可执行文件不存在。',
    modelMissing: 'Whisper 模型文件不存在。',
    noSubtitleCues: 'Whisper 未生成可用字幕。',
    progress: (progress: number) => `Whisper ${Math.round(progress * 100)}%`
  },
  projectFiles: {
    discardChanges: '放弃未保存的更改？',
    unsavedChanges: '未保存的更改',
    projectFilter: 'open-factory 项目',
    noBrowserAutosave: '没有可用的浏览器自动保存项目。',
    projectPathRequired: '保存项目需要项目路径。',
    autosaveDeleteFailed: '无法删除自动保存文件'
  },
  projectArchive: {
    title: '归档项目',
    copying: (copied: number, total: number) => `正在复制 ${copied}/${total}`,
    missingMediaConfirm: (count: number) => `${count} 个媒体文件缺失，继续归档将跳过这些文件，是否继续？`,
    success: '项目已归档',
    failed: '归档失败',
    failedMessage: '无法归档项目。'
  },
  mediaReport: {
    success: '素材报告已生成',
    failed: '素材报告生成失败',
    failedMessage: '无法生成素材报告。'
  },
  batchTranscode: {
    title: '批量转码',
    subtitle: '顺序处理本地视频文件，完成后自动导入转码结果。',
    chooseFiles: '选择文件',
    addFiles: '添加文件',
    sourceFiles: '源文件',
    noFiles: '选择要转码的视频文件。',
    format: '目标格式',
    start: '开始转码',
    removeFile: '移除',
    cancelTask: '取消任务',
    closeWhenDone: '关闭',
    selectFilesFirst: '请先选择文件。',
    completedToast: '转码完成',
    completedToastMessage: (count: number) => `已导入 ${count} 个转码结果。`,
    failedToast: '转码失败',
    failedMessage: '没有可导入的转码结果。',
    importFailed: '转码结果导入失败',
    presets: {
      'h264-720p': 'H.264 720p',
      'h264-1080p': 'H.264 1080p',
      'prores-proxy': 'ProRes 代理'
    },
    presetDescription: {
      'h264-720p': '最大 1280x720，H.264/AAC MP4。',
      'h264-1080p': '最大 1920x1080，H.264/AAC MP4。',
      'prores-proxy': '最大 1920x1080，ProRes Proxy MOV。'
    },
    status: {
      pending: '等待中',
      running: '转码中',
      completed: '完成',
      failed: '失败',
      canceled: '已取消'
    }
  },
  projectSnapshots: {
    saveTitle: '保存快照',
    nameLabel: '快照名称',
    defaultName: '未命名快照',
    save: '保存',
    historyTitle: '快照历史',
    empty: '没有项目快照。',
    refresh: '刷新',
    preview: '预览',
    restore: '恢复',
    delete: '删除',
    restoreCommand: '恢复项目快照',
    saved: '快照已保存',
    saveFailed: '快照保存失败',
    loadFailed: '快照读取失败',
    deleteFailed: '快照删除失败',
    restoreFailed: '快照恢复失败',
    restored: '快照已恢复',
    deleted: '快照已删除',
    snapshotCount: (count: number) => `${count} 个快照`,
    previewSummary: (name: string, tracks: number, media: number, duration: string) => `${name} · ${tracks} 条轨道 · ${media} 个素材 · ${duration}`,
    columns: {
      name: '名称',
      time: '时间',
      size: '大小'
    }
  },
  sharePackage: {
    title: '创建分享包',
    fileDialogFilter: '分享包',
    exporting: '正在导出 MP4',
    packing: (current: number, total: number) => `正在打包 ${current}/${total}`,
    success: '分享包已创建',
    failed: '分享包创建失败',
    failedMessage: '无法创建分享包。',
    exportFailed: '分享包导出失败。',
    exportCanceled: '分享包导出已取消。',
    cleanupFailed: '无法删除分享包临时导出文件。',
    readme: (projectName: string, projectFileName: string, exportPath: string) =>
      [
        `open-factory 分享包：${projectName}`,
        '',
        '内容：',
        `- ${projectFileName}：项目文件，媒体路径已相对化。`,
        '- media/：项目使用的本地媒体副本。',
        `- ${exportPath}：创建分享包时导出的 MP4。`,
        '',
        '打开方式：',
        '1. 解压此 zip 文件。',
        `2. 在 open-factory 中打开 ${projectFileName}。`,
        '3. 如需预览成片，可直接播放 export/ 目录中的 MP4。',
        '',
        '本包由本机生成，不包含云端同步或账号信息。'
      ].join('\n')
  },
  closeGuard: {
    message: '关闭前保存更改？',
    title: '未保存的更改',
    save: '保存',
    discard: '放弃',
    cancel: '取消',
    browserPrompt: '关闭前保存更改？请输入 save、discard 或 cancel。'
  },
  fileDialogs: {
    media: '媒体',
    videoMedia: '视频媒体',
    htmlReport: 'HTML 报告',
    subtitles: 'SubRip 字幕',
    whisperModel: 'Whisper 模型'
  },
  errors: {
    panelUnexpected: '面板发生意外错误。',
    panelCrashed: (name: string) => `${name} 已崩溃`,
    panelCouldNotRender: (name: string) => `${name} 无法渲染。`,
    reloadPanel: '重新加载面板',
    dismissToast: '关闭通知',
    unsupportedMediaType: (path: string) => `不支持的媒体类型：${path}`,
    videoMetadata: '无法读取视频元数据',
    audioMetadata: '无法读取音频元数据',
    imageMetadata: '无法读取图片元数据',
    mediaEventFailed: (eventName: string) => `媒体事件失败：${eventName}`,
    mediaJobFailed: '媒体任务失败。',
    proxyGenerationFailed: '代理生成失败。',
    proxyNotNeeded: '该媒体不需要代理文件。',
    webglPreviewUnavailable: 'WebGL 预览不可用。',
    webglBufferAllocationFailed: '无法分配 WebGL 缓冲区。',
    webglTextureAllocationFailed: '无法分配 WebGL 纹理。',
    webglProgramCreateFailed: '无法创建 WebGL 程序。',
    webglProgramLinkFailed: '无法链接 WebGL 程序。',
    webglProgramUniformsMissing: 'WebGL 程序缺少 uniform。',
    webglShaderCreateFailed: '无法创建 WebGL 着色器。',
    webglShaderCompileFailed: '无法编译 WebGL 着色器。',
    waveformDecodeUnavailable: 'Web Audio 解码不可用。',
    waveformWorkerFailed: '波形 worker 失败。',
    waveformGenerateFailed: '无法生成波形。',
    thumbnailOffscreenUnavailable: 'OffscreenCanvas 不可用。',
    thumbnailWorkerCanvasFailed: '无法创建时间线缩略图 worker 画布。',
    thumbnailRenderFailed: '无法渲染时间线缩略图。',
    relinkTypeChanged: (name: string) => `${name}：由于媒体类型变化，已跳过。`,
    exportNeedsVideo: '请先向时间线添加视频片段再导出。',
    ffmpegMissing: '未找到 ffmpeg。请使用 winget install ffmpeg、brew install ffmpeg 或 apt install ffmpeg 安装。',
    exportFailed: '无法导出视频。',
    silenceNeedsAudio: '静音检测需要音频或视频片段。',
    videoHasNoAudio: '该视频片段没有音频流。',
    webAudioUnavailable: 'Web Audio 解码不可用。',
    droppedPathsNotAuthorized: '拖放路径未授权'
  },
  panels: {
    editor: '编辑器',
    preview: '预览',
    inspector: '检查器',
    history: '历史',
    smartRoughCut: '智能粗剪',
    audioMixer: '音频混音器',
    timeline: '时间线'
  },
  autosaveRecovery: {
    title: '检测到未保存的恢复点，是否恢复？',
    discard: '放弃',
    restore: '恢复'
  }
} as const;

type DeepPartial<T> = T extends (...args: any[]) => any
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

type WidenLocale<T> = T extends (...args: infer Args) => infer Return
  ? (...args: Args) => Return
  : T extends string
    ? string
    : T extends number
      ? number
      : T extends boolean
        ? boolean
        : T extends object
          ? { readonly [K in keyof T]: WidenLocale<T[K]> }
          : T;

export type Language = 'zh' | 'en';
export type LocaleStrings = WidenLocale<typeof zh>;

const enOverrides = {
  common: {
    saved: 'Saved',
    unsavedChanges: 'Unsaved changes',
    idle: 'Idle',
    clear: 'Clear',
    close: 'Close',
    cancel: 'Cancel',
    retry: 'Retry',
    reset: 'Reset',
    unavailable: 'Unavailable',
    available: 'Available',
    missing: 'Missing',
    auto: 'Auto',
    none: 'None',
    secondsShort: 's',
    noVideo: 'No video',
    audioOnly: 'Audio only'
  },
  project: {
    defaultName: 'Untitled Project'
  },
  projectTemplates: {
    title: 'New From Template',
    subtitle: 'Choose a project starting point',
    select: 'Use Template',
    close: 'Close',
    templates: {
      verticalShort: { name: 'Vertical Short Video', description: '9:16, 30fps, 1080x1920' },
      youtubeHorizontal: { name: 'Horizontal YouTube', description: '16:9, 30fps, 1920x1080' },
      squareSocial: { name: 'Square Social', description: '1:1, 30fps, 1080x1080' },
      podcast: { name: 'Podcast', description: 'Audio-only tracks, exports to M4A' },
      cinema: { name: 'Cinema', description: '16:9, 24fps, 4K, LUT preset' }
    }
  },
  clips: {
    defaultTextName: 'Text',
    defaultTextContent: 'Title',
    defaultAdjustmentName: 'Adjustment Layer'
  },
  toolbar: {
    fileMenu: 'File',
    editMenu: 'Edit',
    toolsMenu: 'Tools',
    newProject: 'New Project',
    newFromTemplate: 'New From Template',
    openProject: 'Open Project',
    saveProject: 'Save Project',
    archiveProject: 'Archive Project',
    mediaReport: 'Media Report',
    createSharePackage: 'Create Share Package',
    batchTranscode: 'Batch Transcode',
    importMedia: 'Import Media',
    importSubtitles: 'Import Subtitles',
    exportVideo: 'Export Video',
    exportTimeline: 'Export Timeline',
    exportCurrentFrame: 'Export Current Frame',
    exportDisabled: 'Add media to the timeline first',
    settings: 'Settings',
    clearMediaCache: 'Clear Media Cache',
    autosaveInterval: 'Autosave Interval',
    autosave: 'Autosave',
    whisperExecutable: 'Whisper Executable',
    whisperModel: 'Whisper Model',
    chooseWhisperExecutable: 'Choose Whisper Executable',
    chooseWhisperModel: 'Choose Whisper Model File',
    undo: 'Undo',
    redo: 'Redo',
    history: 'History',
    splitSelectedClip: 'Split Selected Clip',
    smartRoughCut: 'Smart Rough Cut',
    createMulticamSequence: 'Create Multicam Sequence',
    play: 'Play',
    pause: 'Pause',
    cancelExport: 'Cancel Export',
    openExportFolder: 'Open Export Folder',
    localExport: 'Local Multitrack Export',
    projectHealthCheck: 'Project Health Check'
  },
  editMenu: {
    saveSnapshot: 'Save Snapshot',
    snapshotHistory: 'Snapshot History'
  },
  settings: {
    title: 'Settings',
    subtitle: 'Local preferences and libraries',
    tabs: {
      general: 'General',
      lutLibrary: 'LUT Library',
      shortcuts: 'Shortcuts',
      translation: 'Subtitle Translation',
      proxy: 'Proxy Media',
      plugins: 'Plugins'
    },
    general: {
      title: 'General',
      description: 'Configure interface language and local preferences.',
      language: 'Interface Language',
      languageDescription: 'The language is saved to the local settings file.',
      saveFailed: 'Language Save Failed',
      saveFailedMessage: 'Unable to write the settings file.',
      options: {
        zh: '中文',
        en: 'English'
      }
    },
    lutLibrary: {
      title: 'LUT Library',
      loading: 'Scanning LUTs...',
      empty: 'No .cube LUT files found in the configuration directory.',
      refresh: 'Refresh',
      preview: 'Preview',
      apply: 'Apply',
      favorite: 'Favorite',
      unfavorite: 'Unfavorite',
      applied: 'LUT applied',
      applyFailed: 'LUT apply failed',
      applyFailedMessage: 'Unable to apply this LUT.',
      favoriteFailed: 'Favorite failed',
      favoriteFailedMessage: 'Unable to update LUT favorites.',
      loadFailed: 'LUT library failed to load',
      loadFailedMessage: 'Unable to read LUTs from the configuration directory.',
      noClipSelected: 'No usable clip selected',
      noClipSelectedMessage: 'Select a video or image clip before previewing or applying a LUT.',
      readyForClip: (name: string) => `Will apply to ${name}`
    },
    shortcuts: {
      title: 'Shortcuts',
      description: 'Rebind timeline and export shortcuts.',
      pressKeys: 'Press keys...',
      resetAll: 'Reset All',
      saveFailed: 'Shortcut save failed',
      saveFailedMessage: 'Unable to write shortcut configuration.',
      loadFailed: 'Shortcut load failed',
      conflict: (keys: string) => `Conflict: ${keys}`,
      actions: {
        'toggle-playback': 'Play/Pause',
        'reverse-playback': 'Reverse Playback',
        'pause-playback': 'Pause',
        'forward-playback': 'Forward Playback',
        'step-back': 'Step Back',
        'step-forward': 'Step Forward',
        'set-in-point': 'Set In Point',
        'set-out-point': 'Set Out Point',
        'split-selected': 'Split Selected Clip',
        'delete-selected': 'Delete Selected Clip',
        'ripple-delete': 'Ripple Delete',
        'select-all': 'Select All Clips',
        'clear-selection': 'Clear Selection',
        'add-annotation': 'Add Annotation',
        undo: 'Undo',
        redo: 'Redo',
        save: 'Save Project',
        'export-current-frame': 'Export Current Frame'
      }
    },
    translation: {
      title: 'Subtitle Translation',
      description: 'Configure a locally saved translation API for copying subtitles to a new subtitle track.',
      provider: 'Provider',
      apiKey: 'API Key',
      targetLanguage: 'Target Language',
      keyStorageNote: 'The key is stored only on this device',
      localOnlyNote: 'Only subtitle text is sent; media files are not uploaded. The key stays in local browser storage.'
    },
    proxy: {
      title: 'Proxy Media',
      description: 'Automatically generate local H.264 proxy files. Export still uses original media.',
      resolution: 'Proxy Resolution',
      triggerThreshold: 'Trigger Threshold',
      thresholdOption: (value: number) => `Short edge > ${value}p`,
      reset: 'Reset Defaults'
    },
    plugins: {
      title: 'Plugins',
      description: 'Load trusted JS plugins from the local plugin directory. Hooks run in a worker.',
      refresh: 'Refresh',
      loading: 'Loading plugins...',
      empty: 'No plugins loaded.',
      builtin: 'Built-in',
      user: 'User',
      hooks: 'Hooks',
      permissions: 'Permissions',
      status: 'Status',
      errors: 'Errors',
      enable: 'Enable',
      disable: 'Disable',
      uninstall: 'Uninstall',
      noDescription: 'No description',
      builtinLocked: 'Built-in plugins cannot be uninstalled',
      enabledTitle: 'Plugin enabled',
      disabledTitle: 'Plugin disabled',
      uninstallFailed: 'Uninstall failed',
      uninstallFailedMessage: 'Unable to delete plugin file.',
      state: {
        enabled: 'Enabled',
        disabled: 'Disabled',
        error: 'Error'
      },
      permissionLabels: {
        'read-project': 'Read Project',
        'write-project': 'Write Project',
        'export-hook': 'Export Hook',
        'menu-register': 'Register Menu'
      },
      loadFailed: 'Plugin load failed',
      loadFailedMessage: 'Unable to read the plugin directory.'
    }
  },
  timelineExport: {
    title: 'Export Timeline',
    description: 'Export the main sequence as an interchange format.',
    format: 'Format',
    export: 'Export',
    exporting: 'Exporting...',
    success: 'Timeline exported',
    failed: 'Timeline export failed',
    failedMessage: 'Unable to export the timeline.',
    filterName: (format: string) => (format === 'fcp-xml' ? 'Final Cut Pro XML' : 'CMX3600 EDL'),
    formats: {
      edl: 'CMX3600 EDL',
      fcpXml: 'Final Cut Pro 7 XML'
    }
  },
  mediaBin: {
    title: 'Media',
    itemCount: (count: number) => `${count} assets`,
    relinkFolder: 'Relink Folder',
    import: 'Import',
    newAdjustmentLayer: 'New Adjustment Layer',
    batchTranscode: 'Batch Transcode',
    scanDuplicates: 'Scan Duplicates',
    searchPlaceholder: 'Search media',
    filters: {
      all: 'All',
      video: 'Video',
      audio: 'Audio',
      image: 'Image',
      tagged: 'Tagged',
      titles: 'Titles'
    },
    label: 'Label',
    clearLabel: 'Clear Label',
    labelColors: {
      red: 'Red',
      orange: 'Orange',
      yellow: 'Yellow',
      green: 'Green',
      blue: 'Blue',
      purple: 'Purple'
    },
    mediaJobs: 'Media Jobs',
    preparingQueue: 'Preparing queue',
    pendingCount: (count: number) => `${count} pending`,
    failedCount: (count: number) => `${count} failed`,
    emptyDrop: 'Drop media files here, or click import.',
    addToTimeline: 'Add to Timeline',
    relink: 'Relink',
    generateProxy: 'Generate Proxy',
    sequenceSuffix: 'Sequence',
    proxyStatus: {
      ready: 'Proxy ready',
      pending: 'Proxy queued',
      error: 'Proxy failed',
      recommended: 'Proxy recommended',
      notNeeded: 'Proxy not needed'
    },
    jobType: {
      proxy: 'Proxy',
      waveform: 'Waveform'
    },
    assetType: {
      video: 'Video',
      audio: 'Audio',
      image: 'Image'
    },
    titleTemplateCount: (count: number) => `${count} title templates`,
    addTitleTemplate: 'Add Title Template'
  },
  preview: {
    title: 'Preview',
    canvasSize: '1280 x 720 Canvas',
    colorScopes: 'Color Scopes',
    compareToggle: 'A/B Compare Preview',
    compareLeftRight: 'Left/Right Split Compare',
    compareTopBottom: 'Top/Bottom Split Compare',
    compareDifference: 'Difference Compare',
    compareDivider: 'Compare Divider',
    canvasEditMode: 'Canvas Edit Mode',
    canvasEditModeActive: 'Turn Off Canvas Edit Mode',
    transformAnchor: 'Center Anchor',
    rotateHandle: 'Rotate Handle',
    multicamGrid: 'Multicam Preview',
    multicamCutFailedTitle: 'Multicam cut failed',
    multicamCutFailedMessage: 'Unable to record this angle switch.',
    multicamAngle: (name: string) => `Cut to ${name}`,
    renderFailedTitle: 'Preview render failed',
    renderFailedMessage: 'Unable to draw preview.',
    missingMedia: (name: string) => `Missing media: ${name}`
  },
  scopes: {
    histogram: 'Histogram',
    waveform: 'Waveform',
    vectorscope: 'Vectorscope'
  },
  mixer: {
    title: 'Audio Mixer',
    master: 'Master',
    output: 'Output',
    muteTrack: 'Mute track',
    soloTrack: 'Solo track',
    volume: 'Volume',
    pan: 'Pan',
    expandChannel: 'Expand channel processing',
    collapseChannel: 'Collapse channel processing',
    eq: 'EQ',
    eqEnabled: 'Enable EQ',
    compressor: 'Compressor',
    compressorEnabled: 'Enable compressor',
    frequency: 'Frequency',
    gain: 'Gain',
    q: 'Q',
    threshold: 'Threshold',
    ratio: 'Ratio',
    attack: 'Attack',
    release: 'Release',
    makeupGain: 'Makeup',
    bandNames: {
      low: 'Low',
      lowMid: 'Low Mid',
      highMid: 'High Mid',
      high: 'High'
    }
  },
  timeline: {
    title: 'Timeline',
    subtitle: 'Drag clips, trim edges, split at the playhead',
    tracks: 'Tracks',
    renderCache: 'Cache',
    addVideoTrack: 'Add Video Track',
    addAudioTrack: 'Add Audio Track',
    addSubtitleTrack: 'Add Subtitle Track',
    addTextClip: 'Add Text Clip',
    addAdjustmentLayer: 'New Adjustment Layer',
    adjustmentTrackName: (index: number) => `Adjustment ${index}`,
    addMarker: 'Add Marker at Playhead',
    annotationMode: 'Annotation Mode',
    annotations: 'Annotations',
    annotationList: 'Annotation List',
    annotationListEmpty: 'No annotations',
    annotationLabel: (index: number) => `Annotation ${index}`,
    annotationNewTitle: 'Add Annotation',
    annotationEditTitle: 'Edit Annotation',
    annotationText: 'Annotation Text',
    annotationColor: 'Color',
    annotationSave: 'Save Annotation',
    annotationDelete: 'Delete Annotation',
    annotationJump: 'Jump',
    annotationRejectedTitle: 'Annotation rejected',
    addAnnotationFailed: 'Unable to add annotation.',
    updateAnnotationFailed: 'Unable to update annotation.',
    removeAnnotationFailed: 'Unable to delete annotation.',
    splitSelectedClip: 'Split Selected Clip',
    deleteSelectedClip: 'Delete Selected Clip',
    zoom: 'Timeline Zoom',
    inPoint: 'In Point',
    outPoint: 'Out Point',
    muteTrack: 'Mute Track',
    soloTrack: 'Solo Track',
    lockTrack: 'Lock Track',
    trackVolume: 'Track Volume',
    mediaMissing: 'Media file missing',
    sampledWaveform: 'Sampled waveform preview',
    waveform: 'Waveform preview',
    keyframeTitle: (property: string, time: number) => `${property} keyframe ${time.toFixed(2)}s`,
    transitionUnavailableTitle: 'Transition unavailable',
    transitionUnavailableMessage: 'Unable to add this transition.',
    noTextTrackTitle: 'No text track',
    noTextTrackMessage: 'Add a text track first.',
    markerLabel: (index: number) => `Marker ${index}`,
    markerRejectedTitle: 'Marker rejected',
    addMarkerFailed: 'Unable to add marker.',
    removeMarkerFailed: 'Unable to remove marker.',
    splitUnavailableTitle: 'Cannot split',
    splitUnavailableMessage: 'Move the playhead inside a clip.',
    clipOverlapTitle: 'Clip Overlap',
    clipOverlapMessage: 'This position overlaps another clip.',
    editRejectedTitle: 'Timeline Edit Rejected',
    editRejectedMessage: 'Unable to apply this edit.',
    closeGapAction: 'Close Gap',
    closeGapFailedTitle: 'Unable to close gap',
    addTransition: 'Add Transition',
    transitionType: 'Type',
    transitionDuration: 'Duration',
    transitionNames: {
      dissolve: 'Dissolve',
      'fade-black': 'Fade to Black'
    },
    add: 'Add',
    remove: 'Remove',
    close: 'Close',
    silenceAction: 'Auto-cut Silence',
    sceneAction: 'Split by Scene',
    generateSubtitlesAction: 'Generate Subtitles',
    timelineRejectedMessage: 'The timeline rejected this operation.',
    trackTypes: {
      video: 'Video',
      audio: 'Audio',
      text: 'Text',
      subtitle: 'Subtitle'
    },
    newTrackName: (type: string, index: number) => `${formatTrackType(type)} ${index}`
  },
  inspector: {
    multipleSelected: (count: number) => `Multiple clips selected (${count})`,
    empty: 'Select a clip to edit properties.',
    title: 'Inspector',
    subtitle: 'Clip properties',
    locked: 'Locked',
    sections: {
      clip: 'Clip',
      speed: 'Speed',
      transform: 'Transform',
      chromaKey: 'Chroma Key',
      masks: 'Masks',
      frameInterpolation: 'Frame Interpolation',
      stabilization: 'Stabilization',
      colorMatch: 'Color Match',
      imageSequence: 'PNG Sequence',
      keyframe: 'Keyframe',
      kenBurns: 'Ken Burns',
      audioDenoise: 'Denoise',
      curves: 'Curves',
      colorWheels: 'Color Wheels',
      effects: 'Effects',
      audio: 'Audio',
      subtitle: 'Subtitle',
      text: 'Text'
    },
    fields: {
      name: 'Name',
      start: 'Start',
      duration: 'Duration',
      speed: 'Speed',
      scale: 'Scale',
      scaleX: 'Scale X',
      scaleY: 'Scale Y',
      rotation: 'Rotation',
      opacity: 'Opacity',
      addEffect: 'Add Effect',
      effectType: 'Effect Type',
      enabled: 'Enabled',
      removeEffect: 'Remove Effect',
      moveEffectUp: 'Move Effect Up',
      moveEffectDown: 'Move Effect Down',
      radius: 'Radius',
      size: 'Size',
      strength: 'Strength',
      style: 'Style',
      height: 'Height',
      position: 'Position',
      sensitivity: 'Sensitivity',
      volume: 'Volume',
      pitchShift: 'Pitch Shift',
      semitones: 'semitones',
      reverseAudio: 'Reverse Audio',
      fadeIn: 'Fade In',
      fadeOut: 'Fade Out',
      fadeInCurve: 'Fade In Curve',
      fadeOutCurve: 'Fade Out Curve',
      text: 'Text',
      fontSize: 'Font Size',
      fontFamily: 'Font Family',
      color: 'Color'
    },
    effectNames: {
      blur: 'Gaussian Blur',
      sharpen: 'Sharpen',
      vignette: 'Vignette',
      'film-grain': 'Film Grain',
      'chromatic-aberration': 'Chromatic Aberration',
      'audio-spectrum': 'Audio Spectrum'
    },
    audioSpectrumStyles: {
      bars: 'Bars',
      waveform: 'Waveform',
      circle: 'Circle'
    },
    audioSpectrumPositions: {
      top: 'Top',
      bottom: 'Bottom'
    },
    missingFile: 'Missing file'
  },
  historyPanel: {
    title: 'Edit History',
    subtitle: 'Undo and redo states',
    empty: 'No history yet.',
    affectedClips: (count: number) => `${count} clips`,
    position: (position: number, total: number) => `Position ${position}/${total}`,
    jumpFailed: 'History Jump Failed',
    jumpFailedMessage: 'Unable to jump to that history state.'
  },
  exportDialog: {
    title: 'Export Video',
    subtitle: 'Named presets, local FFmpeg queue, no cloud upload',
    close: 'Close export dialog',
    output: 'Output',
    chooseOutputPath: 'Choose output path',
    preset: 'Preset',
    delete: 'Delete',
    saveAs: 'Save As',
    customPresetName: 'Custom preset name',
    save: 'Save',
    fields: {
      width: 'Width',
      height: 'Height',
      fps: 'Frame Rate',
      format: 'Format',
      videoBitrate: 'Video Bitrate',
      audioBitrate: 'Audio Bitrate',
      subtitles: 'Subtitles',
      scale: 'Scale',
      targetAspectRatio: 'Target Aspect Ratio',
      reframeOffsetX: 'Horizontal Offset',
      reframeOffsetY: 'Vertical Offset',
      hardwareEncoding: 'Hardware Encoding',
      loudnessNormalization: 'Loudness Normalization'
    },
    loudnessNormalization: {
      off: 'Off',
      youtube: 'YouTube -14 LUFS',
      'ebu-r128': 'EBU R128 Broadcast -23 LUFS'
    },
    watermark: {
      title: 'Watermark',
      on: 'On',
      off: 'Off',
      enabled: 'Enable Watermark',
      type: 'Type',
      types: {
        text: 'Text',
        image: 'Image'
      },
      imageFilter: 'PNG Watermark',
      chooseImage: 'Choose PNG',
      chooseImageFailed: 'Unable to choose watermark image.',
      imagePath: 'PNG File',
      position: 'Position',
      scalePercent: 'Width %',
      opacity: 'Opacity',
      text: 'Text',
      fontFamily: 'Font',
      color: 'Color',
      fontSize: 'Size',
      defaultText: 'Watermark',
      positions: {
        'top-left': 'Top Left',
        'top-center': 'Top Center',
        'top-right': 'Top Right',
        'middle-left': 'Middle Left',
        center: 'Center',
        'middle-right': 'Middle Right',
        'bottom-left': 'Bottom Left',
        'bottom-center': 'Bottom Center',
        'bottom-right': 'Bottom Right'
      }
    },
    info: {
      resolution: 'Resolution',
      fps: 'FPS',
      format: 'Format',
      bitrate: 'Bitrate',
      videoCodec: 'Video Codec',
      audioCodec: 'Audio Codec',
      ffmpeg: 'FFmpeg',
      drawtext: 'Drawtext',
      hardwareEncoder: 'Hardware Encoder',
      estimatedSize: 'Estimated Size'
    },
    batchPaths: 'Batch Paths',
    batchPlaceholder: 'Optional: one output path per line',
    priority: 'Priority',
    priorityOptions: {
      high: 'High',
      normal: 'Normal',
      low: 'Low'
    },
    queueTitle: 'Export Queue',
    queueRunning: (count: number) => `Up to ${count} concurrent exports`,
    queuePausedForMemory: 'Available memory is below 2GB; pausing new exports',
    maxConcurrent: 'Concurrency',
    noTasks: 'No export tasks.',
    historyTitle: 'Export History',
    noHistory: 'No export history.',
    clearFinished: 'Clear Finished',
    addToQueue: 'Add to Queue',
    cancelTask: 'Cancel',
    openFolder: 'Open Folder',
    viewLog: 'View Log',
    retryTask: 'Retry',
    queuedTitle: 'Added to export queue',
    queuedMessage: (count: number, presetName: string) => `${count} tasks using ${presetName}.`,
    exportFailed: 'Unable to export video.',
    exportFilterName: (extension: string) => `${extension.toUpperCase()} Export`,
    framePngFilterName: 'PNG Image',
    frameJpegFilterName: 'JPEG Image',
    presetCopySuffix: 'Copy',
    status: {
      pending: 'Pending',
      running: 'Exporting',
      success: 'Success',
      error: 'Failed',
      canceled: 'Canceled'
    },
    options: {
      default: 'Default',
      burnIn: 'Burn in',
      softSub: 'Soft subtitles',
      none: 'No scaling',
      fit: 'Fit with padding',
      source: 'Source aspect',
      pngSequence: 'PNG Sequence',
      gif: 'GIF',
      webp: 'WebP',
      apng: 'APNG'
    }
  },
  exportPresets: {
    customDescription: 'Custom export preset.',
    nameRequired: 'Enter a preset name.',
    cannotDeleteBuiltin: 'Built-in export presets cannot be deleted.',
    builtins: {
      web1080p: {
        name: 'Web 1080p',
        description: 'Full HD MP4 for local review and web sharing.'
      },
      fourK: {
        name: '4K',
        description: 'UHD MP4 export for high-resolution delivery.'
      },
      youtubeShorts: {
        name: 'YouTube Shorts',
        description: '9:16 vertical MP4 with fit padding.'
      },
      twitterX: {
        name: 'Twitter/X',
        description: 'Compact MP4 for social previews.'
      },
      gif: {
        name: 'GIF',
        description: 'Looping GIF exported with a two-pass palette.'
      },
      webp: {
        name: 'WebP',
        description: 'Local animated WebP export using libwebp_anim.'
      },
      apng: {
        name: 'APNG',
        description: 'Transparency-friendly animated PNG export.'
      },
      audioM4a: {
        name: 'Audio-only m4a',
        description: 'AAC audio export without a video stream.'
      }
    }
  },
  editorToasts: {
    projectSaved: 'Project saved',
    autosaveCheckFailed: 'Unable to check autosave recovery',
    duplicateTitle: 'Already exists',
    duplicateMessage: (count: number) => `Skipped ${count} duplicate files.`,
    mediaImported: 'Media imported',
    mediaImportedMessage: (count: number) => `Added ${count} files.`,
    importFailed: 'Import failed',
    importFailedMessage: 'Unable to import media.',
    subtitleImportFailed: 'Subtitle import failed',
    subtitleImportFailedMessage: 'Unable to import subtitles.',
    noCompatibleTrack: 'No compatible track',
    noCompatibleTrackMessage: 'Add a matching track before placing this asset.',
    addClipFailed: 'Unable to add clip',
    addClipFailedMessage: 'The timeline rejected this clip.',
    mediaRelinked: 'Media relinked',
    relinkFailed: 'Relink failed',
    relinkFailedMessage: 'Unable to relink media.',
    projectOpened: 'Project opened',
    openFailed: 'Open failed',
    openFailedMessage: 'Unable to open project.',
    splitUnavailable: 'Cannot split',
    splitUnavailableMessage: 'Move the playhead inside a clip.',
    multicamCreated: 'Multicam sequence created',
    multicamCreateFailed: 'Unable to create multicam sequence',
    currentFrameExported: 'Current frame exported',
    currentFrameExportFailed: 'Current frame export failed',
    currentFrameExportFailedMessage: 'Unable to export current frame.',
    exportCanceled: 'Export canceled',
    proxyReady: 'Proxy ready',
    proxyFailed: 'Proxy generation failed',
    proxyFailedMessage: 'Unable to generate proxy.',
    cacheCleared: 'Cache cleared',
    cacheClearFailed: 'Cache clear failed',
    cacheClearFailedMessage: 'Unable to clear media cache.',
    saveFailed: 'Save failed',
    saveFailedMessage: 'Unable to save project.'
  },
  projectFiles: {
    discardChanges: 'Discard unsaved changes?',
    unsavedChanges: 'Unsaved Changes',
    projectFilter: 'open-factory Project',
    noBrowserAutosave: 'No browser autosave project is available.',
    projectPathRequired: 'A project path is required to save.',
    autosaveDeleteFailed: 'Unable to delete autosave file'
  },
  projectArchive: {
    title: 'Archive Project',
    copying: (copied: number, total: number) => `Copying ${copied}/${total}`,
    missingMediaConfirm: (count: number) => `${count} media files are missing. Continuing will skip them. Continue?`,
    success: 'Project archived',
    failed: 'Archive failed',
    failedMessage: 'Unable to archive project.'
  },
  mediaReport: {
    success: 'Media report generated',
    failed: 'Media report failed',
    failedMessage: 'Unable to generate the media report.'
  },
  batchTranscode: {
    title: 'Batch Transcode',
    subtitle: 'Process local video files sequentially and import the transcoded results.',
    chooseFiles: 'Choose Files',
    addFiles: 'Add Files',
    sourceFiles: 'Source Files',
    noFiles: 'Choose video files to transcode.',
    format: 'Target Format',
    start: 'Start Transcode',
    removeFile: 'Remove',
    cancelTask: 'Cancel Task',
    closeWhenDone: 'Close',
    selectFilesFirst: 'Choose files first.',
    completedToast: 'Transcode complete',
    completedToastMessage: (count: number) => `Imported ${count} transcoded files.`,
    failedToast: 'Transcode failed',
    failedMessage: 'No transcoded results were available to import.',
    importFailed: 'Transcoded result import failed',
    presets: {
      'h264-720p': 'H.264 720p',
      'h264-1080p': 'H.264 1080p',
      'prores-proxy': 'ProRes Proxy'
    },
    presetDescription: {
      'h264-720p': 'Maximum 1280x720 H.264/AAC MP4.',
      'h264-1080p': 'Maximum 1920x1080 H.264/AAC MP4.',
      'prores-proxy': 'Maximum 1920x1080 ProRes Proxy MOV.'
    },
    status: {
      pending: 'Pending',
      running: 'Transcoding',
      completed: 'Completed',
      failed: 'Failed',
      canceled: 'Canceled'
    }
  },
  projectSnapshots: {
    saveTitle: 'Save Snapshot',
    nameLabel: 'Snapshot Name',
    defaultName: 'Untitled Snapshot',
    save: 'Save',
    historyTitle: 'Snapshot History',
    empty: 'No project snapshots.',
    refresh: 'Refresh',
    preview: 'Preview',
    restore: 'Restore',
    delete: 'Delete',
    restoreCommand: 'Restore Project Snapshot',
    saved: 'Snapshot saved',
    saveFailed: 'Snapshot save failed',
    loadFailed: 'Snapshot read failed',
    deleteFailed: 'Snapshot delete failed',
    restoreFailed: 'Snapshot restore failed',
    restored: 'Snapshot restored',
    deleted: 'Snapshot deleted',
    snapshotCount: (count: number) => `${count} snapshots`,
    previewSummary: (name: string, tracks: number, media: number, duration: string) => `${name} · ${tracks} tracks · ${media} media · ${duration}`,
    columns: {
      name: 'Name',
      time: 'Time',
      size: 'Size'
    }
  },
  sharePackage: {
    title: 'Create Share Package',
    fileDialogFilter: 'Share Package',
    exporting: 'Exporting MP4',
    packing: (current: number, total: number) => `Packing ${current}/${total}`,
    success: 'Share package created',
    failed: 'Share package failed',
    failedMessage: 'Unable to create the share package.',
    exportFailed: 'Share package export failed.',
    exportCanceled: 'Share package export canceled.',
    cleanupFailed: 'Unable to remove temporary share package export.',
    readme: (projectName: string, projectFileName: string, exportPath: string) =>
      [
        `open-factory share package: ${projectName}`,
        '',
        'Contents:',
        `- ${projectFileName}: project file with relative media paths.`,
        '- media/: local copies of media used by the project.',
        `- ${exportPath}: MP4 exported while creating this package.`,
        '',
        'How to open:',
        '1. Extract this zip file.',
        `2. Open ${projectFileName} in open-factory.`,
        '3. To preview the rendered video, play the MP4 in export/.',
        '',
        'This package is generated locally and does not include cloud sync or account data.'
      ].join('\n')
  },
  closeGuard: {
    message: 'Save changes before closing?',
    title: 'Unsaved Changes',
    save: 'Save',
    discard: 'Discard',
    cancel: 'Cancel',
    browserPrompt: 'Save changes before closing? Enter save, discard, or cancel.'
  },
  fileDialogs: {
    media: 'Media',
    videoMedia: 'Video Media',
    htmlReport: 'HTML Report',
    subtitles: 'SubRip Subtitles',
    whisperModel: 'Whisper Model'
  },
  errors: {
    panelUnexpected: 'Unexpected panel error.',
    panelCrashed: (name: string) => `${name} crashed`,
    panelCouldNotRender: (name: string) => `${name} could not render.`,
    reloadPanel: 'Reload Panel',
    unsupportedMediaType: (path: string) => `Unsupported media type: ${path}`,
    videoMetadata: 'Unable to read video metadata',
    audioMetadata: 'Unable to read audio metadata',
    imageMetadata: 'Unable to read image metadata',
    mediaEventFailed: (eventName: string) => `Media event failed: ${eventName}`,
    mediaJobFailed: 'Media job failed.',
    proxyGenerationFailed: 'Proxy generation failed.',
    proxyNotNeeded: 'This media does not need a proxy file.',
    exportNeedsVideo: 'Add a video clip to the timeline before exporting.',
    ffmpegMissing: 'ffmpeg was not found. Install it with winget install ffmpeg, brew install ffmpeg, or apt install ffmpeg.',
    exportFailed: 'Unable to export video.',
    silenceNeedsAudio: 'Silence detection requires an audio or video clip.',
    videoHasNoAudio: 'This video clip has no audio stream.',
    webAudioUnavailable: 'Web Audio decoding is unavailable.',
    droppedPathsNotAuthorized: 'Dropped paths were not authorized'
  },
  panels: {
    editor: 'Editor',
    preview: 'Preview',
    inspector: 'Inspector',
    history: 'History',
    smartRoughCut: 'Smart Rough Cut',
    audioMixer: 'Audio Mixer',
    timeline: 'Timeline'
  },
  autosaveRecovery: {
    title: 'Unsaved recovery point detected. Restore it?',
    discard: 'Discard',
    restore: 'Restore'
  }
} satisfies DeepPartial<LocaleStrings>;

export const locales: Record<Language, LocaleStrings> = {
  zh,
  en: mergeLocale<LocaleStrings>(zh, enOverrides)
};

let currentLanguage: Language = languageFromNavigator(typeof navigator === 'undefined' ? undefined : navigator.language);
const languageListeners = new Set<() => void>();

export function t<T = string>(key: string): T {
  const segments = key.split('.').filter(Boolean);
  const value = resolveLocalePath(currentLanguage, segments) ?? resolveLocalePath('zh', segments);
  return (value ?? key) as T;
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(language: string): Language {
  const next = normalizeLanguage(language);
  if (next === currentLanguage) {
    return currentLanguage;
  }
  currentLanguage = next;
  for (const listener of languageListeners) {
    listener();
  }
  return currentLanguage;
}

export function subscribeLanguage(listener: () => void): () => void {
  languageListeners.add(listener);
  return () => {
    languageListeners.delete(listener);
  };
}

export function normalizeLanguage(language: string | undefined): Language {
  const value = language?.trim().toLowerCase();
  return value === 'en' || value?.startsWith('en-') ? 'en' : 'zh';
}

export function languageFromNavigator(language: string | undefined): Language {
  return normalizeLanguage(language);
}

const localeProxyCache = new Map<string, unknown>();
export const zhCN = createLocaleProxy([]) as LocaleStrings;

export function formatTrackType(type: string): string {
  if (type === 'video') {
    return t('timeline.trackTypes.video');
  }
  if (type === 'audio') {
    return t('timeline.trackTypes.audio');
  }
  if (type === 'text') {
    return t('timeline.trackTypes.text');
  }
  if (type === 'subtitle') {
    return t('timeline.trackTypes.subtitle');
  }
  return type;
}

function mergeLocale<T>(base: T, overrides: DeepPartial<T> | undefined): T {
  if (!overrides || typeof base !== 'object' || base === null || typeof base === 'function') {
    return (overrides ?? base) as T;
  }
  const output: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
    const baseValue = (base as Record<string, unknown>)[key];
    output[key] =
      value && typeof value === 'object' && typeof value !== 'function' && baseValue && typeof baseValue === 'object' && typeof baseValue !== 'function'
        ? mergeLocale(baseValue, value as DeepPartial<typeof baseValue>)
        : value;
  }
  return output as T;
}

function resolveLocalePath(language: Language, path: string[]): unknown {
  let value: unknown = locales[language];
  for (const segment of path) {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function createLocaleProxy(path: string[]): unknown {
  const cacheKey = path.join('.');
  const cached = localeProxyCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const proxy = new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property === 'symbol') {
          return undefined;
        }
        const nextPath = [...path, property];
        const value = resolveLocalePath(currentLanguage, nextPath) ?? resolveLocalePath('zh', nextPath);
        return isProxyableLocaleValue(value) ? createLocaleProxy(nextPath) : value;
      },
      ownKeys() {
        const value = resolveLocalePath(currentLanguage, path) ?? resolveLocalePath('zh', path);
        return isProxyableLocaleValue(value) ? Reflect.ownKeys(value) : [];
      },
      getOwnPropertyDescriptor(_target, property) {
        if (typeof property === 'symbol') {
          return undefined;
        }
        const value = resolveLocalePath(currentLanguage, [...path, property]) ?? resolveLocalePath('zh', [...path, property]);
        return value === undefined ? undefined : { enumerable: true, configurable: true };
      }
    }
  );
  localeProxyCache.set(cacheKey, proxy);
  return proxy;
}

function isProxyableLocaleValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}
