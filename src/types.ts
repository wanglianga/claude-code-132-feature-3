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
  /** 公益机构剩余接收能力（件） */
  capacity?: number
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
  | 'donated'      // 已转捐
  | 'taken_back'   // 已带回
  | 'no_show'      // 未到场
  | 'disputed'     // 争议/异常处理中
  | 'stored'       // 寄存社区，等待下一场
  | 'next_event'   // 已预约下一场活动
  | 'recycled'     // 环保回收
  | 'charity_returned' // 公益机构拒收（破损/超限），待家长确认去向

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
  /** 公益拒收/超限后的去向处置 */
  disposal?: ItemDisposal
  history: HistoryEntry[]
  createdAt: number
}

/** 物品末端去向处置（公益拒收、超限、环保回收等） */
export type DisposalRoute =
  | 'take_back'     // 家长带回
  | 'community_store' // 寄存社区
  | 'next_event'    // 预约下一场活动
  | 'recycle'       // 环保回收

export interface ItemDisposal {
  route: DisposalRoute
  /** 现场处理人（志愿者/工作人员/公益机构经办人） */
  handler: string
  at: number
  note?: string
  /** 预约下一场活动时的场次说明 */
  nextEvent?: string
  /** 环保回收单位 */
  recycler?: string
  /** 触发处置的捐赠单 */
  donationId?: string
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
  | 'charity_capacity' // 公益组织接收能力不足
  | 'charity_damaged'  // 破损物品被公益机构拒收

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
  createdBy: string
  createdAt: number
}

// ============ 捐赠 ============
export type DonationStatus = 'requested' | 'received' | 'declined'
/** 拒收原因分类：承接上限 / 年龄段不符 / 破损拒收 */
export type DonationDeclineReason = 'capacity' | 'age_unfit' | 'damaged'

/** 公益机构接收时生成的交接清单 */
export interface Handover {
  id: string
  donationId: string
  itemId: string
  charityId: string
  /** 经办人（公益机构现场接收人） */
  handler: string
  /** 交接照片（dataURL 或 emoji 占位） */
  photos: string[]
  /** 运输安排 */
  transportTime: string
  transportMethod?: string
  /** 开票需求 */
  invoiceNeeded: boolean
  invoiceTitle?: string
  /** 最终去向 */
  destination: string
  at: number
}

export interface Donation {
  id: string
  itemId: string
  charityId: string
  status: DonationStatus
  note?: string
  /** 拒收原因分类（拒收时必填） */
  declineReason?: DonationDeclineReason
  /** 破损描述（破损拒收时） */
  damageDesc?: string
  /** 现场处理人（拒收时记录） */
  handler?: string
  /** 接收后生成的交接清单 */
  handoverId?: string
  createdAt: number
}

/** 公益机构承接能力配置（按年龄段设置上限） */
export interface CharityQuota {
  /** 年龄段标签，如 3–6 岁 */
  label: string
  /** 年龄下限/上限 */
  ageRange: [number, number]
  /** 承接上限（件），0 表示不接收该年龄段 */
  limit: number
}

export interface CharityProfile {
  userId: string
  /** 可接收年龄段及各自数量上限 */
  quotas: CharityQuota[]
  /** 预计运输时间（现场接收后多久运走） */
  transportTime: string
  /** 运输方式 */
  transportMethod: string
  /** 是否支持开具捐赠票据 */
  invoiceSupported: boolean
  /** 开票说明 */
  invoiceNote: string
  updatedAt: number
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
  handovers: Handover[]
  charityProfiles: CharityProfile[]
  event: EventInfo
}
