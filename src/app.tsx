import React, { useEffect } from 'react';
import Taro, { useDidShow, useDidHide } from '@tarojs/taro';
import { CLOUD_ENV_ID } from '@/constants/app';
import './app.scss';

function App(props) {
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') {
      Taro.cloud.init({ env: CLOUD_ENV_ID, traceUser: true });
    }
  }, []);

  useDidShow(() => {});
  useDidHide(() => {});

  return props.children;
}

export default App;
