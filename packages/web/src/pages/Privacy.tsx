import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import privacyMd from './privacy.md?raw';

export default function Privacy() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', lineHeight: 1.8 }} className="markdown-body">
      <Markdown remarkPlugins={[remarkGfm]}>{privacyMd}</Markdown>
      <p style={{ marginTop: 32, fontSize: '12px', color: 'var(--color-text-muted)' }}>
        最終更新: 2026年4月12日
      </p>
    </div>
  );
}
