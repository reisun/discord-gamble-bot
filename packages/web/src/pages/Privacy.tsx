export default function Privacy() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', lineHeight: 1.8 }}>
      <h2>プライバシーポリシー</h2>

      <section>
        <h3>1. 取得する情報</h3>
        <p>本サービスは、Discord との連携を通じて以下の情報を取得します。</p>

        <h4>ユーザー情報（usersテーブルに保存）</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>情報</th>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>取得タイミング</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ padding: '4px 8px' }}>Discord ユーザーID</td><td style={{ padding: '4px 8px' }}>Bot コマンド使用時（賭けの実行など）</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>表示名</td><td style={{ padding: '4px 8px' }}>同上</td></tr>
            <tr><td style={{ padding: '4px 8px' }}>アバター画像URL</td><td style={{ padding: '4px 8px' }}>同上</td></tr>
          </tbody>
        </table>
        <p>これらは1つのテーブル（users）に集約して管理されており、削除対象の明確化と一括処理を可能にしています。</p>

        <h4>認証情報（sessionsテーブルに一時保存）</h4>
        <p>Discord OAuth2 によるログイン時に、Discord ユーザーID と表示名がセッション情報として一時的に保存されます。セッションは48時間で期限切れとなり、期限切れ後に自動削除されます。</p>

        <h4>サーバー情報（guildsテーブルに保存）</h4>
        <p>サーバーID、サーバー名、サーバーアイコンは Bot がサーバーに参加している間保持されます。</p>
      </section>

      <section>
        <h3>2. 用途</h3>
        <p>取得した情報は、以下の目的にのみ使用します。</p>
        <ul>
          <li>ゲーム画面やランキングでのユーザー表示（表示名・アバター）</li>
          <li>Discord OAuth2 によるログインとアクセス制御（ユーザーID）</li>
          <li>サーバーごとのイベント管理とダッシュボード表示（サーバー情報）</li>
        </ul>
        <p>取得した情報を第三者に提供・販売することはありません。</p>
      </section>

      <section>
        <h3>3. 保存期間と削除</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>対象</th>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>保存期間</th>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>削除方法</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '4px 8px' }}>ユーザー情報<br /><small style={{ color: 'var(--color-text-muted)' }}>Discord ID・表示名・アバターURL</small></td>
              <td style={{ padding: '4px 8px' }}>登録から2週間</td>
              <td style={{ padding: '4px 8px' }}>Discord ID は匿名化、表示名・アバターURL は削除</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px' }}>セッション情報<br /><small style={{ color: 'var(--color-text-muted)' }}>Discord ID・表示名</small></td>
              <td style={{ padding: '4px 8px' }}>48時間</td>
              <td style={{ padding: '4px 8px' }}>期限切れ後にレコードごと削除</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px' }}>イベント関連データ<br /><small style={{ color: 'var(--color-text-muted)' }}>ゲーム・賭け・ポイント履歴・借金履歴</small></td>
              <td style={{ padding: '4px 8px' }}>全参加ユーザーの情報削除後</td>
              <td style={{ padding: '4px 8px' }}>イベントと関連データを一括削除</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px' }}>サーバー情報</td>
              <td style={{ padding: '4px 8px' }}>Bot がサーバーに参加している間</td>
              <td style={{ padding: '4px 8px' }}>-</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 8 }}>削除処理はサーバー起動時および24時間ごとに自動実行されます。</p>
      </section>

      <section>
        <h3>4. お問い合わせ</h3>
        <p>本ポリシーに関するご質問は、Discord サーバーの管理者にお問い合わせください。</p>
      </section>

      <p style={{ marginTop: 32, fontSize: '12px', color: 'var(--color-text-muted)' }}>
        最終更新: 2026年4月12日
      </p>
    </div>
  );
}
