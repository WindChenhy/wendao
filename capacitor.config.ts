import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wendao.app',
  appName: '问道',
  webDir: 'dist',
  // 深色像素风：避免启动与切换面板时 WebView 白闪
  backgroundColor: '#1a1a1a',
  // 游戏排版依赖固定视口，禁止双指缩放
  zoomEnabled: false,
  android: {
    backgroundColor: '#1a1a1a',
  },
  // 启动画面由 android 侧主题接管（styles.xml 的 Theme.SplashScreen + splash.png），
  // 无需运行时控制；如需调整时长/淡出再安装 @capacitor/splash-screen 并在此配置。
};

export default config;
