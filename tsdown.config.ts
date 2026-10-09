import { defineConfig } from 'tsdown'

/**
 * 平台模块表（对齐 dsh 0.2 web 客户端 PLATFORM_MODULES）：这些 import 由加载器
 * 注入的 require 解析，构建时保持 external；其余依赖一律内联进 client.js。
 */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
] as const

export default defineConfig([
  {
    name: 'dsh-agent-team-plus/client',
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    external: [...CLIENT_EXTERNALS],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    noExternal: (id: string) => (CLIENT_EXTERNALS as readonly string[]).includes(id) ? undefined : true,
    outputOptions: {
      entryFileNames: 'client.js',
      // 加载器只 serve 单个 /plugins/<id>/client.js，必须单文件
      inlineDynamicImports: true,
      banner: 'window.__ModuleLoader__.load({ id: "@dsh-community/dsh-agent-team-plus", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
