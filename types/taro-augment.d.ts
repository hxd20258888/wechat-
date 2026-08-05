/**
 * @tarojs/taro@4.1.9 的类型定义缺少微信 showModal 可编辑弹窗相关字段
 * （微信端运行时不缺，仅类型缺口），在此做模块声明增强。
 * 注意：文件必须保持模块化（export {}），否则 declare module 会遮蔽原包类型。
 */
export {}

declare module '@tarojs/taro' {
  namespace showModal {
    interface Option {
      /** 是否显示输入框 */
      editable?: boolean
      /** 输入框提示文本 */
      placeholderText?: string
    }

    interface SuccessCallbackResult {
      /** editable 为 true 时，用户输入的内容 */
      content?: string
    }
  }
}
