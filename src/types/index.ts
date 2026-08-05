// 用户信息
export interface UserInfo {
  _id?: string;
  _openid?: string;
  nickname: string;
  avatar: string;
  phone: string;
  isAdmin: boolean;
  createTime?: string;
}

// 服务项目
export interface ServiceItem {
  _id: string;
  name: string;
  categoryId: string;
  category?: string;
  categoryName?: string;
  priceMin: number;
  price?: number;
  priceMax?: number;
  duration: number;
  description: string;
  image: string;
  isActive: boolean;
  sortOrder: number;
}

// 服务分类
export interface ServiceCategory {
  _id: string;
  key: string;
  label: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

// 可预约时段
export interface TimeSlot {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  maxCount: number;
  bookedCount: number;
  isAvailable: boolean;
}

// 预约状态
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

// 预约记录
export interface Appointment {
  _id: string;
  _openid?: string;
  userId: string;
  serviceId: string;
  serviceName: string;
  servicePrice: string;
  date: string;
  timeSlot: string;
  status: AppointmentStatus;
  customerName: string;
  phone: string;
  carModel: string;
  remark: string;
  createTime: string;
  userInfo?: {
    nickname: string;
    avatar: string;
  };
}

// 预约表单
export interface AppointmentForm {
  serviceId: string;
  date: string;
  timeSlot: string;
  customerName: string;
  phone: string;
  carModel: string;
  remark: string;
}

export interface AvailableDate {
  date: string;
  availableCount: number;
}

export interface AppointmentCreateResult {
  _id: string;
  status: AppointmentStatus;
  serviceName: string;
  date: string;
  timeSlot: string;
}
