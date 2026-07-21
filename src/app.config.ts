export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/booking/index',
    'pages/mine/index',
    'pages/serviceDetail/index',
    'pages/admin/index',
    'pages/adminServices/index',
    'pages/adminTimeSlots/index',
    'pages/adminAppointments/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#0F0F1A',
    navigationBarTitleText: '小亮云办公',
    navigationBarTextStyle: 'white'
  },
  tabBar: {
    color: '#6B7280',
    selectedColor: '#FF6B35',
    backgroundColor: '#1A1A2E',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页'
      },
      {
        pagePath: 'pages/booking/index',
        text: '预约'
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的'
      }
    ]
  }
})
