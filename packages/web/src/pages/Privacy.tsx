export default function Privacy() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', lineHeight: 1.8 }}>
      <h2>プライバシーポリシー</h2>

      <section>
        <h3>1. Discordから取得する情報</h3>
        <p>本サービスは、Discord Bot を通じて以下の情報を取得します。</p>
        <ul>
          <li><strong>ユーザー情報</strong>: Discord ユーザーID、表示名、アバター画像URL</li>
          <li><strong>サーバー情報</strong>: サーバーID、サーバー名、サーバーアイコン</li>
        </ul>
        <p>これらの情報は、ユーザーが Bot コマンド（賭けの実行など）を使用した際に取得されます。</p>
      </section>

      <section>
        <h3>2. 用途</h3>
        <p>取得した情報は、以下の目的にのみ使用します。</p>
        <ul>
          <li>ゲーム画面やランキングでのユーザー表示（表示名・アバター）</li>
          <li>サーバーごとのイベント管理（サー���ーID）</li>
          <li>Web管理画面でのサー���ー識別（サーバー名・アイコン）</li>
        </ul>
        <p>取得した情報を第三者に提供・販売することはありません。</p>
      </section>

      <section>
        <h3>3. 保存期間</h3>
        <p>
          ユーザー情報（表示名・アバターURL）は、<strong>登録から2週間後</strong>に自動削除されます。
        </p>
        <p>
          ユーザー情報が削除されたイベントの関連データ（ゲーム、賭け、ポイント履歴、借金履歴）も自動的に削除されます。
        </p>
        <p>サーバー情報（サーバーID・サーバー名）は、Bot がサーバーに参加している間保持されます。</p>
      </section>

      <section>
        <h3>4. 削除方針</h3>
        <ul>
          <li>ユーザーの表示名・アバターURLは登録から2週間後に自動削除されます</li>
          <li>全参加ユーザーの個人情報が削除されたイベントとその関連データも自動削除されます</li>
          <li>削除処理はサーバー起動時および24時間ごとに自動実行されます</li>
        </ul>
      </section>

      <section>
        <h3>5. お問い合わせ</h3>
        <p>本ポリシーに関するご質問は、Discord サーバーの管理者にお問い合わせください。</p>
      </section>

      <p style={{ marginTop: 32, fontSize: '12px', color: 'var(--color-text-muted)' }}>
        最終更新: 2026年4月11日
      </p>
    </div>
  );
}
