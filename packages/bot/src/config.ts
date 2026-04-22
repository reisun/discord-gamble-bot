/** 環境変数を読み込んで型付きで公開する */
export const config = {
  discordToken: process.env.DISCORD_TOKEN ?? '',
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://server:3000',
  /** 管理者用 Webアプリの公開 URL */
  webAppBaseUrl: process.env.WEB_APP_BASE_URL ?? '',
};
