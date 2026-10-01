// ============ 基础角色与用户 ============
export type Role = 'parent' | 'staff' | 'volunteer' | 'charity'

export interface User {
  id: string
  username: string
  password: string
  name: string
  role: Role
  phone?: string
  childName?: string
  childAge?: number
  orgName?: string
}

// ============ 物品 ============
export type Category =
  | 'toy' | 'book' | 'clothing' | 'study' | 'baby' // 可交换品类
  | 'dangerous' | 'food' | 'medicine' | 'privacy'  // 禁入品类（审核驳回）

export type Condition = 'new' | 'like_new' | 'good' | 'fair'

export type ItemStatus =
  | 'pending'      // 待审核
  | 'approved'     // 审核通过，待撮合
  | 'rejected'     // 已驳回
  | 'matched'      // 已撮合，待双方确认
  | 'reserved'     // 双方确认，已预约摊位与入场时间
  | 'free_zone'    // 未匹配，进入自由交换区
  | 'arrived'      // 已到场（扫码登记）
  | 'verified'     // 核销通过
  | 'exchanged'    // 交换成功
  | 'no_exchange'  // 无人交换
  | 'donated'      // 已转捐（已生成交接清单）
  | 'taken_back'   // 已带回
  | 'parent_confirm' // 公益机构破损拒收，等待家长确认去向
  | 'stored_community' // 超承接上限，寄存到社区
  | 'next_event'   // 已预约下一场活动
  | 'recycled'     // 环保回收
  | 'no_show'      // 未到场
  | 'disputed'     // 争议/异常处理中

export interface HistoryEntry {
  at: number
  actor: string
  action: string
  detail?: string
}

export interface ReviewRecord {
  by: string
  at: number
  result: 'approved' | 'rejected'
  reason?: string
}

export interface CheckInRecord {
  at: number
  by: string
  photoMatch: boolean
  damage: 'none' | 'minor' | 'severe'
  disinfectedConfirmed: boolean
  note?: string
  passed: boolean
}

/** 物品终态去向（公益承接上限 / 破损拒收后的现场处置） */
export type DisposalType = 'take_back' | 'store_community' | 'next_event' | 'recycle'

export interface DisposalRecord {
  type: DisposalType
  /** 现场处理人（家长本人 / 志愿者 / 社区工作人员） */
  handler: string
  handlerRole: Role
  /** 回收渠道 / 社区寄存点等说明 */
  channel?: string
  note?: string
  /** 关联异常单 */
  incidentId?: string
  at: number
}

export interface Item {
  id: string
  code: string
  parentId: string
  name: string
  category: Category
  condition: Condition
  /** dataURL 或 emoji 占位 */
  photos: string[]
  disinfected: boolean
  desiredCategories: Category[]
  valueRange: [number, number]
  ageRange: [number, number]
  timeSlots: string[]
  acceptDonation: boolean
  note?: string
  status: ItemStatus
  review?: ReviewRecord
  booth?: string
  entryTime?: string
  checkIn?: CheckInRecord
  /** 终态去向处置记录 */
  disposal?: DisposalRecord
  history: HistoryEntry[]
  createdAt: number
}

// ============ 撮合 ============
export type MatchStatus =
  | 'proposed'    // 待双方家长确认
  | 'accepted_a'  // A 方已确认
  | 'accepted_b'  // B 方已确认
  | 'confirmed'   // 双方确认，已分配摊位
  | 'declined'    // 一方拒绝
  | 'cancelled'   // 取消
  | 'completed'   // 现场交换完成
  | 'failed'      // 现场未成交

export interface Match {
  id: string
  itemAId: string
  itemBId: string
  score: number
  reasons: string[]
  status: MatchStatus
  booth?: string
  entryTime?: string
  onsite?: boolean // 现场自由交换登记
  createdAt: number
}

// ============ 异常 / 争议 ============
export type IncidentType =
  | 'no_show'          // 家长临时缺席
  | 'photo_mismatch'   // 物品与照片不符
  | 'child_regret'     // 孩子现场反悔
  | 'value_dispute'    // 双方价值争议
  | 'charity_capacity' // 公益组织承接能力不足（超上限/年龄段不符）
  | 'charity_damaged'  // 公益机构破损拒收

export type IncidentStatus = 'open' | 'processing' | 'resolved'

export interface IncidentLog {
  at: number
  actor: string
  role: Role
  message: string
}

export interface Incident {
  id: string
  itemId: string
  matchId?: string
  type: IncidentType
  title: string
  status: IncidentStatus
  logs: IncidentLog[]
  resolution?: string
  /** 现场处理人（办结时记录） */
  onsiteHandler?: string
  createdBy: string
  createdAt: number
}

// ============ 公益机构承接设置 ============
export interface CharityProfile {
  charityId: string
  /** 可接收年龄段（闭区间，岁） */
  acceptAgeRange: [number, number]
  /** 本场公益捐赠承接上限（件） */
  capacityLimit: number
  /** 运输 / 上门取件时间说明 */
  pickupWindow: string
  /** 是否需要开具公益捐赠票据 */
  invoiceNeeded: boolean
  /** 开票抬头 / 税号等备注 */
  invoiceNote?: string
  updatedAt: number
}

// ============ 捐赠 ============
export type DonationStatus = 'requested' | 'received' | 'declined'

export type DonationDeclineReason =
  | 'over_capacity'   // 超过承接上限
  | 'age_unfit'       // 不在可接收年龄段
  | 'damaged'         // 物品破损拒收
  | 'category_unfit'  // 品类不在接收范围
  | 'other'

export interface Donation {
  id: string
  itemId: string
  charityId: string
  status: DonationStatus
  note?: string
  declineReason?: DonationDeclineReason
  /** 接收成功后关联的交接清单 */
  handoverId?: string
  createdAt: number
  respondedAt?: number
}

// ============ 捐赠交接清单 ============
export interface HandoverItem {
  name: string
  qty: number
  condition: string
}

export interface Handover {
  id: string
  /** 交接单号，如 HO-8821 */
  code: string
  donationId: string
  itemId: string
  charityId: string
  parentId: string
  eventName: string
  /** 清点物品明细 */
  items: HandoverItem[]
  /** 交接现场照片（dataURL 或 emoji 占位） */
  photos: string[]
  /** 公益机构现场处理人 */
  charityHandler: string
  /** 社区监交人 */
  staffHandler?: string
  /** 运输 / 取件时间 */
  pickupWindow: string
  invoiceNeeded: boolean
  invoiceNote?: string
  /** 捐赠去向（帮扶地区 / 用途说明） */
  destination?: string
  /** 家长是否已查看 */
  viewedByParent: boolean
  createdAt: number
}

// ============ 活动 ============
export type EventPhase = 'signup' | 'matching' | 'onsite' | 'finished'

export interface EventInfo {
  id: string
  name: string
  date: string
  venue: string
  phase: EventPhase
  boothCapacity: number
  timeSlots: string[]
}

// ============ 持久化数据库 ============
export interface DB {
  users: User[]
  items: Item[]
  matches: Match[]
  incidents: Incident[]
  donations: Donation[]
  charityProfiles: CharityProfile[]
  handovers: Handover[]
  event: EventInfo
}
