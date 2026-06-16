import { describe, expect, it } from 'vitest';
import { buildProjectDocumentationHtml, renderSimpleMarkdown, serializeProject, migrateProjectFile } from '../src';
import { makeProject } from './test-utils';

describe('project documentation', () => {
  it('renders basic markdown headings bold italic lists and code blocks', () => {
    const html = renderSimpleMarkdown(['# 标题', '', '**粗体** 和 *斜体*', '', '- A', '- B', '', '```', '<code>', '```'].join('\n'));

    expect(html).toContain('<h1>标题</h1>');
    expect(html).toContain('<strong>粗体</strong>');
    expect(html).toContain('<em>斜体</em>');
    expect(html).toContain('<ul><li>A</li><li>B</li></ul>');
    expect(html).toContain('<pre><code>&lt;code&gt;</code></pre>');
  });

  it('persists documentation through project serialization and migration', () => {
    const project = makeProject();
    project.documentation = { description: '# 项目', notes: '制作备注' };

    const file = serializeProject(project);
    expect(file.project.documentation).toEqual({ description: '# 项目', notes: '制作备注' });
    expect(migrateProjectFile(file).project.documentation).toEqual({ description: '# 项目', notes: '制作备注' });

    delete file.project.documentation;
    expect(migrateProjectFile(file).project.documentation).toEqual({});
  });

  it('exports project documentation as standalone HTML', () => {
    const project = makeProject();
    project.name = 'Doc Project';
    project.documentation = { description: '# 项目说明', approvals: '- 通过' };

    const html = buildProjectDocumentationHtml(project);

    expect(html).toContain('<title>Doc Project - 项目文档</title>');
    expect(html).toContain('data-section="description"');
    expect(html).toContain('<h1>项目说明</h1>');
    expect(html).toContain('data-section="approvals"');
    expect(html).toContain('<li>通过</li>');
  });
});
