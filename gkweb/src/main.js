import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import './assets/main.css'

// 创建Vue应用实例
const app = createApp(App)

// 注册Pinia状态管理
const pinia = createPinia()
app.use(pinia)

// 注册Element Plus组件库
app.use(ElementPlus)

// 全局错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('全局错误:', err)
  // 这里可以添加错误上报逻辑
}

// 挂载应用
app.mount('#app')

// 开发环境调试配置
if (import.meta.env.DEV) {
  // 添加全局变量方便调试
  window.__VUE_APP__ = app
}